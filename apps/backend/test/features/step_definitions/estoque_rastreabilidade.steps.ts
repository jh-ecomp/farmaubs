import { After, Before, DataTable, Given, Then, When } from "@cucumber/cucumber";
import { Logger } from "@nestjs/common";
import { expect } from "chai";
import type { RastreabilidadeLoteDto } from "@farmaubs/shared";
import { LoteNaoEncontradoException } from "../../../src/modules/estoque/domain/errors/ajuste-estoque.errors";
import { ConsultarRastreabilidadeLoteUseCase } from "../../../src/modules/estoque/application/use-cases/consultar-rastreabilidade-lote.use-case";
import type {
  MovimentacaoLoteBruta,
  RastreabilidadeLoteBruta,
  RepositorioEstoqueRastreabilidadePort,
} from "../../../src/modules/estoque/domain/ports/estoque-rastreabilidade.repository.port";

interface LoteArmazenado {
  loteId: string;
  ubsId: string;
  saldoAtual: number;
  movimentacoes: MovimentacaoLoteBruta[];
}

class RepositorioEstoqueRastreabilidadeFake
  implements RepositorioEstoqueRastreabilidadePort
{
  constructor(private readonly lotes: Map<string, LoteArmazenado>) {}

  async buscarLinhaDoTempoLote(
    loteId: string,
    unidadeIds: string[],
  ): Promise<RastreabilidadeLoteBruta | null> {
    const lote = this.lotes.get(loteId);
    if (!lote) return null;
    if (!unidadeIds.includes(lote.ubsId)) return null;

    return {
      lote: {
        id: lote.loteId,
        numeroLote: `NL-${lote.loteId}`,
        dataValidade: "2027-12-31",
        saldoAtual: lote.saldoAtual,
        fabricanteNome: "Laboratório Teste",
        dataCadastro: "2026-01-01T00:00:00.000Z",
      },
      medicamento: {
        id: "med-teste",
        nome: "Medicamento Teste",
        principioAtivo: "Princípio Ativo Teste",
        apresentacao: "Comprimido 500mg",
      },
      movimentacoes: [...lote.movimentacoes],
    };
  }
}

let lotes = new Map<string, LoteArmazenado>();
let resultado: RastreabilidadeLoteDto | undefined;
let erroCapturado: unknown;
let warnsCapturados: string[] = [];
let warnSpy: ((message: string) => void) | undefined;
let warnOriginal: typeof Logger.prototype.warn;

function obterLote(loteId: string): LoteArmazenado {
  let lote = lotes.get(loteId);
  if (!lote) {
    lote = {
      loteId,
      ubsId: "UBS-A",
      saldoAtual: 0,
      movimentacoes: [],
    };
    lotes.set(loteId, lote);
  }
  return lote;
}

Before(() => {
  lotes = new Map();
  resultado = undefined;
  erroCapturado = undefined;
  warnsCapturados = [];

  warnOriginal = Logger.prototype.warn;
  Logger.prototype.warn = function (message: unknown, ...optionalParams: unknown[]) {
    warnsCapturados.push(String(message));
  };
});

After(() => {
  if (warnOriginal) {
    Logger.prototype.warn = warnOriginal;
  }
});

Given(
  "que o lote {string} da UBS {string} tem saldo atual de {int} unidades para a rastreabilidade",
  (loteId: string, ubsId: string, saldoAtual: number) => {
    const lote = obterLote(loteId);
    lote.ubsId = ubsId;
    lote.saldoAtual = saldoAtual;
  },
);

Given(
  "que o lote {string} pertence à UBS {string} para a rastreabilidade",
  (loteId: string, ubsId: string) => {
    const lote = obterLote(loteId);
    lote.ubsId = ubsId;
  },
);

Given(
  "o lote {string} possui as seguintes movimentações de rastreabilidade:",
  (loteId: string, tabela: DataTable) => {
    const lote = obterLote(loteId);
    lote.movimentacoes = tabela.hashes().map((linha) => ({
      id: linha.id,
      dataHora: linha.dataHora,
      tipoBanco: linha.tipoBanco,
      operacao: linha.operacao as "+" | "-",
      quantidade: Math.abs(Number(linha.saldoResultante) - Number(linha.saldoAnterior)),
      saldoAnterior: Number(linha.saldoAnterior),
      saldoResultante: Number(linha.saldoResultante),
      usuarioResponsavel: { id: "u-1", nome: "Farmacêutico Responsável" },
    }));
  },
);

Given(
  "o lote {string} não possui movimentações de rastreabilidade",
  (loteId: string) => {
    const lote = obterLote(loteId);
    lote.movimentacoes = [];
  },
);

Given(
  "o lote {string} possui a movimentação de rastreabilidade do tipo {string} com operação {string}",
  (loteId: string, tipoBanco: string, operacao: string) => {
    const lote = obterLote(loteId);
    lote.movimentacoes = [
      {
        id: "m1",
        dataHora: "2026-11-01T10:00:00Z",
        tipoBanco,
        operacao: operacao as "+" | "-",
        quantidade: 1,
        saldoAnterior: 0,
        saldoResultante: 1,
        usuarioResponsavel: { id: "u-1", nome: "Farmacêutico Responsável" },
      },
    ];
  },
);

When(
  "o farmacêutico consulta a rastreabilidade do lote {string} nas UBSs {string}",
  async (loteId: string, listaUbs: string) => {
    const ubsIds = listaUbs.split(",").map((s) => s.trim());
    const repo = new RepositorioEstoqueRastreabilidadeFake(lotes);
    const useCase = new ConsultarRastreabilidadeLoteUseCase(repo);
    try {
      resultado = await useCase.execute(loteId, ubsIds);
    } catch (err) {
      erroCapturado = err;
    }
  },
);

Then(
  "a rastreabilidade deve listar as movimentações na ordem: {string}",
  (ordemEsperada: string) => {
    expect(resultado, "resultado da consulta de rastreabilidade").to.not.equal(undefined);
    const esperados = ordemEsperada.split(",").map((s) => s.trim());
    const obtidos = resultado!.movimentacoes.map((m) => m.id);
    expect(obtidos).to.deep.equal(esperados);
  },
);

Then(
  "o saldo inicial de rastreabilidade deve ser {int} unidades",
  (saldoEsperado: number) => {
    expect(resultado, "resultado da consulta de rastreabilidade").to.not.equal(undefined);
    expect(resultado!.lote.saldoInicial).to.equal(saldoEsperado);
  },
);

Then(
  "o saldo atual de rastreabilidade deve ser {int} unidades",
  (saldoEsperado: number) => {
    expect(resultado, "resultado da consulta de rastreabilidade").to.not.equal(undefined);
    expect(resultado!.lote.saldoAtual).to.equal(saldoEsperado);
  },
);

Then(
  "a rastreabilidade deve listar {int} movimentações",
  (totalEsperado: number) => {
    expect(resultado, "resultado da consulta de rastreabilidade").to.not.equal(undefined);
    expect(resultado!.movimentacoes).to.have.length(totalEsperado);
  },
);

Then(
  "a consulta de rastreabilidade deve falhar com lote não encontrado",
  () => {
    expect(erroCapturado).to.be.instanceOf(LoteNaoEncontradoException);
  },
);

Then(
  "deve ser registrado um aviso de cadeia de saldos inconsistente para o lote {string}",
  (loteId: string) => {
    const encontrouWarn = warnsCapturados.some((w) =>
      w.includes(loteId) && w.toLowerCase().includes("cadeia de saldos inconsistente"),
    );
    expect(
      encontrouWarn,
      `esperava aviso para o lote ${loteId}, avisos emitidos: ${JSON.stringify(warnsCapturados)}`,
    ).to.equal(true);
  },
);

Then(
  "a movimentação {string} deve ter o tipo de movimentação {string}",
  (movId: string, tipoEsperado: string) => {
    expect(resultado, "resultado da consulta de rastreabilidade").to.not.equal(undefined);
    const movItem = resultado!.movimentacoes.find((m) => m.id === movId);
    expect(movItem, `movimentação ${movId} não encontrada`).to.not.equal(undefined);
    expect(movItem!.tipoMovimentacao).to.equal(tipoEsperado);
  },
);
