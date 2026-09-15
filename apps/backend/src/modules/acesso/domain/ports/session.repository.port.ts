export interface SessionRecord {
  id: string;
  usuarioId: string;
  municipioId: string;
  perfilId: string;
  unidadeIds: string[];
  status: string;
  expiraEm: Date;
  criadoEm: Date;
  ultimaAtividadeEm: Date;
}

export interface RenovarSessaoParams {
  sessionId: string;
  expiraEm: Date;
}

export interface ISessionRepository {
  buscarPorTokenHash(tokenHash: string): Promise<SessionRecord | null>;

  renovarAtividade(params: RenovarSessaoParams): Promise<void>;

  revogar(sessionId: string): Promise<void>;

  revogarTodas(usuarioId: string): Promise<void>;
}

export const SESSION_REPOSITORY = Symbol("ISessionRepository");
