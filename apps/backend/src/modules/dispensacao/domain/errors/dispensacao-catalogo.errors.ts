export class DispensacaoCatalogoDomainException extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "DispensacaoCatalogoDomainException";
  }
}

export class MedicamentoNaoEncontradoException extends DispensacaoCatalogoDomainException {
  constructor(identificador: string) {
    super(`Medicamento "${identificador}" não foi encontrado no catálogo ativo.`);
    this.name = "MedicamentoNaoEncontradoException";
  }
}

