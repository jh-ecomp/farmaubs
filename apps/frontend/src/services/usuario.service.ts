import {
  PerfilCodigo,
  type CadastrarUsuarioComando,
  type CadastrarUsuarioResultado,
  type ListagemUsuariosFiltros,
  type ListagemUsuariosResultado,
  type MunicipioDto,
  type UnidadeSaudeDto,
  type UsuarioItemTabela,
} from "@farmaubs/shared";

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

// Base de dados local em memória/localStorage para desenvolvimento enquanto o backend conclui as rotas de administração
const STORAGE_KEY_USUARIOS = "@FarmaUBS:dev_usuarios";

const INITIAL_MUNICIPIOS: MunicipioDto[] = [
  { id: "mun-sp", nome: "São Paulo", uf: "SP", ibgeCode: "3550308" },
  { id: "mun-rj", nome: "Rio de Janeiro", uf: "RJ", ibgeCode: "3304557" },
  { id: "mun-bh", nome: "Belo Horizonte", uf: "MG", ibgeCode: "3106200" },
];

const INITIAL_UNIDADES: UnidadeSaudeDto[] = [
  {
    id: "ubs-jardim-primavera",
    municipioId: "mun-sp",
    nome: "UBS Jardim Primavera",
    endereco: "Rua das Flores, 100 — Jardim Primavera, São Paulo/SP",
    cafLeadTimeDays: 15,
  },
  {
    id: "ubs-vila-nova",
    municipioId: "mun-sp",
    nome: "UBS Vila Nova",
    endereco: "Av. Central, 250 — Vila Nova, São Paulo/SP",
    cafLeadTimeDays: 15,
  },
  {
    id: "ubs-copacabana-sul",
    municipioId: "mun-rj",
    nome: "UBS Copacabana Sul",
    endereco: "Rua Bolivar, 30 — Copacabana, Rio de Janeiro/RJ",
    cafLeadTimeDays: 10,
  },
];

const SEED_USUARIOS: UsuarioItemTabela[] = [
  {
    id: "usr-admin",
    municipioId: "mun-sp",
    municipioNome: "São Paulo",
    nomeCompleto: "Admin Sistema",
    email: "admin@farmaubs.dev",
    perfilCodigo: PerfilCodigo.ADMINISTRADOR,
    perfilNome: "Administrador",
    unidades: [],
    ativo: true,
    ultimoLoginEm: null,
    createdAt: "2026-09-01T08:00:00.000Z",
  },
  {
    id: "usr-gestor",
    municipioId: "mun-sp",
    municipioNome: "São Paulo",
    nomeCompleto: "Gestor São Paulo",
    email: "gestor@farmaubs.dev",
    perfilCodigo: PerfilCodigo.GESTOR,
    perfilNome: "Gestor/Coordenador",
    unidades: [],
    ativo: true,
    ultimoLoginEm: null,
    createdAt: "2026-09-02T09:30:00.000Z",
  },
  {
    id: "usr-farma-resp",
    municipioId: "mun-sp",
    municipioNome: "São Paulo",
    nomeCompleto: "Farmacêutico Responsável UBS Jardim Primavera",
    email: "farmaceutico.responsavel@farmaubs.dev",
    perfilCodigo: PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    perfilNome: "Farmacêutico Responsável",
    unidades: [{ id: "ubs-jardim-primavera", nome: "UBS Jardim Primavera" }],
    ativo: true,
    ultimoLoginEm: null,
    createdAt: "2026-09-03T10:15:00.000Z",
  },
  {
    id: "usr-farma-res",
    municipioId: "mun-sp",
    municipioNome: "São Paulo",
    nomeCompleto: "Farmacêutico Residente Teste",
    email: "farmaceutico.residente@farmaubs.dev",
    perfilCodigo: PerfilCodigo.FARMACEUTICO_RESIDENTE,
    perfilNome: "Farmacêutico Residente",
    unidades: [
      { id: "ubs-jardim-primavera", nome: "UBS Jardim Primavera" },
      { id: "ubs-vila-nova", nome: "UBS Vila Nova" },
    ],
    ativo: true,
    ultimoLoginEm: null,
    createdAt: "2026-09-04T11:00:00.000Z",
  },
  {
    id: "usr-inativo",
    municipioId: "mun-sp",
    municipioNome: "São Paulo",
    nomeCompleto: "Usuário Inativo Teste",
    email: "inativo@farmaubs.dev",
    perfilCodigo: PerfilCodigo.GESTOR,
    perfilNome: "Gestor/Coordenador",
    unidades: [],
    ativo: false,
    ultimoLoginEm: null,
    createdAt: "2026-09-05T14:20:00.000Z",
  },
];

function getDevUsuarios(): UsuarioItemTabela[] {
  const saved = localStorage.getItem(STORAGE_KEY_USUARIOS);
  if (saved) {
    try {
      const parsed: UsuarioItemTabela[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const emailsExistentes = new Set(
          parsed.map((u) => u.email?.toLowerCase()),
        );
        const faltantes = SEED_USUARIOS.filter(
          (s) => !emailsExistentes.has(s.email.toLowerCase()),
        );
        if (faltantes.length > 0) {
          const mesclados = [...parsed, ...faltantes];
          localStorage.setItem(STORAGE_KEY_USUARIOS, JSON.stringify(mesclados));
          return mesclados;
        }
        return parsed;
      }
    } catch {
      // fallback se parse falhar
    }
  }
  localStorage.setItem(STORAGE_KEY_USUARIOS, JSON.stringify(SEED_USUARIOS));
  return [...SEED_USUARIOS];
}

export const usuarioService = {
  async listarUsuarios(
    filtros: ListagemUsuariosFiltros = {},
  ): Promise<ListagemUsuariosResultado> {
    try {
      const params = new URLSearchParams();
      if (filtros.page) params.set("page", String(filtros.page));
      if (filtros.limit) params.set("limit", String(filtros.limit));
      if (filtros.busca) params.set("busca", filtros.busca);
      if (filtros.perfilId) params.set("perfilId", filtros.perfilId);
      if (filtros.municipioId) params.set("municipioId", filtros.municipioId);
      if (filtros.status) params.set("status", filtros.status);

      const queryString = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`${API_BASE_URL}/usuarios${queryString}`, {
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        return await res.json();
      }
      if (res.status >= 500) {
        throw new UsuarioApiError(
          "Erro interno no servidor (5xx).",
          res.status,
        );
      }
    } catch (err) {
      if (err instanceof UsuarioApiError) throw err;
      // Se a rota não existir no backend (404), recorre ao fallback de desenvolvimento
    }

    // Fallback de desenvolvimento
    let todos: UsuarioItemTabela[] = getDevUsuarios();
    if (filtros.busca) {
      const termo = filtros.busca.toLowerCase();
      todos = todos.filter(
        (u: UsuarioItemTabela) =>
          u.nomeCompleto.toLowerCase().includes(termo) ||
          u.email.toLowerCase().includes(termo) ||
          (u.cpf && u.cpf.includes(termo)) ||
          (u.crf && u.crf.toLowerCase().includes(termo)),
      );
    }
    if (filtros.perfilId && filtros.perfilId !== "ALL") {
      todos = todos.filter(
        (u: UsuarioItemTabela) => u.perfilCodigo === filtros.perfilId,
      );
    }
    if (filtros.municipioId && filtros.municipioId !== "ALL") {
      todos = todos.filter(
        (u: UsuarioItemTabela) => u.municipioId === filtros.municipioId,
      );
    }
    if (filtros.status && filtros.status !== "ALL") {
      const deveSerAtivo = filtros.status.toUpperCase() === "ATIVO";
      todos = todos.filter((u: UsuarioItemTabela) => u.ativo === deveSerAtivo);
    }

    const page = filtros.page || 1;
    const limit = filtros.limit || 10;
    const start = (page - 1) * limit;
    const paginados = todos.slice(start, start + limit);

    return {
      data: paginados,
      total: todos.length,
      page,
      limit,
      totalPages: Math.ceil(todos.length / limit) || 1,
    };
  },

  async buscarMunicipios(): Promise<MunicipioDto[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/administracao/municipios`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
      if (res.status >= 500) {
        throw new UsuarioApiError(
          "Erro interno no servidor (5xx).",
          res.status,
        );
      }
    } catch (err) {
      if (err instanceof UsuarioApiError) throw err;
      // Fallback
    }
    return INITIAL_MUNICIPIOS;
  },

  async buscarUnidadesSaude(municipioId?: string): Promise<UnidadeSaudeDto[]> {
    try {
      const query = municipioId
        ? `?municipioId=${encodeURIComponent(municipioId)}`
        : "";
      const res = await fetch(
        `${API_BASE_URL}/administracao/unidades-saude${query}`,
        {
          headers: getAuthHeaders(),
        },
      );
      if (res.ok) {
        return await res.json();
      }
      if (res.status >= 500) {
        throw new UsuarioApiError(
          "Erro interno no servidor (5xx).",
          res.status,
        );
      }
    } catch (err) {
      if (err instanceof UsuarioApiError) throw err;
      // Fallback
    }

    if (!municipioId) return [];
    return INITIAL_UNIDADES.filter((u) => u.municipioId === municipioId);
  },

  async cadastrarUsuario(
    dados: CadastrarUsuarioComando,
  ): Promise<CadastrarUsuarioResultado> {
    try {
      const res = await fetch(`${API_BASE_URL}/usuarios`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(dados),
      });

      if (res.status === 409) {
        throw new UsuarioApiError(
          "Este e-mail já está em uso por outro usuário.",
          409,
        );
      }

      if (res.ok) {
        return await res.json();
      }

      if (res.status >= 500) {
        throw new UsuarioApiError(
          "Erro interno no servidor (5xx).",
          res.status,
        );
      }
    } catch (err) {
      if (err instanceof UsuarioApiError) throw err;
    }

    // Fallback de desenvolvimento: valida e salva no storage local
    const usuarios: UsuarioItemTabela[] = getDevUsuarios();
    const jaExiste = usuarios.some(
      (u: UsuarioItemTabela) =>
        u.email.toLowerCase() === dados.email.toLowerCase(),
    );
    if (jaExiste) {
      throw new UsuarioApiError(
        "Este e-mail já está em uso por outro usuário.",
        409,
      );
    }

    const mun = INITIAL_MUNICIPIOS.find((m) => m.id === dados.municipioId);
    const ubsVinculadas = INITIAL_UNIDADES.filter((u) =>
      dados.ubsIds.includes(u.id),
    ).map((u) => ({ id: u.id, nome: u.nome, cnes: "2401824" }));

    const novoUsuario: UsuarioItemTabela = {
      id: "user-" + Date.now(),
      municipioId: dados.municipioId,
      municipioNome: mun ? mun.nome : "São Paulo",
      nomeCompleto: dados.nomeCompleto,
      email: dados.email,
      perfilCodigo: dados.perfil,
      perfilNome: String(dados.perfil),
      unidades: ubsVinculadas,
      ativo: true,
      cpf: dados.cpf,
      crf: dados.crf,
      createdAt: new Date().toISOString(),
    };

    usuarios.unshift(novoUsuario);
    localStorage.setItem(STORAGE_KEY_USUARIOS, JSON.stringify(usuarios));

    return {
      id: novoUsuario.id,
      municipioId: dados.municipioId,
      nomeCompleto: dados.nomeCompleto,
      email: dados.email,
      perfilId: String(dados.perfil),
      ativo: true,
      deveTrocarSenha: Boolean(dados.deveTrocarSenha),
      ubsIds: dados.ubsIds,
      criadoEm: new Date(novoUsuario.createdAt),
    };
  },

  async alterarStatus(usuarioId: string, ativo: boolean): Promise<void> {
    try {
      const res = await fetch(
        `${API_BASE_URL}/usuarios/${encodeURIComponent(usuarioId)}/status`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({ ativo }),
        },
      );
      if (res.ok) return;
      if (res.status >= 500) {
        throw new UsuarioApiError(
          "Erro interno no servidor (5xx).",
          res.status,
        );
      }
    } catch (err) {
      if (err instanceof UsuarioApiError) throw err;
      // Fallback
    }

    const usuarios: UsuarioItemTabela[] = getDevUsuarios();
    const index = usuarios.findIndex(
      (u: UsuarioItemTabela) => u.id === usuarioId,
    );
    if (index !== -1) {
      usuarios[index].ativo = ativo;
      localStorage.setItem(STORAGE_KEY_USUARIOS, JSON.stringify(usuarios));
    }
  },

  async atualizarUsuario(
    usuarioId: string,
    dados: Partial<CadastrarUsuarioComando>,
  ): Promise<UsuarioItemTabela> {
    try {
      const res = await fetch(
        `${API_BASE_URL}/usuarios/${encodeURIComponent(usuarioId)}`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify(dados),
        },
      );
      if (res.ok) {
        return await res.json();
      }
      if (res.status >= 500) {
        throw new UsuarioApiError(
          "Erro interno no servidor (5xx).",
          res.status,
        );
      }
    } catch (err) {
      if (err instanceof UsuarioApiError) throw err;
      // Fallback
    }

    const usuarios = getDevUsuarios();
    const index = usuarios.findIndex((u) => u.id === usuarioId);
    if (index === -1) {
      throw new UsuarioApiError("Usuário não encontrado.", 404);
    }

    const mun = INITIAL_MUNICIPIOS.find((m) => m.id === dados.municipioId);
    const ubsVinculadas = dados.ubsIds
      ? INITIAL_UNIDADES.filter((u) => dados.ubsIds?.includes(u.id)).map(
          (u) => ({
            id: u.id,
            nome: u.nome,
            cnes: "2401824",
          }),
        )
      : usuarios[index].unidades;

    const usuarioAtualizado: UsuarioItemTabela = {
      ...usuarios[index],
      nomeCompleto: dados.nomeCompleto || usuarios[index].nomeCompleto,
      email: dados.email || usuarios[index].email,
      perfilCodigo: dados.perfil || usuarios[index].perfilCodigo,
      perfilNome: dados.perfil
        ? String(dados.perfil)
        : usuarios[index].perfilNome,
      municipioId: dados.municipioId || usuarios[index].municipioId,
      municipioNome: mun ? mun.nome : usuarios[index].municipioNome,
      unidades: ubsVinculadas,
      cpf: dados.cpf !== undefined ? dados.cpf : usuarios[index].cpf,
      crf: dados.crf !== undefined ? dados.crf : usuarios[index].crf,
    };

    usuarios[index] = usuarioAtualizado;
    localStorage.setItem(STORAGE_KEY_USUARIOS, JSON.stringify(usuarios));
    return usuarioAtualizado;
  },

  async redefinirSenha(usuarioId: string): Promise<{ mensagem: string }> {
    try {
      const res = await fetch(
        `${API_BASE_URL}/usuarios/${encodeURIComponent(usuarioId)}/redefinir-senha`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        },
      );
      if (res.ok) {
        return await res.json();
      }
      if (res.status >= 500) {
        throw new UsuarioApiError(
          "Erro interno no servidor (5xx).",
          res.status,
        );
      }
    } catch (err) {
      if (err instanceof UsuarioApiError) throw err;
      // Fallback
    }
    return {
      mensagem:
        "Link de redefinição e credencial provisória emitidos com sucesso (RF003).",
    };
  },
};
