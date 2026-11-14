export class AjusteEstoqueDomainException extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "AjusteEstoqueDomainException";
  }
}

export class DadosAjusteInvalidosException extends AjusteEstoqueDomainException {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "DadosAjusteInvalidosException";
  }
}

export class MotivoIncompativelException extends AjusteEstoqueDomainException {
  constructor(tipoOperacao: string, motivo: string) {
    super(
      `O motivo "${motivo}" não é permitido para ajuste de ${tipoOperacao}.`,
    );
    this.name = "MotivoIncompativelException";
  }
}

export class JustificativaInvalidaException extends AjusteEstoqueDomainException {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "JustificativaInvalidaException";
  }
}

export class LoteNaoEncontradoException extends AjusteEstoqueDomainException {
  constructor(loteId: string) {
    super(`Lote "${loteId}" não encontrado na unidade de saúde do usuário.`);
    this.name = "LoteNaoEncontradoException";
  }
}

export class SaldoInsuficienteException extends AjusteEstoqueDomainException {
  constructor() {
    super(
      "Saldo insuficiente no lote para efetuar a baixa de estoque solicitada",
    );
    this.name = "SaldoInsuficienteException";
  }
}
