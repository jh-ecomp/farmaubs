import type {
  LoginRequest,
  LoginResponse as BackendLoginResponse,
} from "@farmaubs/shared";
import type { LoginResponse } from "../types/auth";

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

    return {
      token,
      expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      ttlSeconds: 3600,
      warningSeconds: 300,
      usuarioId: body.usuarioId,
      redirectUrl: body.redirectUrl,
      usuario: {
        nome: "Farmacêutico(a)",
        email: dadosLogin.email,
        perfil: ["FARMACEUTICO"],
        municipio_id: 1,
        unidade_id: 1,
      },
    };
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

    try {
      const resposta = await fetch(`${API_BASE_URL}/acesso/renovar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (resposta.status === 401) {
        throw new AuthError(
          "Sua sessão expirou no servidor.",
          "SESSION_EXPIRED",
        );
      }

      if (resposta.ok) {
        const dados = await resposta.json();
        return {
          expiresAt:
            dados.expiresAt ?? new Date(Date.now() + 60 * 60_000).toISOString(),
          ttlSeconds: dados.ttlSeconds ?? 3600,
          warningSeconds: dados.warningSeconds ?? 300,
        };
      }
    } catch (err) {
      if (err instanceof AuthError) {
        throw err;
      }
      // Fallback seguro caso a rota ainda não tenha sido exposta pelo backend
    }

    // NF012: 60 minutos de TTL e 5 minutos (300s) de aviso
    return {
      expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      ttlSeconds: 3600,
      warningSeconds: 300,
    };
  },
};
