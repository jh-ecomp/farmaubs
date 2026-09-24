export class SenhaDomainException extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "SenhaDomainException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NovaSenhaNaoPodeSerIgualProvisoriaException extends SenhaDomainException {
  constructor() {
    super(
      "A nova senha não pode ser idêntica à senha provisória recém-utilizada.",
    );
    this.name = "NovaSenhaNaoPodeSerIgualProvisoriaException";
  }
}

export class ConfirmacaoSenhaDivergenteException extends SenhaDomainException {
  constructor() {
    super("A confirmação de senha não corresponde à nova senha informada.");
    this.name = "ConfirmacaoSenhaDivergenteException";
  }
}

export class SenhaFracaException extends SenhaDomainException {
  constructor() {
    super(
      "A senha deve ter no mínimo 8 caracteres, com ao menos uma letra maiúscula, " +
        "uma minúscula, um número e um caractere especial.",
    );
    this.name = "SenhaFracaException";
  }
}

export class TrocaDeSenhaObrigatoriaException extends Error {
  constructor() {
    super("Troca de senha obrigatória. Acesse POST /api/v1/acesso/trocar-senha para continuar.");
    this.name = "TrocaDeSenhaObrigatoriaException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
