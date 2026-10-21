export class DispensacaoDomainException extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "DispensacaoDomainException";
  }
}

export class ReceitaAntimicrobianoVencidaException extends DispensacaoDomainException {
  constructor(
    mensagem = "Receita de antimicrobiano ausente, inválida ou com prazo de 10 dias expirado.",
  ) {
    super(mensagem);
    this.name = "ReceitaAntimicrobianoVencidaException";
  }
}

export class SaldoInsuficienteLoteException extends DispensacaoDomainException {
  constructor(
    numeroLote: string,
    saldoDisponivel: number,
    quantidadeSolicitada: number,
  ) {
    super(
      `Saldo insuficiente no lote "${numeroLote}": disponível ${saldoDisponivel}, solicitado ${quantidadeSolicitada}.`,
    );
    this.name = "SaldoInsuficienteLoteException";
  }
}

export class LoteNaoPertenceAUbsException extends DispensacaoDomainException {
  constructor(loteId: string) {
    super(
      `O lote "${loteId}" não foi encontrado ou não pertence à UBS ativa da sessão.`,
    );
    this.name = "LoteNaoPertenceAUbsException";
  }
}

export class DadosDispensacaoInvalidosException extends DispensacaoDomainException {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "DadosDispensacaoInvalidosException";
  }
}

