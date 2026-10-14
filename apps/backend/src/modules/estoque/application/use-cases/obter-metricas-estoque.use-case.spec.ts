import { ObterMetricasEstoqueUseCase } from "./obter-metricas-estoque.use-case";
import type { RepositorioEstoqueMetricasPort } from "../../domain/ports/estoque-metricas.repository.port";

function criarFake(
  parcial: Partial<RepositorioEstoqueMetricasPort> = {},
): RepositorioEstoqueMetricasPort {
  return {
    obterTotais: async () => ({
      totalMedicamentosAtivos: 0,
      totalUnidadesFisicas: 0,
    }),
    listarConsumoPorProduto: async () => [],
    listarLotesParaValidade: async () => [],
    ...parcial,
  };
}

describe("ObterMetricasEstoqueUseCase", () => {
  const hoje = "2026-10-13";
  const agora = new Date("2026-10-13T15:00:00.000Z");

  it("repassa os totais e a data do cálculo", async () => {
    const useCase = new ObterMetricasEstoqueUseCase(
      criarFake({
        obterTotais: async () => ({
          totalMedicamentosAtivos: 85,
          totalUnidadesFisicas: 12450,
        }),
      }),
    );
    const r = await useCase.executar("ubs-1", hoje, agora);
    expect(r.totalMedicamentosAtivos).toBe(85);
    expect(r.totalUnidadesFisicas).toBe(12450);
    expect(r.calculadoEm).toBe("2026-10-13T15:00:00.000Z");
  });

  it("conta produtos em risco de ruptura", async () => {
    const useCase = new ObterMetricasEstoqueUseCase(
      criarFake({
        listarConsumoPorProduto: async () => [
          {
            produtoId: "a",
            saldoAtual: 60,
            totalDispensado: 90,
            diasApurados: 30,
          }, // 20 dias: risco
          {
            produtoId: "b",
            saldoAtual: 61,
            totalDispensado: 90,
            diasApurados: 30,
          }, // acima: ok
          {
            produtoId: "c",
            saldoAtual: 0,
            totalDispensado: 0,
            diasApurados: 30,
          }, // zero: risco
          {
            produtoId: "d",
            saldoAtual: 10,
            totalDispensado: 0,
            diasApurados: 0,
          }, // sem dados: ok
        ],
      }),
    );
    const r = await useCase.executar("ubs-1", hoje, agora);
    expect(r.itensRiscoRuptura).toBe(2);
  });

  it("classifica lotes por validade e ignora lotes com saldo zero", async () => {
    const useCase = new ObterMetricasEstoqueUseCase(
      criarFake({
        listarLotesParaValidade: async () => [
          { loteId: "1", validade: "2026-10-05", saldoAtual: 10 }, // vencido
          { loteId: "2", validade: "2026-10-20", saldoAtual: 10 }, // mês corrente + 90d
          { loteId: "3", validade: "2026-12-01", saldoAtual: 10 }, // só 90d
          { loteId: "4", validade: "2027-06-01", saldoAtual: 10 }, // fora
          { loteId: "5", validade: "2026-10-20", saldoAtual: 0 }, // saldo zero: ignorado
        ],
      }),
    );
    const r = await useCase.executar("ubs-1", hoje, agora);
    expect(r.lotesVencidos).toBe(1);
    expect(r.lotesValidadeMesAtual).toBe(1);
    expect(r.lotesValidadeCurta90d).toBe(2);
  });

  it("respeita as fronteiras de validade (hoje, ontem, 90 e 91 dias)", async () => {
    const useCase = new ObterMetricasEstoqueUseCase(
      criarFake({
        listarLotesParaValidade: async () => [
          { loteId: "1", validade: "2026-10-12", saldoAtual: 10 }, // ontem: vencido
          { loteId: "2", validade: "2026-10-13", saldoAtual: 10 }, // hoje: não vencido
          { loteId: "3", validade: "2027-01-11", saldoAtual: 10 }, // dia 90: dentro
          { loteId: "4", validade: "2027-01-12", saldoAtual: 10 }, // dia 91: fora
        ],
      }),
    );
    const r = await useCase.executar("ubs-1", hoje, agora);
    expect(r.lotesVencidos).toBe(1);
    expect(r.lotesValidadeMesAtual).toBe(1);
    expect(r.lotesValidadeCurta90d).toBe(2);
  });

  it("consulta o repositório com a UBS informada", async () => {
    const ubsRecebidas: string[] = [];
    const useCase = new ObterMetricasEstoqueUseCase(
      criarFake({
        obterTotais: async (ubsId) => {
          ubsRecebidas.push(ubsId);
          return { totalMedicamentosAtivos: 0, totalUnidadesFisicas: 0 };
        },
      }),
    );
    await useCase.executar("ubs-xyz", hoje, agora);
    expect(ubsRecebidas).toEqual(["ubs-xyz"]);
  });
});
