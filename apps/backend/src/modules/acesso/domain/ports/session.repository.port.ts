import type { SessaoUsuarioSnapshot } from "@farmaubs/shared";

export interface CriarSessaoParams {
  usuarioId: string;
  expiraEm: Date;
  ipOrigem?: string | null;
  userAgent?: string | null;
}

export interface RenovarSessaoParams {
  sessionId: string;
  expiraEm: Date;
}

export interface SessaoAutenticada extends SessaoUsuarioSnapshot {
  nomeCompleto: string;
  email: string;
}

export interface ISessionRepository {
  criarSessao(params: CriarSessaoParams): Promise<string>;
  buscarPorTokenHash(tokenHash: string): Promise<SessaoAutenticada | null>;
  renovarAtividade(params: RenovarSessaoParams): Promise<void>;
  revogar(sessionId: string): Promise<void>;
  revogarTodas(usuarioId: string): Promise<void>;
  limparExpiradas(diasRetencao?: number): Promise<number>;
}

export const SESSION_REPOSITORY = Symbol("ISessionRepository");
