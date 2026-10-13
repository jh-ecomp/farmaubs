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

export type SessionRecord = SessaoAutenticada;

export interface ISessionRepository {
  /**
   * [RF001 / AC-14]: Cria e persiste uma nova sessao com hash criptografico SHA-256.
   * @param params - Identificador do usuario, expiracao e metadados de rede/cliente.
   * @returns Token opaco gerado via CSPRNG em formato hexadecimal para o cliente.
   */
  criarSessao(params: CriarSessaoParams): Promise<string>;

  /**
   * [RF001 / AC-14]: Busca a sessao ativa consolidada com perfil e escopo via hash SHA-256.
   * @param tokenHash - Hash SHA-256 em hexadecimal do token de sessao.
   * @returns Snapshot autenticado da sessao ou null se inexistente/invalida.
   */
  buscarPorTokenHash(tokenHash: string): Promise<SessaoAutenticada | null>;

  /**
   * [RF001 / AC-14]: Atualiza carimbo de ultima atividade e estende a expiracao da sessao.
   * @param params - Identificador UUID da sessao e nova data/hora de expiracao.
   */
  renovarAtividade(params: RenovarSessaoParams): Promise<void>;

  /**
   * [RF001 / AC-14]: Revoga uma sessao especifica via soft delete mantendo rastreabilidade.
   * @param sessionId - Identificador UUID da sessao a revogar.
   */
  revogar(sessionId: string): Promise<void>;

  /**
   * [RF001 / AC-14]: Revoga todas as sessoes ativas do usuario informado via soft delete.
   * @param usuarioId - Identificador UUID do usuario alvo.
   */
  revogarTodas(usuarioId: string): Promise<void>;

  /**
   * [RF001 / AC-14]: Higieniza sessoes antigas expiradas que ultrapassaram a janela de retencao.
   * @param diasRetencao - Dias de retencao historica antes da remocao (default: 7 dias).
   * @returns Total de sessoes purgadas pelo procedimento do banco de dados.
   */
  limparExpiradas(diasRetencao?: number): Promise<number>;
}

export const SESSION_REPOSITORY = Symbol("ISessionRepository");
