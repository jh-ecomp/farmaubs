import type {
  CadastrarUsuarioComando,
  CadastrarUsuarioResultado,
  ListagemUsuariosFiltros,
  ListagemUsuariosResultado,
  MunicipioDto,
  UnidadeSaudeDto,
  UsuarioItemTabela,
  RedefinirSenhaProvisoriaResultado,
} from "@farmaubs/shared";

import { authService, inspectSessionExpiresHeader } from "./api";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

export class UsuarioApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "UsuarioApiError";
    this.status = status;
    this.data = data;
  }
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("@FarmaUBS:token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export const usuarioService = {
  async listarUsuarios(
    filtros: ListagemUsuariosFiltros = {},
  ): Promise<ListagemUsuariosResultado> {
    const params = new URLSearchParams();
    if (filtros.page) params.set("page", String(filtros.page));
    if (filtros.limit) params.set("limit", String(filtros.limit));
    if (filtros.busca) params.set("busca", filtros.busca);
    if (filtros.perfilId) params.set("perfilId", filtros.perfilId);
    if (filtros.municipioId) params.set("municipioId", filtros.municipioId);
    if (filtros.status) params.set("status", filtros.status);

    const queryString = params.toString() ? `?${params.toString()}` : "";
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/usuarios${queryString}`, {
        headers: getAuthHeaders(),
      });
      res = inspectSessionExpiresHeader(res);
    } catch {
      throw new UsuarioApiError(
        "Não foi possível conectar ao servidor. Verifique sua conexão.",
        0,
      );
    }

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      throw new UsuarioApiError(
        erro.message || "Erro ao consultar lista de usuários.",
        res.status,
        erro,
      );
    }

    return await res.json();
  },

  async buscarMunicipios(): Promise<MunicipioDto[]> {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/administracao/municipios`, {
        headers: getAuthHeaders(),
      });
      res = inspectSessionExpiresHeader(res);
    } catch {
      throw new UsuarioApiError(
        "Não foi possível conectar ao servidor. Verifique sua conexão.",
        0,
      );
    }

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      throw new UsuarioApiError(
        erro.message || "Erro ao carregar municípios.",
        res.status,
        erro,
      );
    }

    return await res.json();
  },

  async buscarUnidadesSaude(municipioId?: string): Promise<UnidadeSaudeDto[]> {
    if (!municipioId) return [];
    const query = `?municipioId=${encodeURIComponent(municipioId)}`;
    let res: Response;
    try {
      res = await fetch(
        `${API_BASE_URL}/administracao/unidades-saude${query}`,
        {
          headers: getAuthHeaders(),
        },
      );
      res = inspectSessionExpiresHeader(res);
    } catch {
      throw new UsuarioApiError(
        "Não foi possível conectar ao servidor. Verifique sua conexão.",
        0,
      );
    }

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      throw new UsuarioApiError(
        erro.message || "Erro ao carregar unidades de saúde.",
        res.status,
        erro,
      );
    }

    return await res.json();
  },

  async cadastrarUsuario(
    dados: CadastrarUsuarioComando,
  ): Promise<CadastrarUsuarioResultado> {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/usuarios`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(dados),
      });
      res = inspectSessionExpiresHeader(res);
    } catch {
      throw new UsuarioApiError(
        "Não foi possível conectar ao servidor. Verifique sua conexão.",
        0,
      );
    }

    if (res.status === 409) {
      throw new UsuarioApiError(
        "Este e-mail já está em uso por outro usuário.",
        409,
      );
    }

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      throw new UsuarioApiError(
        erro.message || "Erro ao cadastrar usuário.",
        res.status,
        erro,
      );
    }

    return await res.json();
  },

  async alterarStatus(usuarioId: string, ativo: boolean): Promise<void> {
    let res: Response;
    try {
      res = await fetch(
        `${API_BASE_URL}/usuarios/${encodeURIComponent(usuarioId)}/status`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({ ativo }),
        },
      );
    } catch {
      throw new UsuarioApiError(
        "Não foi possível conectar ao servidor. Verifique sua conexão.",
        0,
      );
    }

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      throw new UsuarioApiError(
        erro.message || "Erro ao alterar status do usuário.",
        res.status,
        erro,
      );
    }
  },

  async atualizarUsuario(
    usuarioId: string,
    dados: Partial<CadastrarUsuarioComando>,
  ): Promise<UsuarioItemTabela> {
    let res: Response;
    try {
      res = await fetch(
        `${API_BASE_URL}/usuarios/${encodeURIComponent(usuarioId)}`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify(dados),
        },
      );
    } catch {
      throw new UsuarioApiError(
        "Não foi possível conectar ao servidor. Verifique sua conexão.",
        0,
      );
    }

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      throw new UsuarioApiError(
        erro.message || "Erro ao atualizar usuário.",
        res.status,
        erro,
      );
    }

    return await res.json();
  },

  async redefinirSenha(
    usuarioId: string,
    senhaProvisoria?: string,
  ): Promise<RedefinirSenhaProvisoriaResultado> {
    return authService.redefinirSenhaProvisoria(usuarioId, senhaProvisoria);
  },
};
