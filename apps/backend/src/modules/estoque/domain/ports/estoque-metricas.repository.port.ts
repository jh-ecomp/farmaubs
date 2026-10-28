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

/** Dados de um lote necessários para classificar a validade. */
export interface LoteValidadeAgregado {
  loteId: string;
  validade: string; // AAAA-MM-DD
  saldoAtual: number;
}

export interface RepositorioEstoqueMetricasPort {
  obterTotais(ubsId: string): Promise<{
    totalMedicamentosAtivos: number;
    totalUnidadesFisicas: number;
  }>;
  listarConsumoPorProduto(ubsId: string): Promise<ConsumoProdutoAgregado[]>;
  listarLotesParaValidade(ubsId: string): Promise<LoteValidadeAgregado[]>;
}
