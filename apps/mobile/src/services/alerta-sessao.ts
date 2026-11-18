import type { RenovarSessaoResponse } from "@farmaubs/shared";

export const AVISO_ANTES_MS = 5 * 60 * 1000;
export const CANAL_ALERTA_SESSAO = "farmaubs-session-alerts";
export const NOME_CANAL_ALERTA_SESSAO = "Alertas de Sessão e Segurança";
export const DESCRICAO_CANAL_ALERTA_SESSAO =
  "Avisos sobre expiração de sessão e segurança da conta do FarmaUBS.";
export const TITULO_ALERTA_SESSAO = "⚠️ Sessão do FarmaUBS expirando";
export const CORPO_ALERTA_SESSAO =
  "Sua sessão expira em 5 minutos por inatividade. Toque para continuar conectado.";
export const MENSAGEM_SESSAO_ESTENDIDA = "Sessão estendida com sucesso.";
export const MENSAGEM_SESSAO_INATIVIDADE =
  "Sua sessão expirou por inatividade. Por favor, acesse novamente.";
export const MENSAGEM_PERMISSAO_ALERTA =
  "Os alertas de expiração do sistema estão indisponíveis. Ative as notificações do FarmaUBS no Android.";

export type AcaoToqueAlerta = "renovar" | "expirada";

/**
 * [AC-MOB-07]: O alarme toca 5 minutos antes. Horário inválido ou já passado não é agendado.
 * @param expiresAt - ISO devolvido pela API.
 * @param agoraMs - Relógio do aparelho.
 * @returns Instante do alarme, em milissegundos, ou null.
 */
export function instanteAlerta(expiresAt: string, agoraMs: number): number | null {
  const fim = Date.parse(expiresAt);
  if (Number.isNaN(fim)) return null;
  const quando = fim - AVISO_ANTES_MS;
  if (quando <= agoraMs) return null;
  return quando;
}

/**
 * [AC-MOB-07]: Toque antes de expiresAt renova. No instante ou depois, a sessão acabou.
 * @param expiresAt - ISO gravado na notificação.
 * @param agoraMs - Relógio do aparelho.
 * @returns renovar ou expirada.
 */
export function acaoDoToque(expiresAt: string, agoraMs: number): AcaoToqueAlerta {
  const fim = Date.parse(expiresAt);
  if (Number.isNaN(fim) || agoraMs >= fim) return "expirada";
  return "renovar";
}

/**
 * [AC-MOB-07]: Lê o cabeçalho X-Session-Expires-At quando a data é válida.
 * @param valor - Valor do cabeçalho, ou null.
 * @returns ISO, ou null.
 */
export function lerExpiresAtHeader(valor: string | null): string | null {
  if (!valor || Number.isNaN(Date.parse(valor))) return null;
  return new Date(valor).toISOString();
}

/**
 * [AC-MOB-07]: Lê expiresAt do corpo de POST /api/v1/acesso/renovar.
 * @param data - JSON da API.
 * @returns ISO, ou null.
 */
export function lerRenovarSessao(data: unknown): string | null {
  if (!data || typeof data !== "object" || !("expiresAt" in data)) return null;
  const { expiresAt } = data as Partial<RenovarSessaoResponse>;
  if (typeof expiresAt !== "string" || Number.isNaN(Date.parse(expiresAt))) return null;
  return expiresAt;
}
