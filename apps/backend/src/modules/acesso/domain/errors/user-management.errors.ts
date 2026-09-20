export {
  UsuarioEmailJaExisteException,
  PerfilNaoEncontradoException,
  UnidadeSaudeInvalidaException,
  DadosUsuarioInvalidosException,
} from "./user-registration.errors";

export class UsuarioNaoEncontradoException extends Error {
  constructor(id: string) {
    super(`Usuário com ID "${id}" não foi encontrado.`);
    this.name = "UsuarioNaoEncontradoException";
  }
}

export class UltimoAdministradorException extends Error {
  constructor(
    mensagem = "Não é permitido inativar ou alterar o perfil do único administrador ativo.",
  ) {
    super(mensagem);
    this.name = "UltimoAdministradorException";
  }
}

export class AutoInativacaoBloqueadaException extends Error {
  constructor() {
    super("Não é permitido inativar o próprio usuário logado.");
    this.name = "AutoInativacaoBloqueadaException";
  }
}

export class SenhaInvalidaException extends Error {
  constructor(
    mensagem = "A senha fornecida não atende aos requisitos mínimos de complexidade.",
  ) {
    super(mensagem);
    this.name = "SenhaInvalidaException";
  }
}

export class IntegridadeTerritorialException extends Error {
  constructor(
    mensagem = "Todas as UBSs associadas devem pertencer ao município do usuário.",
  ) {
    super(mensagem);
    this.name = "IntegridadeTerritorialException";
  }
}
