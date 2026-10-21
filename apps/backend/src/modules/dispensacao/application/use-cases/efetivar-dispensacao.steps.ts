import { defineFeature, loadFeature } from "jest-cucumber";
import * as path from "path";
import type {
  DispensacaoEfetivadaResultado,
  EfetivarDispensacaoRequest,
} from "@farmaubs/shared";
import { EfetivarDispensacaoUseCase } from "./efetivar-dispensacao.use-case";
import {
  LoteNaoPertenceAUbsException,
  ReceitaAntimicrobianoVencidaException,
  SaldoInsuficienteLoteException,
} from "../../domain/errors/dispensacao.errors";
import { CpfInvalidoException } from "../../domain/errors/paciente.errors";
import type {
  DispensacaoRepositoryPort,
  LoteBloqueadoDispensacao,
} from "../../domain/ports/dispensacao.repository.port";

const feature = loadFeature(
  path.resolve(__dirname, "efetivar-dispensacao.feature"),
);

defineFeature(feature, (test) => {
  let useCase: EfetivarDispensacaoUseCase;
  let repoMock: jest.Mocked<DispensacaoRepositoryPort>;

  const dataReferencia = new Date("2026-10-21T12:00:00.000Z");
  const contextoPadrao = {
    municipioId: "0194e43e-a6fb-7389-9a74-94c039755ef0",
    unidadeId: "0194e43e-a6fb-7389-9a74-94c039755ef1",
    dispensadorId: "0194e43e-a6fb-7389-9a74-94c039755ef2",
    dispensadorNome: "Farmacêutico Responsável",
  };

  let lotesMemoria: Map<string, LoteBloqueadoDispensacao>;
  let payload: EfetivarDispensacaoRequest;
  let resultado: DispensacaoEfetivadaResultado | null = null;
  let erroCapturado: Error | null = null;

  beforeEach(() => {
    lotesMemoria = new Map();
    resultado = null;
    erroCapturado = null;

    payload = {
      paciente: {
        cns: "123456789012345",
        cpf: "12345678909",
        nomeCompleto: "Carlos Silva",
        dataNascimento: "1990-01-01",
      },
      itens: [],
    };

    repoMock = {
      obterOuCriarPaciente: jest.fn(async (p) => ({
        id: "paciente-1",
        nomeCompleto: p.nomeCompleto,
        cpf: p.cpf,
        cns: p.cns,
      })),
      bloquearLoteParaUpdate: jest.fn(
        async (loteId) => lotesMemoria.get(loteId) ?? null,
      ),
      decrementarSaldoLote: jest.fn(async (loteId, qtd) => {
        const lote = lotesMemoria.get(loteId)!;
        const novoSaldo = lote.saldoAtual - qtd;
        lote.saldoAtual = novoSaldo;
        return novoSaldo;
      }),
      registrarDispensacaoAtomica: jest.fn(async (dados) => ({
        id: "dispensacao-1",
        numeroAtendimento: "DISP-001",
        dataAtendimento: dataReferencia,
        status: "concluida",
        paciente: dados.paciente,
        dispensador: {
          id: dados.dispensadorId,
          nomeCompleto: dados.dispensadorNome ?? "Farmacêutico",
        },
        itens: dados.itens.map((item, idx) => ({
          itemId: `item-${idx + 1}`,
          medicamentoId: item.medicamentoId,
          medicamentoNome: item.medicamentoNome,
          loteId: item.loteId,
          numeroLote: item.numeroLote,
          quantidadeDispensada: item.quantidadeDispensada,
          saldoRestanteLote: item.saldoRestanteLote,
        })),
      })),
    };

    useCase = new EfetivarDispensacaoUseCase(repoMock);
  });

  test("Dispensação de medicamentos comuns com baixa atômica bem-sucedida", ({
    given,
    and,
    when,
    then,
  }) => {
    given(
      /^que a UBS possui o lote "(.*)" de "(.*)" com saldo (\d+)$/,
      (numeroLote: string, nomeMed: string, saldo: string) => {
        lotesMemoria.set(numeroLote, {
          id: numeroLote,
          numeroLote,
          unidadeId: contextoPadrao.unidadeId,
          medicamentoId: "med-paracetamol",
          medicamentoNome: nomeMed,
          antimicrobiano: false,
          saldoAtual: parseInt(saldo, 10),
          dataValidade: "2027-06-01",
        });
      },
    );

    and(
      /^o paciente possui CNS "(.*)", CPF "(.*)", nome "(.*)" e nascimento "(.*)"$/,
      (cns: string, cpf: string, nome: string, nascimento: string) => {
        payload.paciente = {
          cns,
          cpf,
          nomeCompleto: nome,
          dataNascimento: nascimento,
        };
      },
    );

    when(
      /^o farmacêutico efetivar a dispensação de (\d+) comprimidos do lote "(.*)"$/,
      async (qtd: string, numeroLote: string) => {
        payload.itens = [
          {
            medicamentoId: "med-paracetamol",
            loteId: numeroLote,
            quantidadeDispensada: parseInt(qtd, 10),
            posologia: "1 comp 8/8h",
          },
        ];
        resultado = await useCase.execute(payload, contextoPadrao, dataReferencia);
      },
    );

    then(
      /^a dispensação deve ser concluída com status "(.*)"$/,
      (statusEsperado: string) => {
        expect(resultado?.status).toBe(statusEsperado);
      },
    );

    and(
      /^o saldo restante do lote "(.*)" deve ser atualizado para (\d+)$/,
      (numeroLote: string, saldoEsperado: string) => {
        const saldoNum = parseInt(saldoEsperado, 10);
        expect(resultado?.itens[0].saldoRestanteLote).toBe(saldoNum);
        expect(lotesMemoria.get(numeroLote)?.saldoAtual).toBe(saldoNum);
      },
    );
  });

  test("Rejeição por receita de antimicrobiano emitida há mais de 10 dias", ({
    given,
    and,
    when,
    then,
  }) => {
    given(
      /^que a dispensação contém o medicamento antimicrobiano "(.*)"$/,
      (nomeMed: string) => {
        lotesMemoria.set("LOT-AMOX", {
          id: "LOT-AMOX",
          numeroLote: "LOT-AMOX",
          unidadeId: contextoPadrao.unidadeId,
          medicamentoId: "med-amox",
          medicamentoNome: nomeMed,
          antimicrobiano: true,
          saldoAtual: 100,
          dataValidade: "2027-05-01",
        });
        payload.itens = [
          {
            medicamentoId: "med-amox",
            loteId: "LOT-AMOX",
            quantidadeDispensada: 21,
          },
        ];
      },
    );

    and(
      /^a data de emissão da receita médica é de (\d+) dias atrás$/,
      (diasAtras: string) => {
        const dt = new Date(dataReferencia);
        dt.setUTCDate(dt.getUTCDate() - parseInt(diasAtras, 10));
        payload.receitaEmissaoEm = dt.toISOString().slice(0, 10);
      },
    );

    when("o farmacêutico tentar efetivar a dispensação", async () => {
      try {
        await useCase.execute(payload, contextoPadrao, dataReferencia);
      } catch (e) {
        erroCapturado = e as Error;
      }
    });

    then(
      "uma exceção ReceitaAntimicrobianoVencidaException deve ser lançada",
      () => {
        expect(erroCapturado).toBeInstanceOf(
          ReceitaAntimicrobianoVencidaException,
        );
      },
    );

    and("nenhum saldo de estoque deve ser decrementado", () => {
      expect(repoMock.decrementarSaldoLote).not.toHaveBeenCalled();
      expect(repoMock.registrarDispensacaoAtomica).not.toHaveBeenCalled();
      expect(lotesMemoria.get("LOT-AMOX")?.saldoAtual).toBe(100);
    });
  });

  test("Rejeição por saldo insuficiente no lote selecionado", ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      /^que o lote selecionado possui saldo atual de (\d+) unidades$/,
      (saldo: string) => {
        lotesMemoria.set("LOT-CURTO", {
          id: "LOT-CURTO",
          numeroLote: "LOT-CURTO",
          unidadeId: contextoPadrao.unidadeId,
          medicamentoId: "med-1",
          medicamentoNome: "Dipirona 500mg",
          antimicrobiano: false,
          saldoAtual: parseInt(saldo, 10),
          dataValidade: "2027-01-01",
        });
      },
    );

    when(
      /^o farmacêutico submeter uma dispensação de (\d+) unidades para esse lote$/,
      async (qtd: string) => {
        payload.itens = [
          {
            medicamentoId: "med-1",
            loteId: "LOT-CURTO",
            quantidadeDispensada: parseInt(qtd, 10),
          },
        ];
        try {
          await useCase.execute(payload, contextoPadrao, dataReferencia);
        } catch (e) {
          erroCapturado = e as Error;
        }
      },
    );

    then("uma exceção SaldoInsuficienteLoteException deve ser lançada", () => {
      expect(erroCapturado).toBeInstanceOf(SaldoInsuficienteLoteException);
    });

    and("a transação deve sofrer rollback imediato", () => {
      expect(repoMock.decrementarSaldoLote).not.toHaveBeenCalled();
      expect(repoMock.registrarDispensacaoAtomica).not.toHaveBeenCalled();
      expect(lotesMemoria.get("LOT-CURTO")?.saldoAtual).toBe(10);
    });
  });
});

describe("Casos de borda da Efetivação de Dispensação (Camada A)", () => {
  let useCase: EfetivarDispensacaoUseCase;
  let repoMock: jest.Mocked<DispensacaoRepositoryPort>;
  const dataReferencia = new Date("2026-10-21T12:00:00.000Z");
  const contextoPadrao = {
    municipioId: "0194e43e-a6fb-7389-9a74-94c039755ef0",
    unidadeId: "0194e43e-a6fb-7389-9a74-94c039755ef1",
    dispensadorId: "0194e43e-a6fb-7389-9a74-94c039755ef2",
  };

  beforeEach(() => {
    repoMock = {
      obterOuCriarPaciente: jest.fn(),
      bloquearLoteParaUpdate: jest.fn(),
      decrementarSaldoLote: jest.fn(),
      registrarDispensacaoAtomica: jest.fn(),
    };
    useCase = new EfetivarDispensacaoUseCase(repoMock);
  });

  it("deve rejeitar lote que pertence a outra UBS", async () => {
    repoMock.bloquearLoteParaUpdate.mockResolvedValue({
      id: "lote-outra-ubs",
      numeroLote: "LOT-99",
      unidadeId: "outra-ubs-uuid",
      medicamentoId: "med-1",
      medicamentoNome: "Dipirona",
      antimicrobiano: false,
      saldoAtual: 100,
      dataValidade: "2027-01-01",
    });

    await expect(
      useCase.execute(
        {
          paciente: {
            cns: "123456789012345",
            cpf: "12345678909",
            nomeCompleto: "Carlos Silva",
            dataNascimento: "1990-01-01",
          },
          itens: [
            {
              medicamentoId: "med-1",
              loteId: "lote-outra-ubs",
              quantidadeDispensada: 10,
            },
          ],
        },
        contextoPadrao,
        dataReferencia,
      ),
    ).rejects.toBeInstanceOf(LoteNaoPertenceAUbsException);
  });

  it("deve rejeitar paciente com CPF inválido antes de tocar nos lotes", async () => {
    await expect(
      useCase.execute(
        {
          paciente: {
            cns: "123456789012345",
            cpf: "11122233344",
            nomeCompleto: "Carlos Silva",
            dataNascimento: "1990-01-01",
          },
          itens: [
            {
              medicamentoId: "med-1",
              loteId: "lote-1",
              quantidadeDispensada: 10,
            },
          ],
        },
        contextoPadrao,
        dataReferencia,
      ),
    ).rejects.toBeInstanceOf(CpfInvalidoException);
    expect(repoMock.bloquearLoteParaUpdate).not.toHaveBeenCalled();
  });

  it("deve aceitar antimicrobiano com receita emitida dentro do prazo de 10 dias", async () => {
    repoMock.bloquearLoteParaUpdate.mockResolvedValue({
      id: "lote-amox",
      numeroLote: "LOT-AMOX",
      unidadeId: contextoPadrao.unidadeId,
      medicamentoId: "med-amox",
      medicamentoNome: "Amoxicilina 500mg",
      antimicrobiano: true,
      saldoAtual: 50,
      dataValidade: "2027-01-01",
    });
    repoMock.obterOuCriarPaciente.mockResolvedValue({
      id: "pac-1",
      nomeCompleto: "Carlos Silva",
      cpf: "12345678909",
      cns: "123456789012345",
    });
    repoMock.decrementarSaldoLote.mockResolvedValue(29);
    repoMock.registrarDispensacaoAtomica.mockResolvedValue({
      id: "disp-1",
      numeroAtendimento: "DISP-1",
      dataAtendimento: dataReferencia,
      status: "concluida",
      paciente: {
        id: "pac-1",
        nomeCompleto: "Carlos Silva",
        cpf: "12345678909",
        cns: "123456789012345",
      },
      dispensador: { id: contextoPadrao.dispensadorId, nomeCompleto: "Farm" },
      itens: [],
    });

    const res = await useCase.execute(
      {
        paciente: {
          cns: "123456789012345",
          cpf: "12345678909",
          nomeCompleto: "Carlos Silva",
          dataNascimento: "1990-01-01",
        },
        receitaEmissaoEm: "2026-10-15", // 6 dias atrás
        itens: [
          {
            medicamentoId: "med-amox",
            loteId: "lote-amox",
            quantidadeDispensada: 21,
          },
        ],
      },
      contextoPadrao,
      dataReferencia,
    );

    expect(res.status).toBe("concluida");
    expect(repoMock.decrementarSaldoLote).toHaveBeenCalledWith("lote-amox", 21);
  });
});

