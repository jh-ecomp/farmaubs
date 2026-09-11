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
  nomeCompleto: string;
  email: string;
  senha: string;
  perfil: PerfilCodigo | string;
  municipioId: string;
  ubsIds: string[];
  cpf?: string;
  crf?: string;
  deveTrocarSenha?: boolean;
}

export interface CadastrarUsuarioResultado {
  id: string;
  municipioId: string;
  nomeCompleto: string;
  email: string;
  perfilId: string;
  ativo: boolean;
  deveTrocarSenha: boolean;
  ubsIds: string[];
  criadoEm: string;
}

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

export interface ListagemUsuariosFiltros {
  page?: number;
  limit?: number;
  busca?: string;
  perfilId?: string;
  municipioId?: string;
  status?: string;
}

export interface ListagemUsuariosResultado {
  data: UsuarioItemTabela[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AlterarStatusUsuarioComando {
  ativo: boolean;
}
