export interface SessionRecord {
  id: string;
  usuarioId: string;
  municipioId: string;
  status: string;
  expiraEm: Date;
  criadoEm: Date;
}

export interface RenovarSessaoParams {
  sessionId: string;
  expiraEm: Date;
}

export interface ISessionRepository {
  /** Busca sessão ativa e não expirada pelo token hash. */
  buscarPorTokenHash(tokenHash: string): Promise<SessionRecord | null>;

  /** Renova sliding window: atualiza ultima_atividade_em e expira_em. */
  renovarAtividade(params: RenovarSessaoParams): Promise<void>;

  /** Revoga a sessão (status = 'revogada', revogada_em = now()). */
  revogar(sessionId: string): Promise<void>;

  /** Revoga todas as sessões ativas de um usuário. */
  revogarTodas(usuarioId: string): Promise<void>;
}

export const SESSION_REPOSITORY = Symbol("ISessionRepository");
