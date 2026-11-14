import { defineFeature, loadFeature } from "jest-cucumber";
import * as path from "path";
import type {
  DispensacaoItemListaDto,
  DispensacoesPaginadasResultado,
  EstornarDispensacaoResultado,
  ListarDispensacoesQuery,
} from "@farmaubs/shared";
import { ListarDispensacoesUseCase } from "./listar-dispensacoes.use-case";
import { ExportarDispensacoesXlsxUseCase } from "./exportar-dispensacoes-xlsx.use-case";
import { EstornarDispensacaoUseCase } from "./estornar-dispensacao.use-case";
import { XlsxGeradorPlanilhaService } from "../../infrastructure/services/xlsx-gerador-planilha.service";
import {
  DispensacaoJaEstornadaException,
  DispensacaoNaoEncontradaException,
  IntervaloDatasInvalidoException,
  MotivoEstornoInvalidoException,
} from "../../domain/errors/dispensacao.errors";
import type {
  DispensacaoParaEstornoInfo,
  FiltrosHistoricoResolvidos,
  HistoricoDispensacaoRepositoryPort,
} from "../../domain/ports/historico-dispensacao.repository.port";

const feature = loadFeature(
  path.resolve(__dirname, "historico-dispensacao.feature"),
);

defineFeature(feature, (test) => {
  let listarUseCase: ListarDispensacoesUseCase;
  let estornarUseCase: EstornarDispensacaoUseCase;
  let repoMock: jest.Mocked<HistoricoDispensacaoRepositoryPort>;

  const dataReferencia = new Date("2026-10-21T12:00:00.000Z"); // Hoje: 2026-10-21, Ontem: 2026-10-20
  let baseDispensacoes: (DispensacaoItemListaDto & { dataIso: string })[] = [];
  let queryAtual: ListarDispensacoesQuery = {};
  let resultadoListagem: DispensacoesPaginadasResultado | null = null;

  let dispensacaoEstornoMemoria: DispensacaoParaEstornoInfo | null = null;
  let saldosLotesMemoria: Map<string, number>;
  let resultadoEstorno: EstornarDispensacaoResultado | null = null;

  beforeEach(() => {
    baseDispensacoes = [];
    queryAtual = {};
    resultadoListagem = null;
    dispensacaoEstornoMemoria = null;
    saldosLotesMemoria = new Map();
    resultadoEstorno = null;

    repoMock = {
      listarFiltrado: jest.fn(async (f: FiltrosHistoricoResolvidos) => {
        const filtradas = baseDispensacoes.filter((d) => {
          if (d.dataIso < f.dataInicio || d.dataIso > f.dataFim) return false;
          if (
            f.pacienteTermo &&
            !d.pacienteCpf.includes(f.pacienteTermo) &&
            !d.pacienteNome.toLowerCase().includes(f.pacienteTermo.toLowerCase())
          ) {
            return false;
          }
          return true;
        });
        return {
          itens: filtradas,
          totalItens: filtradas.length,
        };
      }),
      buscarParaExportacao: jest.fn(),
      buscarDispensacaoParaEstorno: jest.fn(async () => dispensacaoEstornoMemoria),
      executarEstornoAtomico: jest.fn(async (params) => {
        if (dispensacaoEstornoMemoria) {
          dispensacaoEstornoMemoria.status = "estornada";
        }
        const itensDevolvidos = params.itens.map((i) => {
          const saldoAtual = saldosLotesMemoria.get(i.numeroLote) ?? 0;
          const novoSaldo = saldoAtual + i.quantidadeDispensada;
          saldosLotesMemoria.set(i.numeroLote, novoSaldo);
          return {
            loteId: i.loteId,
            numeroLote: i.numeroLote,
            quantidadeRestituida: i.quantidadeDispensada,
            novoSaldoLote: novoSaldo,
          };
        });
        return {
          id: params.dispensacaoId,
          status: "estornada",
          estornadoEm: dataReferencia,
          motivoEstorno: params.motivoEstorno,
          itensDevolvidos,
        };
      }),
    };

    listarUseCase = new ListarDispensacoesUseCase(repoMock);
    estornarUseCase = new EstornarDispensacaoUseCase(repoMock);
  });

  test("Aplicação do filtro padrão temporal de ontem e hoje", ({
    given,
    when,
    then,
    and,
  }) => {
    given("que existem dispensas realizadas há 5 dias, ontem e hoje", () => {
      baseDispensacoes = [
        {
          id: "disp-5dias",
          numeroAtendimento: "DISP-01",
          dataAtendimento: "2026-10-16T10:00:00Z",
          dataIso: "2026-10-16",
          status: "concluida",
          pacienteNome: "Ana",
          pacienteCpf: "11111111111",
          pacienteCns: "123456789012341",
          dispensadorNome: "Farm",
          totalItens: 1,
          medicamentosResumo: "Dipirona (10)",
        },
        {
          id: "disp-ontem",
          numeroAtendimento: "DISP-02",
          dataAtendimento: "2026-10-20T15:00:00Z",
          dataIso: "2026-10-20",
          status: "concluida",
          pacienteNome: "Bruno",
          pacienteCpf: "22222222222",
          pacienteCns: "123456789012342",
          dispensadorNome: "Farm",
          totalItens: 1,
          medicamentosResumo: "Paracetamol (20)",
        },
        {
          id: "disp-hoje",
          numeroAtendimento: "DISP-03",
          dataAtendimento: "2026-10-21T09:00:00Z",
          dataIso: "2026-10-21",
          status: "concluida",
          pacienteNome: "Carla",
          pacienteCpf: "33333333333",
          pacienteCns: "123456789012343",
          dispensadorNome: "Farm",
          totalItens: 1,
          medicamentosResumo: "Losartana (30)",
        },
      ];
    });

    when(
      "o caso de uso ListarDispensacoesUseCase for executado sem informar datas",
      async () => {
        resultadoListagem = await listarUseCase.execute(
          {},
          "ubs-1",
          dataReferencia,
        );
      },
    );

    then(
      "o resultado deve conter apenas as dispensas realizadas entre ontem e hoje",
      () => {
        expect(resultadoListagem?.itens).toHaveLength(2);
        expect(resultadoListagem?.itens.map((i) => i.id)).toEqual([
          "disp-ontem",
          "disp-hoje",
        ]);
      },
    );

    and(
      "as datas efetivas retornadas devem corresponder a ontem e hoje",
      () => {
        expect(resultadoListagem?.dataInicioEfetiva).toBe("2026-10-20");
        expect(resultadoListagem?.dataFimEfetiva).toBe("2026-10-21");
      },
    );
  });

  test("Filtro por range customizado de datas e identificação de paciente", ({
    given,
    and,
    when,
    then,
  }) => {
    given(
      /^que o usuário define o período de "(.*)" até "(.*)"$/,
      (inicio: string, fim: string) => {
        queryAtual.dataInicio = inicio;
        queryAtual.dataFim = fim;
        baseDispensacoes = [
          {
            id: "disp-set-alvo",
            numeroAtendimento: "DISP-SET-1",
            dataAtendimento: "2026-09-15T10:00:00Z",
            dataIso: "2026-09-15",
            status: "concluida",
            pacienteNome: "Maria Souza",
            pacienteCpf: "12345678909",
            pacienteCns: "123456789012345",
            dispensadorNome: "Farm",
            totalItens: 1,
            medicamentosResumo: "Amoxicilina (21)",
          },
          {
            id: "disp-set-outro",
            numeroAtendimento: "DISP-SET-2",
            dataAtendimento: "2026-09-18T10:00:00Z",
            dataIso: "2026-09-18",
            status: "concluida",
            pacienteNome: "Outro Paciente",
            pacienteCpf: "98765432100",
            pacienteCns: "123456789012349",
            dispensadorNome: "Farm",
            totalItens: 1,
            medicamentosResumo: "Dipirona (10)",
          },
          {
            id: "disp-out-alvo",
            numeroAtendimento: "DISP-OUT-1",
            dataAtendimento: "2026-10-05T10:00:00Z",
            dataIso: "2026-10-05",
            status: "concluida",
            pacienteNome: "Maria Souza",
            pacienteCpf: "12345678909",
            pacienteCns: "123456789012345",
            dispensadorNome: "Farm",
            totalItens: 1,
            medicamentosResumo: "Losartana (30)",
          },
        ];
      },
    );

    and(/^busca pelo CPF "(.*)"$/, (cpf: string) => {
      queryAtual.pacienteTermo = cpf;
    });

    when("o caso de uso de listagem for executado", async () => {
      resultadoListagem = await listarUseCase.execute(
        queryAtual,
        "ubs-1",
        dataReferencia,
      );
    });

    then(
      "apenas os atendimentos do paciente no mês de setembro devem ser retornados",
      () => {
        expect(resultadoListagem?.itens).toHaveLength(1);
        expect(resultadoListagem?.itens[0].id).toBe("disp-set-alvo");
        expect(resultadoListagem?.dataInicioEfetiva).toBe("2026-09-01");
        expect(resultadoListagem?.dataFimEfetiva).toBe("2026-09-30");
      },
    );
  });

  test("Estorno de atendimento com devolução de saldo ao lote", ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      /^uma dispensação com status "(.*)" que retirou (\d+) unidades do lote "(.*)"$/,
      (status: string, qtd: string, numeroLote: string) => {
        saldosLotesMemoria.set(numeroLote, 50);
        dispensacaoEstornoMemoria = {
          id: "disp-estornar-1",
          unidadeId: "ubs-1",
          status: status as "concluida" | "estornada",
          itens: [
            {
              loteId: `id-${numeroLote}`,
              numeroLote,
              quantidadeDispensada: parseInt(qtd, 10),
            },
          ],
        };
      },
    );

    when(
      /^o farmacêutico solicitar o estorno com motivo "(.*)"$/,
      async (motivo: string) => {
        resultadoEstorno = await estornarUseCase.execute(
          "disp-estornar-1",
          { motivoEstorno: motivo },
          { unidadeId: "ubs-1", estornadoPorId: "user-1" },
        );
      },
    );

    then(/^o status da dispensação deve mudar para "(.*)"$/, (status: string) => {
      expect(resultadoEstorno?.status).toBe(status);
      expect(dispensacaoEstornoMemoria?.status).toBe(status);
    });

    and(
      /^o saldo do lote "(.*)" deve ser incrementado em (\d+) unidades$/,
      (numeroLote: string, qtd: string) => {
        const esperado = 50 + parseInt(qtd, 10);
        expect(saldosLotesMemoria.get(numeroLote)).toBe(esperado);
        expect(resultadoEstorno?.itensDevolvidos[0].novoSaldoLote).toBe(
          esperado,
        );
      },
    );
  });
});

describe("Casos de borda de Histórico, Exportação XLSX e Estorno (Camada A)", () => {
  let listarUseCase: ListarDispensacoesUseCase;
  let exportarUseCase: ExportarDispensacoesXlsxUseCase;
  let estornarUseCase: EstornarDispensacaoUseCase;
  let repoMock: jest.Mocked<HistoricoDispensacaoRepositoryPort>;
  const geradorPlanilha = new XlsxGeradorPlanilhaService();
  const dataReferencia = new Date("2026-10-21T12:00:00.000Z");

  beforeEach(() => {
    repoMock = {
      listarFiltrado: jest.fn(),
      buscarParaExportacao: jest.fn(),
      buscarDispensacaoParaEstorno: jest.fn(),
      executarEstornoAtomico: jest.fn(),
    };
    listarUseCase = new ListarDispensacoesUseCase(repoMock);
    exportarUseCase = new ExportarDispensacoesXlsxUseCase(
      repoMock,
      geradorPlanilha,
    );
    estornarUseCase = new EstornarDispensacaoUseCase(repoMock);
  });

  it("deve rejeitar intervalo com dataFim anterior a dataInicio ou maior que 365 dias", async () => {
    await expect(
      listarUseCase.execute(
        { dataInicio: "2026-10-20", dataFim: "2026-10-10" },
        "ubs-1",
        dataReferencia,
      ),
    ).rejects.toBeInstanceOf(IntervaloDatasInvalidoException);

    await expect(
      listarUseCase.execute(
        { dataInicio: "2025-01-01", dataFim: "2026-06-01" },
        "ubs-1",
        dataReferencia,
      ),
    ).rejects.toBeInstanceOf(IntervaloDatasInvalidoException);
  });

  it("deve gerar arquivo binário .xlsx válido com assinatura PK (ZIP OpenXML) e nome padronizado", async () => {
    repoMock.buscarParaExportacao.mockResolvedValue([
      {
        dataHoraAtendimento: "2026-10-21T10:00:00.000Z",
        pacienteNome: "Carlos Silva",
        pacienteCpfFormatado: "123.456.789-09",
        pacienteCns: "123456789012345",
        medicamentoApresentacao: "Dipirona 500mg Comprimido",
        categoria: "ANALGESICO",
        numeroLote: "LOT-01",
        dataValidadeLote: "2027-05-01",
        quantidadeDispensada: 20,
        posologia: "1 comp 8/8h",
        dispensadorNome: "Dra. Beatriz",
        statusAtendimento: "concluida",
      },
    ]);

    const res = await exportarUseCase.execute({}, "ubs-centro", dataReferencia);
    expect(res.nomeArquivo).toBe(
      "dispensacoes_ubs_ubs-centro_2026-10-20_2026-10-21.xlsx",
    );
    expect(res.contentType).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(res.totalLinhas).toBe(1);
    expect(res.buffer.subarray(0, 2).toString("ascii")).toBe("PK");
    expect(res.buffer.toString("utf8")).toContain("Carlos Silva");
    expect(res.buffer.toString("utf8")).toContain("123.456.789-09");
  });

  it("deve rejeitar estorno com motivo menor que 10 caracteres, dispensação inexistente ou já estornada", async () => {
    await expect(
      estornarUseCase.execute(
        "disp-1",
        { motivoEstorno: "curto" },
        { unidadeId: "ubs-1", estornadoPorId: "user-1" },
      ),
    ).rejects.toBeInstanceOf(MotivoEstornoInvalidoException);

    repoMock.buscarDispensacaoParaEstorno.mockResolvedValue(null);
    await expect(
      estornarUseCase.execute(
        "disp-inexistente",
        { motivoEstorno: "Motivo válido com mais de dez caracteres" },
        { unidadeId: "ubs-1", estornadoPorId: "user-1" },
      ),
    ).rejects.toBeInstanceOf(DispensacaoNaoEncontradaException);

    repoMock.buscarDispensacaoParaEstorno.mockResolvedValue({
      id: "disp-1",
      unidadeId: "ubs-1",
      status: "estornada",
      itens: [],
    });
    await expect(
      estornarUseCase.execute(
        "disp-1",
        { motivoEstorno: "Motivo válido com mais de dez caracteres" },
        { unidadeId: "ubs-1", estornadoPorId: "user-1" },
      ),
    ).rejects.toBeInstanceOf(DispensacaoJaEstornadaException);
  });
});

