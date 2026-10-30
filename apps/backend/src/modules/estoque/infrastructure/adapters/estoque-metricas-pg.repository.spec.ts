import {
  EstoqueMetricasPgRepository,
  JANELA_CONSUMO_DIAS,
  LIMITE_VALIDADE_CURTA_DIAS,
} from "./estoque-metricas-pg.repository";

const UBS_ID = "11111111-1111-4111-8111-111111111111";
const HOJE = "2026-10-30";

function criar(retorno: unknown[]) {
  const query = jest.fn().mockResolvedValue(retorno);
  const tx = { getManager: () => ({ query }) };
  const repo = new EstoqueMetricasPgRepository(tx as never);
  return { repo, query };
}

describe("EstoqueMetricasPgRepository", () => {
  it("obterTotais filtra por ubs_id e converte strings numéricas", async () => {
    const { repo, query } = criar([
      { total_medicamentos_ativos: "85", total_unidades_fisicas: "12450" },
    ]);

    const r = await repo.obterTotais(UBS_ID);

    expect(r).toEqual({
      totalMedicamentosAtivos: 85,
      totalUnidadesFisicas: 12450,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("l.ubs_id = $1"),
      [UBS_ID],
    );
  });

  it("obterTotais retorna zeros quando não há linhas", async () => {
    const { repo } = criar([]);
    expect(await repo.obterTotais(UBS_ID)).toEqual({
      totalMedicamentosAtivos: 0,
      totalUnidadesFisicas: 0,
    });
  });

  it("listarConsumoPorProduto passa ubs, data e janela e mapeia as linhas", async () => {
    const { repo, query } = criar([
      {
        produto_id: "p1",
        saldo_atual: 0,
        total_dispensado: "150",
        dias_apurados: "30",
      },
    ]);

    const r = await repo.listarConsumoPorProduto(UBS_ID, HOJE);

    expect(r).toEqual([
      {
        produtoId: "p1",
        saldoAtual: 0,
        totalDispensado: 150,
        diasApurados: 30,
      },
    ]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("d.status = 'concluida'"),
      [UBS_ID, HOJE, JANELA_CONSUMO_DIAS],
    );
  });

  it("contarLotesPorValidade passa ubs, data e limite de 90 dias", async () => {
    const { repo, query } = criar([
      {
        lotes_vencidos: 2,
        lotes_validade_mes_atual: "6",
        lotes_validade_curta_90d: "11",
      },
    ]);

    const r = await repo.contarLotesPorValidade(UBS_ID, HOJE);

    expect(r).toEqual({
      lotesVencidos: 2,
      lotesValidadeMesAtual: 6,
      lotesValidadeCurta90d: 11,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("COUNT(*) FILTER"),
      [UBS_ID, HOJE, LIMITE_VALIDADE_CURTA_DIAS],
    );
  });
});
