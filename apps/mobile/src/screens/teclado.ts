/**
 * [RE-MOB-02]: No Android a altura do teclado às vezes vem 0. O topo (screenY) ainda diz até onde ele cobre.
 */
export function alturaCobertaPeloTeclado(
  alturaJanela: number,
  alturaTela: number,
  teclado: { height: number; screenY: number },
): number {
  return Math.max(0, teclado.height, alturaJanela - teclado.screenY, alturaTela - teclado.screenY);
}
