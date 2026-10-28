import {
  classificarValidadeLote,
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
    const [totais, consumos, lotes] = await Promise.all([
      this.repo.obterTotais(ubsId),
      this.repo.listarConsumoPorProduto(ubsId),
      this.repo.listarLotesParaValidade(ubsId),
    ]);

    // Um produto sem dias apurados é tratado como consumo zero.
    const itensRiscoRuptura = consumos.filter((c) =>
      verificarRiscoRuptura({
        saldoAtual: c.saldoAtual,
        consumoMedioDiario:
          c.diasApurados > 0 ? c.totalDispensado / c.diasApurados : 0,
      }),
    ).length;

    let lotesValidadeMesAtual = 0;
    let lotesValidadeCurta90d = 0;
    let lotesVencidos = 0;

    // Lotes com saldo zero não geram alerta de validade.
    for (const lote of lotes.filter((l) => l.saldoAtual > 0)) {
      const c = classificarValidadeLote(lote.validade, hoje);
      if (c.vencido) lotesVencidos++;
      if (c.vencendoMesCorrente) lotesValidadeMesAtual++;
      if (c.validadeCurta90d) lotesValidadeCurta90d++;
    }

    return {
      totalMedicamentosAtivos: totais.totalMedicamentosAtivos,
      totalUnidadesFisicas: totais.totalUnidadesFisicas,
      itensRiscoRuptura,
      lotesValidadeMesAtual,
      lotesValidadeCurta90d,
      lotesVencidos,
      calculadoEm: agora.toISOString(),
    };
  }
}
