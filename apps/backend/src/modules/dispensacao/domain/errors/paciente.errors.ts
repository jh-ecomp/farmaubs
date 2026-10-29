export class PacienteDomainException extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "PacienteDomainException";
  }
}

export class CpfInvalidoException extends PacienteDomainException {
  constructor(mensagem = "CPF informado é inválido.") {
    super(mensagem);
    this.name = "CpfInvalidoException";
  }
}

export class CnsInvalidoException extends PacienteDomainException {
  constructor(mensagem = "CNS informado é inválido.") {
    super(mensagem);
    this.name = "CnsInvalidoException";
  }
}

export class DadosPacienteInvalidosException extends PacienteDomainException {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "DadosPacienteInvalidosException";
  }
}

export class PacienteJaCadastradoException extends PacienteDomainException {
  constructor(
    mensagem = "Paciente já cadastrado neste município com este CPF ou CNS.",
  ) {
    super(mensagem);
    this.name = "PacienteJaCadastradoException";
  }
}

export class PacienteNaoEncontradoException extends PacienteDomainException {
  constructor(identificador: string) {
    super(`Paciente "${identificador}" não foi encontrado.`);
    this.name = "PacienteNaoEncontradoException";
  }
}

