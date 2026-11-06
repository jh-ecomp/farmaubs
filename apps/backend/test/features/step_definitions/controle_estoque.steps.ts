import { Given, When, Then, Before } from "@cucumber/cucumber";
import { expect } from "chai";
import type { MotivoAjuste } from "@farmaubs/shared";
import { RegistrarAjusteEstoqueUseCase } from "../../../src/modules/estoque/application/use-cases/registrar-ajuste-estoque.use-case";
import { SaldoInsuficienteException } from "../../../src/modules/estoque/domain/errors/ajuste-estoque.errors";
import type {
  LoteBloqueadoAjuste,
  MovimentacaoAjusteRegistrada,
  RegistrarMovimentacaoAjusteParams,
  RepositorioEstoqueAjustesPort,
} from "../../../src/modules/estoque/domain/ports/estoque-ajustes.repository.port";

/**
 * ES-03 (#244) - BDD: ajustes de estoque executados pelo caso de uso real
 * (RegistrarAjusteEstoqueUseCase) sobre um repositório em memória que implementa a porta.
 */

const LOTE_ID = "22222222-2222-4222-8222-222222222222";
const UBS_ID = "11111111-1111-4111-8111-111111111111";
const MUNICIPIO_ID = "44444444-4444-4444-8444-444444444444";
const JUSTIFICATIVA = "Ajuste registrado durante a conferência de inventário";
const CONTEXTO = {
  usuarioId: "33333333-3333-4333-8333-333333333333",
  usuarioNome: "Farmacêutico Teste",
  unidadeIds: [UBS_ID],
};

class RepositorioAjustesEmMemoria implements RepositorioEstoqueAjustesPort {
  readonly movimentacoes: RegistrarMovimentacaoAjusteParams[] = [];

  constructor(private lote: LoteBloqueadoAjuste) {}

  get saldo(): number {
    return this.lote.saldoAtual;
  }

  async bloquearLotePorId(loteId: string): Promise<LoteBloqueadoAjuste | null> {
    return loteId === this.lote.id ? { ...this.lote } : null;
  }

  async atualizarSaldo(_loteId: string, novoSaldo: number): Promise<void> {
    this.lote = { ...this.lote, saldoAtual: novoSaldo };
  }

  async registrarMovimentacao(
    dados: RegistrarMovimentacaoAjusteParams,
  ): Promise<MovimentacaoAjusteRegistrada> {
    this.movimentacoes.push(dados);
    return {
      id: `mov-${this.movimentacoes.length}`,
      dataHora: new Date().toISOString(),
    };
  }
}

Before(function (this: any) {
  this.repositorioAjustes = null;
  this.casoDeUsoAjuste = null;
  this.erroAjuste = null;
});

Given(
  "que o lote possui saldo atual de {int} unidades",
  function (this: any, saldoInicial: number) {
    this.repositorioAjustes = new RepositorioAjustesEmMemoria({
      id: LOTE_ID,
      municipioId: MUNICIPIO_ID,
      ubsId: UBS_ID,
      saldoAtual: saldoInicial,
    });
    this.casoDeUsoAjuste = new RegistrarAjusteEstoqueUseCase(
      this.repositorioAjustes,
    );
  },
);

When(
  "o usuário registrar um ajuste de entrada de {int} unidades com o motivo {string}",
  async function (this: any, quantidade: number, motivo: string) {
    await this.casoDeUsoAjuste.execute(
      LOTE_ID,
      {
        tipoOperacao: "ENTRADA",
        quantidade,
        motivo: motivo as MotivoAjuste,
        justificativa: JUSTIFICATIVA,
      },
      CONTEXTO,
    );
  },
);

When(
  "o usuário registrar um ajuste de saída de {int} unidades com o motivo {string}",
  async function (this: any, quantidade: number, motivo: string) {
    await this.casoDeUsoAjuste.execute(
      LOTE_ID,
      {
        tipoOperacao: "SAIDA",
        quantidade,
        motivo: motivo as MotivoAjuste,
        justificativa: JUSTIFICATIVA,
      },
      CONTEXTO,
    );
  },
);

When(
  "o usuário tentar realizar ajuste de saída com quantidade {int}",
  async function (this: any, quantidade: number) {
    try {
      await this.casoDeUsoAjuste.execute(
        LOTE_ID,
        {
          tipoOperacao: "SAIDA",
          quantidade,
          motivo: "EXTRAVIO",
          justificativa: JUSTIFICATIVA,
        },
        CONTEXTO,
      );
    } catch (err) {
      this.erroAjuste = err;
    }
  },
);

Then(
  "o saldo do lote deve passar para {int} unidades",
  function (this: any, saldoEsperado: number) {
    expect(this.repositorioAjustes.saldo).to.equal(saldoEsperado);
  },
);

Then(
  "a movimentação {string} deve ser registrada com sucesso",
  function (this: any, tipoEsperado: string) {
    expect(this.erroAjuste).to.equal(null);
    expect(this.repositorioAjustes.movimentacoes).to.have.length(1);
    expect(this.repositorioAjustes.movimentacoes[0].tipoMovimentacao).to.equal(
      tipoEsperado,
    );
  },
);

Then(
  "o sistema deve recusar a operação informando saldo insuficiente",
  function (this: any) {
    expect(this.erroAjuste).to.be.instanceOf(SaldoInsuficienteException);
  },
);

Then(
  "o saldo do lote deve permanecer inalterado em {int} unidades",
  function (this: any, saldoEsperado: number) {
    expect(this.repositorioAjustes.saldo).to.equal(saldoEsperado);
    expect(this.repositorioAjustes.movimentacoes).to.have.length(0);
  },
);
