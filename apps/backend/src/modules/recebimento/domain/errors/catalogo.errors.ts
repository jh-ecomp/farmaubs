/**
 * [RF008]: Erros de domínio relacionados ao catálogo de medicamentos e fabricantes.
 */

export class TermoBuscaCurtoException extends Error {
  constructor(message = "O termo de busca deve conter pelo menos 2 caracteres.") {
    super(message);
    this.name = "TermoBuscaCurtoException";
  }
}

export class FabricanteCnpjJaExisteException extends Error {
  constructor(cnpj: string) {
    super(`Já existe um fabricante cadastrado com o CNPJ ${cnpj}.`);
    this.name = "FabricanteCnpjJaExisteException";
  }
}

export class FabricanteDadosInvalidosException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FabricanteDadosInvalidosException";
  }
}
