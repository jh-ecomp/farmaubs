export const REPOSITORIO_ESTOQUE_METRICAS_PORT = Symbol(
  "REPOSITORIO_ESTOQUE_METRICAS_PORT",
);

/** Consumo e saldo de um medicamento, já somados pelo repositório. */
export interface ConsumoProdutoAgregado {
  produtoId: string;
  saldoAtual: number;
  totalDispensado: number;
  diasApurados: number;
}

/** Contagem de lotes por faixa de validade, já agregada no banco. */
export interface ContagemLotesValidade {
  lotesVencidos: number;
  lotesValidadeMesAtual: number;
  lotesValidadeCurta90d: number;
}

export interface RepositorioEstoqueMetricasPort {
  obterTotais(ubsId: string): Promise<{
    totalMedicamentosAtivos: number;
    totalUnidadesFisicas: number;
  }>;
  listarConsumoPorProduto(
    ubsId: string,
    hoje: string,
  ): Promise<ConsumoProdutoAgregado[]>;
  contarLotesPorValidade(
    ubsId: string,
    hoje: string,
  ): Promise<ContagemLotesValidade>;
}
