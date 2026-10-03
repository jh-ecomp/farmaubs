import { Given, When, Then, Before } from "@cucumber/cucumber";
import { expect } from "chai";

// ── Modelo de Domínio / Regras de Estoque ────────────────────────────────────

export class SaldoInsuficienteException extends Error {
  constructor(mensagem: string = "Saldo insuficiente no lote para efetuar a baixa de estoque solicitada") {
    super(mensagem);
    this.name = "SaldoInsuficienteException";
  }
}

interface MovimentacaoEstoque {
  tipo: "AJUSTE_ENTRADA" | "AJUSTE_SAIDA";
  quantidade: number;
  motivo: string;
  saldoResultante: number;
}

class ControleEstoqueService {
  public saldo: number = 0;
  public historico: MovimentacaoEstoque[] = [];

  constructor(saldoInicial: number = 0) {
    this.saldo = saldoInicial;
  }

  ajustarEntrada(quantidade: number, motivo: string): MovimentacaoEstoque {
    this.saldo += quantidade;
    const mov: MovimentacaoEstoque = {
      tipo: "AJUSTE_ENTRADA",
      quantidade,
      motivo,
      saldoResultante: this.saldo,
    };
    this.historico.push(mov);
    return mov;
  }

  ajustarSaida(quantidade: number, motivo: string): MovimentacaoEstoque {
    if (quantidade > this.saldo) {
      throw new SaldoInsuficienteException();
    }
    this.saldo -= quantidade;
    const mov: MovimentacaoEstoque = {
      tipo: "AJUSTE_SAIDA",
      quantidade,
      motivo,
      saldoResultante: this.saldo,
    };
    this.historico.push(mov);
    return mov;
  }
}

// ── Contexto do Cucumber ─────────────────────────────────────────────────────

Before(function (this: any) {
  this.estoqueService = null;
  this.erroEstoque = null;
  this.ultimaMovimentacao = null;
});

// ── Step Definitions ─────────────────────────────────────────────────────────

Given(
  "que o lote possui saldo atual de {int} unidades",
  function (this: any, saldoInicial: number) {
    this.estoqueService = new ControleEstoqueService(saldoInicial);
  }
);

When(
  "o usuário registrar um ajuste de entrada de {int} unidades com o motivo {string}",
  function (this: any, quantidade: number, motivo: string) {
    this.ultimaMovimentacao = this.estoqueService.ajustarEntrada(quantidade, motivo);
  }
);

Then(
  "o saldo do lote deve passar para {int} unidades",
  function (this: any, saldoEsperado: number) {
    expect(this.estoqueService.saldo).to.equal(saldoEsperado);
  }
);

Then(
  "a movimentação {string} deve ser registrada com sucesso",
  function (this: any, tipoEsperado: string) {
    expect(this.ultimaMovimentacao).to.not.be.null;
    expect(this.ultimaMovimentacao.tipo).to.equal(tipoEsperado);
  }
);

When(
  "o usuário registrar um ajuste de saída de {int} unidades com o motivo {string}",
  function (this: any, quantidade: number, motivo: string) {
    this.ultimaMovimentacao = this.estoqueService.ajustarSaida(quantidade, motivo);
  }
);

When(
  "o usuário tentar realizar ajuste de saída com quantidade {int}",
  function (this: any, quantidade: number) {
    try {
      this.ultimaMovimentacao = this.estoqueService.ajustarSaida(quantidade, "AJUSTE_TESTE");
    } catch (err) {
      this.erroEstoque = err;
    }
  }
);

Then(
  "o sistema deve recusar a operação informando saldo insuficiente",
  function (this: any) {
    expect(this.erroEstoque).to.be.instanceOf(SaldoInsuficienteException);
  }
);

Then(
  "o saldo do lote deve permanecer inalterado em {int} unidades",
  function (this: any, saldoEsperado: number) {
    expect(this.estoqueService.saldo).to.equal(saldoEsperado);
  }
);
