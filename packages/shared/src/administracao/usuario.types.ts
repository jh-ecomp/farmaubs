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
  perfil: string;
  ubsIds: string[];
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
