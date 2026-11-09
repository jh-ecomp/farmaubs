import { Logger } from "@nestjs/common";
import { LoteNaoEncontradoException } from "../../domain/errors/ajuste-estoque.errors";
import type {
  MovimentacaoLoteBruta,
  RastreabilidadeLoteBruta,
  RepositorioEstoqueRastreabilidadePort,
} from "../../domain/ports/estoque-rastreabilidade.repository.port";
import {
  ConsultarRastreabilidadeLoteUseCase,
  conciliarCadeia,
  ordenarPorCadeia,
  traduzirTipo,
} from "./consultar-rastreabilidade-lote.use-case";

const LOTE_ID = "6f000000-0000-4000-8000-0000000000aa";
const UBS_ID = "6f000000-0000-4000-8000-0000000000a1";

const mov = (p: Partial<MovimentacaoLoteBruta> & { id: string }): MovimentacaoLoteBruta => ({
  dataHora: "2026-01-01T10:00:00.000Z",
  tipoBanco: "ENTRADA_RECEBIMENTO",
  operacao: "+",
  quantidade: 0,
  saldoAnterior: 0,
  saldoResultante: 0,
  usuarioResponsavel: { id: "u1", nome: "Farmacêutico" },
  ...p,
});

const bruta = (
  movimentacoes: MovimentacaoLoteBruta[],
  saldoAtual: number,
): RastreabilidadeLoteBruta => ({
  lote: {
    id: LOTE_ID,
    numeroLote: "LT-PARACETAMOL-123",
    dataValidade: "2027-01-01",
    saldoAtual,
    fabricanteNome: "Lab Teste",
    dataCadastro: "2026-01-01T09:00:00.000Z",
  },
  medicamento: {
    id: "p1",
    nome: "Paracetamol",
    principioAtivo: "Paracetamol",
    apresentacao: "500 mg comprimido",
  },
  movimentacoes,
});

describe("traduzirTipo", () => {
  it.each([
    ["ENTRADA_RECEBIMENTO", "+", "ENTRADA_RECEBIMENTO"],
    ["ESTORNO_RECEBIMENTO", "-", "ESTORNO_ENTRADA"],
    ["SAIDA_DISPENSACAO", "-", "SAIDA_DISPENSACAO"],
    ["ENTRADA_ESTORNO_DISPENSACAO", "+", "ESTORNO_DISPENSACAO"],
  ] as const)("mapeia %s para %s", (tipoBanco, operacao, esperado) => {
    expect(traduzirTipo({ tipoBanco, operacao })).toBe(esperado);
  });

  it("resolve ajustes pela operação", () => {
    expect(traduzirTipo({ tipoBanco: "AJUSTE_ENTRADA", operacao: "+" })).toBe("AJUSTE_ENTRADA");
    expect(traduzirTipo({ tipoBanco: "AJUSTE_SAIDA", operacao: "-" })).toBe("AJUSTE_SAIDA");
    expect(traduzirTipo({ tipoBanco: "AJUSTE_QUALQUER", operacao: "+" })).toBe("AJUSTE_ENTRADA");
    expect(traduzirTipo({ tipoBanco: "AJUSTE_QUALQUER", operacao: "-" })).toBe("AJUSTE_SAIDA");
  });

  it("falha alto para tipo desconhecido", () => {
    expect(() => traduzirTipo({ tipoBanco: "XYZ", operacao: "+" })).toThrow(/desconhecido/);
  });
});

describe("conciliarCadeia", () => {
  const a = mov({ id: "a", saldoAnterior: 0, saldoResultante: 500 });
  const b = mov({ id: "b", saldoAnterior: 500, saldoResultante: 470 });

  it("aceita cadeia íntegra que termina no saldo atual", () => {
    expect(conciliarCadeia([a, b], 470)).toBe(true);
  });
  it("aceita lista vazia", () => {
    expect(conciliarCadeia([], 10)).toBe(true);
  });
  it("rejeita elo quebrado", () => {
    expect(conciliarCadeia([a, { ...b, saldoAnterior: 499 }], 470)).toBe(false);
  });
  it("rejeita quando o último saldo difere do saldo atual", () => {
    expect(conciliarCadeia([a, b], 460)).toBe(false);
  });
});

describe("ordenarPorCadeia", () => {
  it("restaura a ordem pela cadeia quando o timestamp empata", () => {
    const a = mov({ id: "z", saldoAnterior: 0, saldoResultante: 500 });
    const b = mov({ id: "y", saldoAnterior: 500, saldoResultante: 470 });
    const c = mov({ id: "x", saldoAnterior: 470, saldoResultante: 460 });
    expect(ordenarPorCadeia([c, a, b]).map((m) => m.id)).toEqual(["z", "y", "x"]);
  });

  it("mantém a ordem do SQL entre timestamps diferentes", () => {
    const a = mov({ id: "b", dataHora: "2026-01-01T10:00:00.000Z", saldoAnterior: 0, saldoResultante: 5 });
    const b = mov({ id: "a", dataHora: "2026-01-01T11:00:00.000Z", saldoAnterior: 5, saldoResultante: 2 });
    expect(ordenarPorCadeia([a, b]).map((m) => m.id)).toEqual(["b", "a"]);
  });

  it("mantém a ordem original quando a cadeia está quebrada", () => {
    const a = mov({ id: "1", saldoAnterior: 0, saldoResultante: 10 });
    const b = mov({ id: "2", saldoAnterior: 99, saldoResultante: 50 });
    expect(ordenarPorCadeia([a, b]).map((m) => m.id)).toEqual(["1", "2"]);
  });

  it("não perde nem duplica eventos", () => {
    const lista = [
      mov({ id: "1", saldoAnterior: 0, saldoResultante: 10 }),
      mov({ id: "2", saldoAnterior: 10, saldoResultante: 20 }),
      mov({ id: "3", saldoAnterior: 20, saldoResultante: 30 }),
    ];
    expect(ordenarPorCadeia([...lista].reverse())).toHaveLength(3);
  });

  it("mantém a ordem do SQL quando a cadeia é circular (entrada e saída de mesma quantidade)", () => {
    const entrada = [
      mov({ id: "x", saldoAnterior: 10, saldoResultante: 20 }),
      mov({ id: "y", saldoAnterior: 20, saldoResultante: 10 }),
    ];
    expect(ordenarPorCadeia(entrada).map((m) => m.id)).toEqual(["x", "y"]);
    expect(ordenarPorCadeia([...entrada].reverse()).map((m) => m.id)).toEqual(["y", "x"]);
  });

  it("retorna lista vazia para entrada vazia", () => {
    expect(ordenarPorCadeia([])).toEqual([]);
  });
});

describe("ConsultarRastreabilidadeLoteUseCase", () => {
  const eventos = [
    mov({ id: "1", dataHora: "2026-01-01T10:00:00.000Z", tipoBanco: "ENTRADA_RECEBIMENTO", operacao: "+", quantidade: 500, saldoAnterior: 0, saldoResultante: 500, documentoReferencia: "CAF-2026/089" }),
    mov({ id: "2", dataHora: "2026-01-02T10:00:00.000Z", tipoBanco: "SAIDA_DISPENSACAO", operacao: "-", quantidade: 30, saldoAnterior: 500, saldoResultante: 470 }),
    mov({ id: "3", dataHora: "2026-01-03T10:00:00.000Z", tipoBanco: "AJUSTE_SAIDA", operacao: "-", quantidade: 10, saldoAnterior: 470, saldoResultante: 460, motivo: "AVARIA", justificativa: "Quebra" }),
  ];

  const criar = (retorno: RastreabilidadeLoteBruta | null) => {
    const repo: RepositorioEstoqueRastreabilidadePort = {
      buscarLinhaDoTempoLote: jest.fn().mockResolvedValue(retorno),
    };
    return { repo, useCase: new ConsultarRastreabilidadeLoteUseCase(repo) };
  };

  afterEach(() => jest.restoreAllMocks());

  it("devolve a linha do tempo com saldo atual, saldo inicial e tipos traduzidos", async () => {
    const { useCase, repo } = criar(bruta(eventos, 460));
    const r = await useCase.execute(LOTE_ID, [UBS_ID]);

    expect(repo.buscarLinhaDoTempoLote).toHaveBeenCalledWith(LOTE_ID, [UBS_ID]);
    expect(r.lote.saldoAtual).toBe(460);
    expect(r.lote.saldoInicial).toBe(500);
    expect(r.movimentacoes.map((m) => m.tipoMovimentacao)).toEqual([
      "ENTRADA_RECEBIMENTO",
      "SAIDA_DISPENSACAO",
      "AJUSTE_SAIDA",
    ]);
    expect(r.movimentacoes[0].documentoReferencia).toBe("CAF-2026/089");
  });

  it("não vaza campos internos no DTO", async () => {
    const { useCase } = criar(bruta(eventos, 460));
    const r = await useCase.execute(LOTE_ID, [UBS_ID]);
    for (const m of r.movimentacoes) {
      expect(m).not.toHaveProperty("saldoAnterior");
      expect(m).not.toHaveProperty("tipoBanco");
    }
  });

  it("usa o saldo atual como saldo inicial quando não há movimentações", async () => {
    const { useCase } = criar(bruta([], 7));
    const r = await useCase.execute(LOTE_ID, [UBS_ID]);
    expect(r.lote.saldoInicial).toBe(7);
    expect(r.movimentacoes).toEqual([]);
  });

  it("lança LoteNaoEncontradoException quando o repositório devolve null", async () => {
    const { useCase } = criar(null);
    await expect(useCase.execute(LOTE_ID, [UBS_ID])).rejects.toBeInstanceOf(LoteNaoEncontradoException);
  });

  it("emite warn (sem falhar) quando a cadeia é inconsistente", async () => {
    const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const { useCase } = criar(bruta(eventos, 999));
    await expect(useCase.execute(LOTE_ID, [UBS_ID])).resolves.toBeDefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(LOTE_ID));
  });
});
