export interface UserAuthRecord {
  id: string;
  municipioId: string;
  email: string;
  senhaHash: string;
  ativo: boolean;
  tentativasLoginFalhas: number;
  bloqueadoAte: Date | null;
}

export interface CreateSessionParams {
  usuarioId: string;
  expiraEm: Date;
  ipOrigem?: string;
  userAgent?: string;
}

export interface IAuthRepository {
  buscarUsuarioPorEmail(email: string): Promise<UserAuthRecord | null>;
  registrarFalhaLogin(usuarioId: string): Promise<void>;
  resetarEstadoLogin(usuarioId: string): Promise<void>;
  criarSessao(params: CreateSessionParams): Promise<string>;
}

export const AUTH_REPOSITORY = Symbol("IAuthRepository");
