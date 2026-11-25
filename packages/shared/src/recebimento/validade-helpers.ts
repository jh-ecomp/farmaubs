/**
 * [RF024]: Utilitários puros para validação de datas de validade de lotes de medicamentos.
 */

import { formatarDataCivilBrasil } from "../dispensacao/data-helpers";

export type StatusValidadeRecebimento = "VENCIDO" | "VALIDADE_CURTA" | "NORMAL";

/**
 * Calcula a quantidade de dias corridos entre a data de referência e a validade do lote no fuso America/Sao_Paulo.
 * @param dataValidade - Data de expiração (string YYYY-MM-DD ou Date).
 * @param dataReferencia - Data atual base para cálculo (padrão: hoje no fuso brasileiro).
 * @returns Quantidade de dias (inteiro, negativo se já expirado).
 */
export function calcularDiasAteValidade(
  dataValidade: string | Date,
  dataReferencia: Date = new Date(),
): number {
  const validadeIso =
    typeof dataValidade === "string" && /^\d{4}-\d{2}-\d{2}/.test(dataValidade)
      ? dataValidade.slice(0, 10)
      : formatarDataCivilBrasil(new Date(dataValidade));
  const referenciaIso = formatarDataCivilBrasil(dataReferencia);

  const dVal = new Date(`${validadeIso}T00:00:00Z`);
  const dRef = new Date(`${referenciaIso}T00:00:00Z`);

  const diffMs = dVal.getTime() - dRef.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Avalia se o lote está vencido ou possui validade curta (< 180 dias / 6 meses) conforme RF024.
 * @param dataValidade - Data de expiração informada.
 * @param dataReferencia - Data base para avaliação.
 * @returns Status da validade.
 */
export function validarValidadeRecebimento(
  dataValidade: string | Date,
  dataReferencia: Date = new Date(),
): {
  vencido: boolean;
  validadeCurta: boolean;
  diasRestantes: number;
} {
  const diasRestantes = calcularDiasAteValidade(dataValidade, dataReferencia);
  const vencido = diasRestantes <= 0;
  const validadeCurta = !vencido && diasRestantes < 180;

  return {
    vencido,
    validadeCurta,
    diasRestantes,
  };
}

/**
 * Classifica o status da data de validade no momento do recebimento físico.
 * @param dataValidade - Data de validade do lote (string YYYY-MM-DD ou Date).
 * @param dataReferencia - Data de referência para comparação (padrão: hoje).
 * @returns 'VENCIDO' (<= 0 dias), 'VALIDADE_CURTA' (< 180 dias) ou 'NORMAL' (>= 180 dias).
 */
export function classificarValidadeRecebimento(
  dataValidade: string | Date,
  dataReferencia: Date = new Date(),
): StatusValidadeRecebimento {
  const { vencido, validadeCurta } = validarValidadeRecebimento(dataValidade, dataReferencia);
  if (vencido) return "VENCIDO";
  if (validadeCurta) return "VALIDADE_CURTA";
  return "NORMAL";
}
