export interface UserAcessoRecord {
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

export interface IAcessoRepository {
  buscarUsuarioPorEmail(email: string): Promise<UserAcessoRecord | null>;
  registrarFalhaLogin(usuarioId: string): Promise<void>;
  resetarEstadoLogin(usuarioId: string): Promise<void>;
  criarSessao(params: CreateSessionParams): Promise<string>;
}

export const ACESSO_REPOSITORY = Symbol("IAcessoRepository");
