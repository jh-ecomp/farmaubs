import {
  verificarRiscoRuptura,
  type EstoqueMetricasResponseDto,
} from "@farmaubs/shared";
import type { RepositorioEstoqueMetricasPort } from "../../domain/ports/estoque-metricas.repository.port";

export class ObterMetricasEstoqueUseCase {
  constructor(private readonly repo: RepositorioEstoqueMetricasPort) {}

  /**
   * [RF018 / RF022 / RF023]: Consolida totais, risco de ruptura e validade dos lotes de uma UBS.
   * @param ubsId - UBS consultada.
   * @param hoje - Data de referência 'AAAA-MM-DD' no fuso da UBS.
   * @param agora - Instante do cálculo (injetável para teste).
   * @returns EstoqueMetricasResponseDto com os indicadores consolidados.
   */
  async executar(
    ubsId: string,
    hoje: string,
    agora: Date = new Date(),
  ): Promise<EstoqueMetricasResponseDto> {
    const [totais, consumos, validade] = await Promise.all([
      this.repo.obterTotais(ubsId),
      this.repo.listarConsumoPorProduto(ubsId, hoje),
      this.repo.contarLotesPorValidade(ubsId, hoje),
    ]);

    // Um produto sem dias apurados é tratado como consumo zero.
    const itensRiscoRuptura = consumos.filter((c) =>
      verificarRiscoRuptura({
        saldoAtual: c.saldoAtual,
        consumoMedioDiario:
          c.diasApurados > 0 ? c.totalDispensado / c.diasApurados : 0,
      }),
    ).length;

    return {
      totalMedicamentosAtivos: totais.totalMedicamentosAtivos,
      totalUnidadesFisicas: totais.totalUnidadesFisicas,
      itensRiscoRuptura,
      lotesValidadeMesAtual: validade.lotesValidadeMesAtual,
      lotesValidadeCurta90d: validade.lotesValidadeCurta90d,
      lotesVencidos: validade.lotesVencidos,
      calculadoEm: agora.toISOString(),
    };
  }
}
