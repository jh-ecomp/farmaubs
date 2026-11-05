import {
  MOTIVOS_AJUSTE_ENTRADA,
  MOTIVOS_AJUSTE_SAIDA,
  type TipoOperacaoAjuste,
} from "./ajustes.types";

export const JUSTIFICATIVA_AJUSTE_MIN = 10;
export const JUSTIFICATIVA_AJUSTE_MIN_OUTRO = 20;
export const JUSTIFICATIVA_AJUSTE_MAX = 500;

/**
 * [RF009 / RF011]: Verifica se o motivo é permitido para o tipo de operação.
 * @param tipo - ENTRADA ou SAIDA.
 * @param motivo - Código do motivo informado.
 * @returns true se o motivo pertence ao catálogo do tipo.
 */
export function motivoCompativelComTipo(
  tipo: TipoOperacaoAjuste,
  motivo: string,
): boolean {
  const permitidos: readonly string[] =
    tipo === "ENTRADA" ? MOTIVOS_AJUSTE_ENTRADA : MOTIVOS_AJUSTE_SAIDA;
  return permitidos.includes(motivo);
}

/**
 * [RF028]: Valida o tamanho da justificativa após trim (mín. 10; mín. 20 para OUTRO; máx. 500).
 * @param motivo - Código do motivo informado.
 * @param justificativa - Texto livre informado pelo farmacêutico.
 * @returns Mensagem de erro ou null quando válida.
 */
export function validarJustificativaAjuste(
  motivo: string,
  justificativa: string | undefined | null,
): string | null {
  const texto = (justificativa ?? "").trim();
  const minimo =
    motivo === "OUTRO"
      ? JUSTIFICATIVA_AJUSTE_MIN_OUTRO
      : JUSTIFICATIVA_AJUSTE_MIN;
  if (texto.length < minimo) {
    return `A justificativa deve conter no mínimo ${minimo} caracteres`;
  }
  if (texto.length > JUSTIFICATIVA_AJUSTE_MAX) {
    return `A justificativa deve conter no máximo ${JUSTIFICATIVA_AJUSTE_MAX} caracteres`;
  }
  return null;
}

/**
 * [RF011]: Checa se o saldo físico comporta a baixa solicitada.
 * @param saldoAtual - Saldo atual do lote.
 * @param quantidade - Quantidade a baixar.
 * @returns true se saldoAtual >= quantidade.
 */
export function saldoSuficiente(
  saldoAtual: number,
  quantidade: number,
): boolean {
  return saldoAtual >= quantidade;
}
