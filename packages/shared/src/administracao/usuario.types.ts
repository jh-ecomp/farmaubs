import type { PerfilCodigo } from "../acesso/perfil.types";

export interface UsuarioDto {
  id: string;
  municipioId: string;
  nomeCompleto: string;
  email: string;
  perfilId: string;
  ativo: boolean;
  deveTrocarSenha: boolean;
  tentativasLoginFalhas: number;
  bloqueadoAte?: Date | string | null;
  ultimoLoginEm?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface UsuarioResumoDto {
  id: string;
  nomeCompleto: string;
  email: string;
  perfilCodigo: PerfilCodigo;
  municipioId: string;
  unidadeIds?: string[];
  ativo: boolean;
}

export interface CadastrarUsuarioComando {
  municipioId: string;
  nomeCompleto: string;
  email: string;
  senha: string;
  perfil: PerfilCodigo | string;
  ubsIds: string[];
  cpf?: string;
  crf?: string;
  deveTrocarSenha?: boolean;
}

export type RegisterUserCommand = CadastrarUsuarioComando;

export interface CadastrarUsuarioResultado {
  id: string;
  municipioId: string;
  nomeCompleto: string;
  email: string;
  perfilId: string;
  ativo: boolean;
  deveTrocarSenha: boolean;
  ubsIds: string[];
  criadoEm: Date;
  // Compatibilidade
  createdAt?: Date;
}

export type RegisterUserResult = CadastrarUsuarioResultado;
export type ResultadoCadastroUsuario = CadastrarUsuarioResultado;

export interface UsuarioItemTabela {
  id: string;
  municipioId: string;
  municipioNome?: string;
  nomeCompleto: string;
  email: string;
  perfilCodigo: PerfilCodigo | string;
  perfilNome?: string;
  unidades: Array<{
    id: string;
    nome: string;
    cnes?: string;
  }>;
  ativo: boolean;
  cpf?: string;
  crf?: string;
  ultimoLoginEm?: Date | string | null;
  createdAt: Date | string;
}

// 1. Filtros e Paginação de Entrada
export interface ListarUsuariosQuery {
  pagina?: number;
  limite?: number;
  termoBusca?: string;
  municipioId?: string;
  perfilCodigo?: PerfilCodigo;
  ativo?: boolean;
}

// 2. Resumo para Linha da Listagem Paginada
export interface UsuarioItemListaDto {
  id: string;
  nomeCompleto: string;
  email: string;
  perfilCodigo: PerfilCodigo | string;
  perfilNome: string;
  municipioId: string;
  municipioNome: string;
  ativo: boolean;
  deveTrocarSenha: boolean;
  totalUbsAssociadas: number;
  criadoEm: Date | string;
}

// 3. Envelope Paginado
export interface UsuariosPaginadosResultado {
  itens: UsuarioItemListaDto[];
  totalItens: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
}

// 4. Detalhe Completo do Usuário por ID
export interface UsuarioDetalheUbsDto {
  id: string;
  cnes: string;
  nome: string;
  ativo: boolean;
}

export interface UsuarioDetalheDto {
  id: string;
  nomeCompleto: string;
  email: string;
  ativo: boolean;
  deveTrocarSenha: boolean;
  municipio: {
    id: string;
    nome: string;
    uf: string;
  };
  perfil: {
    id: string;
    codigo: PerfilCodigo | string;
    nome: string;
  };
  unidadesSaude: UsuarioDetalheUbsDto[];
  ubsList?: UsuarioDetalheUbsDto[];
  ultimoLoginEm?: Date | string | null;
  criadoEm: Date | string;
  atualizadoEm: Date | string;
}

export interface ListagemUsuariosFiltros {
  page?: number;
  limit?: number;
  busca?: string;
  perfilId?: string;
  municipioId?: string;
  status?: string;
  pagina?: number;
  limite?: number;
  termoBusca?: string;
  perfilCodigo?: PerfilCodigo;
  ativo?: boolean;
}

export interface ListagemUsuariosResultado {
  data: UsuarioItemTabela[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  itens?: UsuarioItemListaDto[];
  totalItens?: number;
  pagina?: number;
  limite?: number;
  totalPaginas?: number;
}

export interface AlterarStatusUsuarioComando {
  ativo: boolean;
}

export interface EditarUsuarioComando {
  nomeCompleto?: string;
  email?: string;
}

export interface AtualizarAssociacoesUsuarioComando {
  perfilId: string;
  ubsIds: string[];
}

export interface UsuarioAtualizadoResultado {
  id: string;
  municipioId: string;
  nomeCompleto: string;
  email: string;
  perfilId: string;
  ativo: boolean;
  deveTrocarSenha: boolean;
  ubsIds: string[];
  atualizadoEm: Date;
}

export const TipoOperacaoAuditoria = {
  EDICAO_DADOS: "EDICAO_DADOS",
  MUDANCA_PERFIL_UBSS: "MUDANCA_PERFIL_UBSS",
  INATIVACAO: "INATIVACAO",
  REATIVACAO: "REATIVACAO",
  REDEFINICAO_SENHA_PROVISORIA: "REDEFINICAO_SENHA_PROVISORIA",
} as const;

export type TipoOperacaoAuditoria =
  (typeof TipoOperacaoAuditoria)[keyof typeof TipoOperacaoAuditoria];

export interface EventoAuditoria {
  id?: string;
  usuarioExecutorId: string;
  usuarioAlvoId: string;
  tipoOperacao: TipoOperacaoAuditoria;
  detalhes: Record<string, unknown>;
  createdAt?: Date;
}
