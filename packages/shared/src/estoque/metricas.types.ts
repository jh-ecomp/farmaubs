/**
 * Resposta de GET /api/v1/estoque/metricas (ES-01, RF018, RF022, RF023).
 * Todos os totais referem-se a uma única UBS.
 */
export interface EstoqueMetricasResponseDto {
  /** Medicamentos ativos com ao menos um lote ativo na UBS. */
  totalMedicamentosAtivos: number;
  /** Soma de saldo_atual dos lotes ativos não vencidos. */
  totalUnidadesFisicas: number;
  /** Medicamentos com cobertura <= prazo CAF + margem, ou saldo zero. */
  itensRiscoRuptura: number;
  /** Lotes não vencidos com validade no mês corrente. */
  lotesValidadeMesAtual: number;
  /** Lotes não vencidos com validade em até 90 dias (inclui mês corrente). */
  lotesValidadeCurta90d: number;
  /** Lotes com validade anterior a hoje. */
  lotesVencidos: number;
  /** Instante do cálculo, ISO 8601 UTC. */
  calculadoEm: string;
}
