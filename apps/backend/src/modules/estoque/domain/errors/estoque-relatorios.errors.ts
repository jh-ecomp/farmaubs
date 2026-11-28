export class RelatorioEstoqueDomainException extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "RelatorioEstoqueDomainException";
  }
}

export class UbsNaoEncontradaRelatorioException extends RelatorioEstoqueDomainException {
  constructor(ubsId: string) {
    super(`Unidade de Saúde com ID "${ubsId}" não encontrada para emissão do relatório.`);
    this.name = "UbsNaoEncontradaRelatorioException";
  }
}

export class IntervaloDatasRelatorioInvalidoException extends RelatorioEstoqueDomainException {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "IntervaloDatasRelatorioInvalidoException";
  }
}
