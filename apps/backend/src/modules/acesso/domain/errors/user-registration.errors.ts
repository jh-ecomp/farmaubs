export class RegistroUsuarioDomainException extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'RegistroUsuarioDomainException';
  }
}

export class UsuarioEmailJaExisteException extends RegistroUsuarioDomainException {
  constructor(email: string) {
    super(`O e-mail "${email}" já está cadastrado no sistema.`);
    this.name = 'UsuarioEmailJaExisteException';
  }
}

export class PerfilNaoEncontradoException extends RegistroUsuarioDomainException {
  constructor(identificador: string) {
    super(
      `Perfil de acesso "${identificador}" não foi encontrado no catálogo.`,
    );
    this.name = 'PerfilNaoEncontradoException';
  }
}

export class UnidadeSaudeInvalidaException extends RegistroUsuarioDomainException {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'UnidadeSaudeInvalidaException';
  }
}

export class DadosUsuarioInvalidosException extends RegistroUsuarioDomainException {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'DadosUsuarioInvalidosException';
  }
}

// Subclasses em inglês para compatibilidade
export class UserRegistrationDomainException extends RegistroUsuarioDomainException {}
export class UserEmailAlreadyExistsException extends UsuarioEmailJaExisteException {}
export class ProfileNotFoundException extends PerfilNaoEncontradoException {}
export class InvalidHealthUnitException extends UnidadeSaudeInvalidaException {}
export class InvalidUserDataException extends DadosUsuarioInvalidosException {}
