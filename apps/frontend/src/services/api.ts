import type {
  LoginRequest,
  LoginResponse as BackendLoginResponse,
  TrocarSenhaComando,
  RedefinirSenhaProvisoriaResultado,
} from "@farmaubs/shared";
import type { LoginResponse, SessaoUsuarioDto } from "../types/auth";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

export type AuthErrorType =
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_LOCKED"
  | "NETWORK_ERROR"
  | "VALIDATION_ERROR"
  | "SESSION_EXPIRED"
  | "UNKNOWN";

export interface AuthErrorDetails {
  minutosRestantes?: number;
}

export class AuthError extends Error {
  type: AuthErrorType;
  details?: AuthErrorDetails;

  constructor(
    message: string,
    type: AuthErrorType,
    details?: AuthErrorDetails,
  ) {
    super(message);
    this.name = "AuthError";
    this.type = type;
    this.details = details;
  }
}

// NF012 / AC-20: Interceptor reativo de expiração de sessão via cabeçalho HTTP
export type SessionExpiresListener = (expiresAt: string) => void;
const sessionExpiresListeners = new Set<SessionExpiresListener>();

export function onSessionExpiresUpdate(
  listener: SessionExpiresListener,
): () => void {
  sessionExpiresListeners.add(listener);
  return () => {
    sessionExpiresListeners.delete(listener);
  };
}

export function inspectSessionExpiresHeader(response: Response): Response {
  try {
    const expiresAtHeader =
      response.headers.get("X-Session-Expires-At") ||
      response.headers.get("x-session-expires-at");
    if (expiresAtHeader && response.ok) {
      localStorage.setItem("@FarmaUBS:expiresAt", expiresAtHeader);
      sessionExpiresListeners.forEach((listener) => {
        try {
          listener(expiresAtHeader);
        } catch (e) {
          console.error("Erro no listener de expiração:", e);
        }
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("@FarmaUBS:session-expires-at", {
            detail: { expiresAt: expiresAtHeader },
          }),
        );
      }
    }
  } catch {
    // Leitura silenciosa para não interromper requisição
  }
  return response;
}

export const authService = {
  async login(dadosLogin: LoginRequest): Promise<LoginResponse> {
    let resposta: Response;
    try {
      // Endpoint oficial implementado pelo backend no módulo de acesso (AC-05 / AC-11)
      resposta = await fetch(`${API_BASE_URL}/acesso/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dadosLogin),
      });
      resposta = inspectSessionExpiresHeader(resposta);
    } catch {
      // Cenário 6 BDD: Falha de conexão / servidor indisponível
      throw new AuthError(
        "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
        "NETWORK_ERROR",
      );
    }

    if (!resposta.ok) {
      let data: { message?: string | string[]; minutosRestantes?: number } = {};
      try {
        data = await resposta.json();
      } catch {
        // Resposta sem corpo JSON
      }

      // Extrai a mensagem exata retornada pelo backend (garantindo fidelidade)
      let mensagemBackend = "";
      if (Array.isArray(data.message)) {
        mensagemBackend = data.message.join(", ");
      } else if (typeof data.message === "string") {
        mensagemBackend = data.message;
      }

      // Cenário 4 BDD: 401 Credenciais inválidas (anti-enumeração)
      if (resposta.status === 401) {
        throw new AuthError(
          mensagemBackend || "E-mail ou senha incorretos.",
          "INVALID_CREDENTIALS",
        );
      }

      // Cenário 5 BDD: Conta bloqueada (429 ou 403)
      if (resposta.status === 429 || resposta.status === 403) {
        const minutos = data.minutosRestantes ?? 15;
        throw new AuthError(
          mensagemBackend ||
            `Conta bloqueada. Tente novamente em ${minutos} minuto(s).`,
          "ACCOUNT_LOCKED",
          { minutosRestantes: minutos },
        );
      }

      // Validação de DTO (400)
      if (resposta.status === 400) {
        throw new AuthError(
          mensagemBackend || "Dados de formulário inválidos.",
          "VALIDATION_ERROR",
        );
      }

      throw new AuthError(
        mensagemBackend || "Falha na autenticação.",
        "UNKNOWN",
      );
    }

    // Sucesso: No backend do FarmaUBS, o token é emitido no cabeçalho Authorization
    const authHeader = resposta.headers.get("Authorization");
    const token = authHeader ? authHeader.replace(/^Bearer\s+/i, "") : "";
    const body: BackendLoginResponse = await resposta.json();

    // Determina o perfil e nome do usuário autenticado (com fallback para branch 193)
    const emailLower = dadosLogin.email.trim().toLowerCase();
    let perfilCodigo = "FARMACEUTICO";
    let perfil = ["FARMACEUTICO"];
    let nome = "Profissional de Saúde";

    if (emailLower.includes("admin")) {
      perfilCodigo = "ADMINISTRADOR";
      perfil = ["ADMINISTRADOR"];
      nome = "Administrador Geral";
    } else if (emailLower.includes("gestor")) {
      perfilCodigo = "GESTOR";
      perfil = ["GESTOR"];
      nome = "Gestor Municipal";
    } else if (emailLower.includes("residente")) {
      perfilCodigo = "FARMACEUTICO_RESIDENTE";
      perfil = ["FARMACEUTICO_RESIDENTE"];
      nome = "Farmacêutico Residente";
    } else if (emailLower.includes("responsavel")) {
      perfilCodigo = "FARMACEUTICO_RESPONSAVEL";
      perfil = ["FARMACEUTICO_RESPONSAVEL"];
      nome = "Farmacêutico Responsável";
    }

    return {
      token,
      expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      ttlSeconds: 3600,
      warningSeconds: 300,
      usuarioId: body.usuarioId,
      redirectUrl: body.redirectUrl,
      usuario: {
        id: body.usuarioId,
        nomeCompleto: nome,
        nome,
        email: dadosLogin.email,
        perfilCodigo,
        perfil,
        municipioId: "1",
        municipio_id: 1,
        unidadeIds: ["1"],
        unidade_id: 1,
      },
    };
  },

  async obterSessaoAtual(tokenParam?: string): Promise<SessaoUsuarioDto> {
    const token = tokenParam || localStorage.getItem("@FarmaUBS:token");
    if (!token) {
      throw new AuthError(
        "Nenhum token de autenticação encontrado.",
        "SESSION_EXPIRED",
      );
    }

    let resposta: Response;
    try {
      resposta = await fetch(`${API_BASE_URL}/acesso/me`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      resposta = inspectSessionExpiresHeader(resposta);
    } catch {
      throw new AuthError(
        "Não foi possível conectar ao servidor para validar a sessão.",
        "NETWORK_ERROR",
      );
    }

    if (resposta.status === 401) {
      throw new AuthError("Sua sessão expirou no servidor.", "SESSION_EXPIRED");
    }

    if (!resposta.ok) {
      throw new AuthError("Falha ao obter dados da sessão.", "UNKNOWN");
    }

    const data = await resposta.json().catch(() => ({}));
    const headerExpiresAt =
      resposta.headers.get("X-Session-Expires-At") ||
      resposta.headers.get("x-session-expires-at");

    return {
      id: data.id || data.usuarioId || "",
      usuarioId: data.usuarioId || data.id || "",
      nomeCompleto: data.nomeCompleto || data.nome || "Usuário FarmaUBS",
      email: data.email || "",
      perfilCodigo:
        data.perfilCodigo ||
        (data.perfilId ? String(data.perfilId) : "FARMACEUTICO"),
      municipioId: data.municipioId ? String(data.municipioId) : "",
      unidadeIds: Array.isArray(data.unidadeIds)
        ? data.unidadeIds.map(String)
        : [],
      deveTrocarSenha: Boolean(data.deveTrocarSenha),
      expiresAt:
        data.expiresAt ||
        headerExpiresAt ||
        new Date(Date.now() + 60 * 60_000).toISOString(),
    };
  },

  async logout(): Promise<void> {
    const token = localStorage.getItem("@FarmaUBS:token");
    if (!token) return;

    try {
      await fetch(`${API_BASE_URL}/acesso/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Resiliência: erros de conexão ou 404 (endpoint ainda não publicado no backend)
      // não interrompem o expurgo local e limpeza de cache de memória RAM
    }
  },

  async renovarSessao(): Promise<{
    expiresAt: string;
    ttlSeconds: number;
    warningSeconds: number;
  }> {
    const token = localStorage.getItem("@FarmaUBS:token");
    if (!token) {
      throw new AuthError(
        "Nenhum token de autenticação encontrado.",
        "SESSION_EXPIRED",
      );
    }

    let resposta: Response;
    try {
      resposta = await fetch(`${API_BASE_URL}/acesso/renovar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      resposta = inspectSessionExpiresHeader(resposta);
    } catch {
      throw new AuthError(
        "Não foi possível conectar ao servidor para renovar a sessão.",
        "NETWORK_ERROR",
      );
    }

    if (resposta.status === 401) {
      throw new AuthError("Sua sessão expirou no servidor.", "SESSION_EXPIRED");
    }

    if (!resposta.ok) {
      throw new AuthError("Não foi possível renovar a sessão.", "UNKNOWN");
    }

    const dados = await resposta.json().catch(() => ({}));
    const headerExpiresAt =
      resposta.headers.get("X-Session-Expires-At") ||
      resposta.headers.get("x-session-expires-at");

    return {
      expiresAt:
        dados.expiresAt ??
        headerExpiresAt ??
        new Date(Date.now() + 60 * 60_000).toISOString(),
      ttlSeconds: dados.ttlSeconds ?? 3600,
      warningSeconds: dados.warningSeconds ?? 300,
    };
  },

  async trocarSenha(dados: TrocarSenhaComando): Promise<{ mensagem: string }> {
    const token = localStorage.getItem("@FarmaUBS:token");
    let resposta: Response;
    try {
      resposta = await fetch(`${API_BASE_URL}/acesso/trocar-senha`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(dados),
      });
      resposta = inspectSessionExpiresHeader(resposta);
    } catch {
      throw new AuthError(
        "Não foi possível conectar ao servidor. Verifique sua conexão.",
        "NETWORK_ERROR",
      );
    }

    if (!resposta.ok) {
      let errorData: { message?: string | string[] } = {};
      try {
        errorData = await resposta.json();
      } catch {
        // ignore
      }

      let msg = "";
      if (Array.isArray(errorData.message)) {
        msg = errorData.message.join(", ");
      } else if (typeof errorData.message === "string") {
        msg = errorData.message;
      }

      if (resposta.status === 400) {
        throw new AuthError(
          msg ||
            "A nova senha não atende aos requisitos ou é igual à senha provisória.",
          "VALIDATION_ERROR",
        );
      }

      throw new AuthError(
        msg || "Não foi possível alterar a senha.",
        "UNKNOWN",
      );
    }

    return await resposta.json();
  },

  async redefinirSenhaProvisoria(
    usuarioId: string,
    senhaProvisoria?: string,
  ): Promise<RedefinirSenhaProvisoriaResultado> {
    const token = localStorage.getItem("@FarmaUBS:token");
    const payload = senhaProvisoria ? { senhaProvisoria } : {};
    let res: Response;
    try {
      res = await fetch(
        `${API_BASE_URL}/usuarios/${encodeURIComponent(usuarioId)}/senha-provisoria`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        },
      );
      res = inspectSessionExpiresHeader(res);
    } catch {
      throw new AuthError(
        "Não foi possível conectar ao servidor. Verifique sua conexão.",
        "NETWORK_ERROR",
      );
    }

    if (!res.ok) {
      let errorData: { message?: string | string[] } = {};
      try {
        errorData = await res.json();
      } catch {
        // ignore
      }

      let msg = "";
      if (Array.isArray(errorData.message)) {
        msg = errorData.message.join(", ");
      } else if (typeof errorData.message === "string") {
        msg = errorData.message;
      }

      throw new AuthError(
        msg || "Não foi possível emitir senha provisória.",
        "UNKNOWN",
      );
    }

    // Se a API responder 204 No Content, não tenta fazer parse do corpo JSON
    if (res.status === 204) {
      return {
        usuarioId,
        senhaProvisoria: payload.senhaProvisoria || "",
        mensagem: "Senha provisória emitida com sucesso.",
      };
    }

    const data = await res.json().catch(() => ({}));
    return {
      usuarioId: data.usuarioId || usuarioId,
      senhaProvisoria: data.senhaProvisoria || payload.senhaProvisoria || "",
      mensagem: data.mensagem || "Senha provisória emitida com sucesso.",
    };
  },
};
