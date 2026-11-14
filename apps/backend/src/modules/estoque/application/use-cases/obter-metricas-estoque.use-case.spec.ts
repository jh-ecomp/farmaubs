import { ObterMetricasEstoqueUseCase } from "./obter-metricas-estoque.use-case";
import type {
  ConsumoProdutoAgregado,
  ContagemLotesValidade,
  RepositorioEstoqueMetricasPort,
} from "../../domain/ports/estoque-metricas.repository.port";

const UBS_ID = "11111111-1111-4111-8111-111111111111";
const HOJE = "2026-10-30";
const AGORA = new Date("2026-10-30T12:00:00.000Z");

function criarRepoFake(
  parcial: {
    totais?: { totalMedicamentosAtivos: number; totalUnidadesFisicas: number };
    consumos?: ConsumoProdutoAgregado[];
    validade?: ContagemLotesValidade;
  } = {},
): jest.Mocked<RepositorioEstoqueMetricasPort> {
  return {
    obterTotais: jest
      .fn()
      .mockResolvedValue(
        parcial.totais ?? {
          totalMedicamentosAtivos: 0,
          totalUnidadesFisicas: 0,
        },
      ),
    listarConsumoPorProduto: jest
      .fn()
      .mockResolvedValue(parcial.consumos ?? []),
    contarLotesPorValidade: jest.fn().mockResolvedValue(
      parcial.validade ?? {
        lotesVencidos: 0,
        lotesValidadeMesAtual: 0,
        lotesValidadeCurta90d: 0,
      },
    ),
  };
}

/** Consumo de 5/dia (150 em 30 dias) com o saldo informado. */
function produto(id: string, saldoAtual: number): ConsumoProdutoAgregado {
  return { produtoId: id, saldoAtual, totalDispensado: 150, diasApurados: 30 };
}

describe("ObterMetricasEstoqueUseCase", () => {
  it("repassa totais e contagens de validade vindos do repositório", async () => {
    const repo = criarRepoFake({
      totais: { totalMedicamentosAtivos: 85, totalUnidadesFisicas: 12450 },
      validade: {
        lotesVencidos: 2,
        lotesValidadeMesAtual: 6,
        lotesValidadeCurta90d: 11,
      },
    });

    const r = await new ObterMetricasEstoqueUseCase(repo).executar(
      UBS_ID,
      HOJE,
      AGORA,
    );

    expect(r).toEqual({
      totalMedicamentosAtivos: 85,
      totalUnidadesFisicas: 12450,
      itensRiscoRuptura: 0,
      lotesValidadeMesAtual: 6,
      lotesValidadeCurta90d: 11,
      lotesVencidos: 2,
      calculadoEm: "2026-10-30T12:00:00.000Z",
    });
  });

  it("consulta o repositório sempre com o ubsId e a data de referência", async () => {
    const repo = criarRepoFake();

    await new ObterMetricasEstoqueUseCase(repo).executar(UBS_ID, HOJE, AGORA);

    expect(repo.obterTotais).toHaveBeenCalledWith(UBS_ID);
    expect(repo.listarConsumoPorProduto).toHaveBeenCalledWith(UBS_ID, HOJE);
    expect(repo.contarLotesPorValidade).toHaveBeenCalledWith(UBS_ID, HOJE);
  });

  it("classifica risco quando a cobertura é exatamente 20 dias (limite inclusivo)", async () => {
    // saldo 100 / CMD 5 = 20 dias
    const repo = criarRepoFake({ consumos: [produto("a", 100)] });

    const r = await new ObterMetricasEstoqueUseCase(repo).executar(
      UBS_ID,
      HOJE,
      AGORA,
    );

    expect(r.itensRiscoRuptura).toBe(1);
  });

  it("não classifica risco quando a cobertura é de 21 dias", async () => {
    // saldo 105 / CMD 5 = 21 dias
    const repo = criarRepoFake({ consumos: [produto("a", 105)] });

    const r = await new ObterMetricasEstoqueUseCase(repo).executar(
      UBS_ID,
      HOJE,
      AGORA,
    );

    expect(r.itensRiscoRuptura).toBe(0);
  });

  it("conta ruptura imediata quando o saldo é zero e há consumo", async () => {
    const repo = criarRepoFake({ consumos: [produto("a", 0)] });

    const r = await new ObterMetricasEstoqueUseCase(repo).executar(
      UBS_ID,
      HOJE,
      AGORA,
    );

    expect(r.itensRiscoRuptura).toBe(1);
  });

  it("soma apenas os produtos em risco entre vários", async () => {
    const repo = criarRepoFake({
      consumos: [produto("a", 10), produto("b", 500), produto("c", 100)],
    });

    const r = await new ObterMetricasEstoqueUseCase(repo).executar(
      UBS_ID,
      HOJE,
      AGORA,
    );

    expect(r.itensRiscoRuptura).toBe(2); // a (2 dias) e c (20 dias)
  });

  it("não quebra nem marca risco por divisão quando diasApurados é zero", async () => {
    const repo = criarRepoFake({
      consumos: [
        { produtoId: "a", saldoAtual: 50, totalDispensado: 0, diasApurados: 0 },
      ],
    });

    const r = await new ObterMetricasEstoqueUseCase(repo).executar(
      UBS_ID,
      HOJE,
      AGORA,
    );

    expect(Number.isFinite(r.itensRiscoRuptura)).toBe(true);
    expect(r.itensRiscoRuptura).toBe(0);
  });
});
