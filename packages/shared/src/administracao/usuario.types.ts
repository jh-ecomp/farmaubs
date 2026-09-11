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
