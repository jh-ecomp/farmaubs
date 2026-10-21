import { defineFeature, loadFeature } from "jest-cucumber";
import * as path from "path";
import type {
  LoteEntradaFefo,
  MedicamentoBuscaDto,
  SugestaoFefoResultado,
} from "@farmaubs/shared";
import { BuscarMedicamentosDispensacaoUseCase } from "./buscar-medicamentos-dispensacao.use-case";
import { ObterSugestaoLotesFefoUseCase } from "./obter-sugestao-lotes-fefo.use-case";
import { MedicamentoNaoEncontradoException } from "../../domain/errors/dispensacao-catalogo.errors";
import type { DispensacaoCatalogoRepositoryPort } from "../../domain/ports/dispensacao-catalogo.repository.port";

const feature = loadFeature(
  path.resolve(__dirname, "dispensacao-catalogo-fefo.feature"),
);

defineFeature(feature, (test) => {
  let buscarUseCase: BuscarMedicamentosDispensacaoUseCase;
  let fefoUseCase: ObterSugestaoLotesFefoUseCase;
  let catalogoRepoMock: jest.Mocked<DispensacaoCatalogoRepositoryPort>;

  const dataReferencia = new Date("2026-10-01T12:00:00.000Z");
  const medicamentoPadrao: MedicamentoBuscaDto = {
    id: "0194e43e-a6fb-7389-9a74-94c039755ea1",
    principioAtivo: "Amoxicilina 500mg",
    nomeComercial: "Amoxil",
    apresentacao: "Cápsula 500mg",
    categoria: "ANTIMICROBIANO",
    antimicrobiano: true,
    saldoTotalUbs: 150,
  };

  let catalogoMemoria: MedicamentoBuscaDto[] = [];
  let lotesMemoria: LoteEntradaFefo[] = [];
  let resultadoBusca: MedicamentoBuscaDto[] = [];
  let resultadoFefo: SugestaoFefoResultado | null = null;

  beforeEach(() => {
    catalogoMemoria = [];
    lotesMemoria = [];
    resultadoBusca = [];
    resultadoFefo = null;

    catalogoRepoMock = {
      buscarPorTermoEUnidade: jest.fn(async (termo: string) => {
        const t = termo.toLowerCase();
        return catalogoMemoria.filter(
          (m) =>
            m.principioAtivo.toLowerCase().includes(t) ||
            (m.nomeComercial ?? "").toLowerCase().includes(t) ||
            m.apresentacao.toLowerCase().includes(t),
        );
      }),
      buscarMedicamentoPorId: jest.fn(async () => medicamentoPadrao),
      listarLotesPorMedicamentoEUnidade: jest.fn(async () => lotesMemoria),
    };

    buscarUseCase = new BuscarMedicamentosDispensacaoUseCase(catalogoRepoMock);
    fefoUseCase = new ObterSugestaoLotesFefoUseCase(catalogoRepoMock);
  });

  test("Busca por fragmento de nome do princípio ativo", ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      /^que existem os medicamentos "(.*)" e "(.*)" cadastrados$/,
      (med1: string, med2: string) => {
        catalogoMemoria = [
          {
            id: "med-1",
            principioAtivo: med1,
            apresentacao: "Comprimido",
            categoria: "GERAL",
            antimicrobiano: false,
            saldoTotalUbs: 100,
          },
          {
            id: "med-2",
            principioAtivo: med2,
            apresentacao: "Cápsula",
            categoria: "ANTIMICROBIANO",
            antimicrobiano: true,
            saldoTotalUbs: 80,
          },
        ];
      },
    );

    when(/^o farmacêutico buscar pelo termo "(.*)"$/, async (termo: string) => {
      resultadoBusca = await buscarUseCase.execute(termo, "ubs-1");
    });

    then(
      /^o resultado deve conter exatamente (\d+) medicamento$/,
      (qtd: string) => {
        expect(resultadoBusca).toHaveLength(parseInt(qtd, 10));
      },
    );

    and(/^o nome retornado deve ser "(.*)"$/, (nomeEsperado: string) => {
      expect(resultadoBusca[0].principioAtivo).toBe(nomeEsperado);
      expect(resultadoBusca[0].requerDataReceita).toBe(true);
    });
  });

  test("Sugestão do lote com vencimento mais próximo (FEFO)", ({
    given,
    and,
    when,
    then,
  }) => {
    given(
      /^que a UBS possui o lote "(.*)" com vencimento em "(.*)" e saldo (\d+)$/,
      (numeroLote: string, dataValidade: string, saldo: string) => {
        lotesMemoria.push({
          id: `id-${numeroLote}`,
          numeroLote,
          dataValidade,
          saldoDisponivel: parseInt(saldo, 10),
        });
      },
    );

    and(
      /^possui o lote "(.*)" com vencimento em "(.*)" e saldo (\d+)$/,
      (numeroLote: string, dataValidade: string, saldo: string) => {
        lotesMemoria.push({
          id: `id-${numeroLote}`,
          numeroLote,
          dataValidade,
          saldoDisponivel: parseInt(saldo, 10),
        });
      },
    );

    when(
      "o caso de uso ObterSugestaoLotesFefo for executado para o medicamento",
      async () => {
        resultadoFefo = await fefoUseCase.execute(
          medicamentoPadrao.id,
          "ubs-1",
          dataReferencia,
        );
      },
    );

    then(/^o loteSugerido deve ser o "(.*)"$/, (loteEsperado: string) => {
      expect(resultadoFefo?.loteSugerido?.numeroLote).toBe(loteEsperado);
    });

    and(
      /^o lote "(.*)" deve ter sugeridoFefo marcado como verdadeiro$/,
      (loteEsperado: string) => {
        const lote = resultadoFefo?.lotesDisponiveis.find(
          (l) => l.numeroLote === loteEsperado,
        );
        expect(lote?.sugeridoFefo).toBe(true);
        const outros = resultadoFefo?.lotesDisponiveis.filter(
          (l) => l.numeroLote !== loteEsperado,
        );
        expect(outros?.every((l) => !l.sugeridoFefo)).toBe(true);
      },
    );
  });

  test("Descarte de lotes vencidos da sugestão de saída", ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      "que a UBS possui um lote com data de validade anterior à data de hoje",
      () => {
        lotesMemoria = [
          {
            id: "lote-vencido",
            numeroLote: "LOTE-EXP",
            dataValidade: "2026-09-10",
            saldoDisponivel: 40,
          },
        ];
      },
    );

    when("a consulta de lotes para dispensação for executada", async () => {
      resultadoFefo = await fefoUseCase.execute(
        medicamentoPadrao.id,
        "ubs-1",
        dataReferencia,
      );
    });

    then("o lote vencido não deve ser sugerido para a dispensa", () => {
      expect(resultadoFefo?.loteSugerido).toBeNull();
      expect(resultadoFefo?.lotesDisponiveis[0].sugeridoFefo).toBe(false);
    });

    and("deve ter a flag vencido como verdadeira", () => {
      expect(resultadoFefo?.lotesDisponiveis[0].vencido).toBe(true);
      expect(resultadoFefo?.lotesDisponiveis[0].alertaValidadeCurta).toBe(
        false,
      );
    });
  });
});

describe("Casos de borda de Busca e FEFO (Camada A)", () => {
  let buscarUseCase: BuscarMedicamentosDispensacaoUseCase;
  let fefoUseCase: ObterSugestaoLotesFefoUseCase;
  let catalogoRepoMock: jest.Mocked<DispensacaoCatalogoRepositoryPort>;

  const dataReferencia = new Date("2026-10-01T12:00:00.000Z");

  beforeEach(() => {
    catalogoRepoMock = {
      buscarPorTermoEUnidade: jest.fn(),
      buscarMedicamentoPorId: jest.fn(),
      listarLotesPorMedicamentoEUnidade: jest.fn(),
    };
    buscarUseCase = new BuscarMedicamentosDispensacaoUseCase(catalogoRepoMock);
    fefoUseCase = new ObterSugestaoLotesFefoUseCase(catalogoRepoMock);
  });

  it("deve retornar lista vazia quando o termo de busca estiver vazio", async () => {
    const res = await buscarUseCase.execute("   ", "ubs-1");
    expect(res).toEqual([]);
    expect(catalogoRepoMock.buscarPorTermoEUnidade).not.toHaveBeenCalled();
  });

  it("deve desempatar lotes com mesma data de validade usando created_at ASC e marcar alertaValidadeCurta <= 30 dias", async () => {
    catalogoRepoMock.buscarMedicamentoPorId.mockResolvedValue({
      id: "med-1",
      principioAtivo: "Dipirona",
      apresentacao: "500mg",
      categoria: "GERAL",
      antimicrobiano: false,
      saldoTotalUbs: 90,
    });
    catalogoRepoMock.listarLotesPorMedicamentoEUnidade.mockResolvedValue([
      {
        id: "l2",
        numeroLote: "LOTE-RECENTE",
        dataValidade: "2026-10-20",
        saldoDisponivel: 50,
        criadoEm: "2026-05-10T10:00:00Z",
      },
      {
        id: "l1",
        numeroLote: "LOTE-ANTIGO",
        dataValidade: "2026-10-20",
        saldoDisponivel: 40,
        criadoEm: "2026-02-01T10:00:00Z",
      },
    ]);

    const res = await fefoUseCase.execute("med-1", "ubs-1", dataReferencia);
    expect(res.loteSugerido?.numeroLote).toBe("LOTE-ANTIGO");
    expect(res.loteSugerido?.diasParaVencimento).toBe(19);
    expect(res.loteSugerido?.alertaValidadeCurta).toBe(true);
    expect(res.lotesDisponiveis[1].numeroLote).toBe("LOTE-RECENTE");
    expect(res.lotesDisponiveis[1].sugeridoFefo).toBe(false);
  });

  it("deve lançar MedicamentoNaoEncontradoException quando medicamento não existir", async () => {
    catalogoRepoMock.buscarMedicamentoPorId.mockResolvedValue(null);
    await expect(
      fefoUseCase.execute("id-inexistente", "ubs-1", dataReferencia),
    ).rejects.toBeInstanceOf(MedicamentoNaoEncontradoException);
  });
});
