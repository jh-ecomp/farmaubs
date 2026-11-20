/** Quanto a lista pode passar do fim antes de travar, em pixels. */
export const ELASTICO_MAX = 72;

/**
 * Deslocamento extra quando a lista já está no fim.
 * dy negativo é o dedo subindo, tentando passar do fim. O fator cai até zerar no limite.
 */
export function proximoElastico(atual: number, dy: number, noFim: boolean, max = ELASTICO_MAX): number {
  if (!noFim) return 0;
  if (dy < 0) {
    const fator = 0.35 * (1 - Math.min(1, Math.abs(atual) / max));
    return Math.max(-max, atual + dy * fator);
  }
  if (atual < 0) return Math.min(0, atual + dy * 0.35);
  return atual;
}
