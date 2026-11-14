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

export class IntervaloDatasInvalidoException extends DispensacaoDomainException {
  constructor(
    mensagem = "Intervalo de datas inválido: verifique o formato AAAA-MM-DD, se a data final é maior ou igual à inicial e se o período não excede 365 dias.",
  ) {
    super(mensagem);
    this.name = "IntervaloDatasInvalidoException";
  }
}

export class DispensacaoNaoEncontradaException extends DispensacaoDomainException {
  constructor(dispensacaoId: string) {
    super(
      `Dispensação "${dispensacaoId}" não foi encontrada na unidade de saúde atual.`,
    );
    this.name = "DispensacaoNaoEncontradaException";
  }
}

export class DispensacaoJaEstornadaException extends DispensacaoDomainException {
  constructor(dispensacaoId: string) {
    super(`A dispensação "${dispensacaoId}" já se encontra estornada.`);
    this.name = "DispensacaoJaEstornadaException";
  }
}

export class MotivoEstornoInvalidoException extends DispensacaoDomainException {
  constructor(
    mensagem = "O motivo do estorno é obrigatório e deve conter no mínimo 10 caracteres.",
  ) {
    super(mensagem);
    this.name = "MotivoEstornoInvalidoException";
  }
}
