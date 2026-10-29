/**
 * [RF024]: Utilitários puros para validação de datas de validade de lotes de medicamentos.
 */

/**
 * Calcula a quantidade de dias corridos entre a data de referência e a validade do lote.
 * @param dataValidade - Data de expiração (string YYYY-MM-DD ou Date).
 * @param dataReferencia - Data atual base para cálculo (padrão: hoje UTC).
 * @returns Quantidade de dias (inteiro, negativo se já expirado).
 */
export function calcularDiasAteValidade(
  dataValidade: string | Date,
  dataReferencia: Date = new Date(),
): number {
  const dVal = typeof dataValidade === "string" ? new Date(dataValidade) : dataValidade;
  const dRef = new Date(dataReferencia);

  // Normaliza horas para comparar apenas dia civil
  dVal.setUTCHours(0, 0, 0, 0);
  dRef.setUTCHours(0, 0, 0, 0);

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
