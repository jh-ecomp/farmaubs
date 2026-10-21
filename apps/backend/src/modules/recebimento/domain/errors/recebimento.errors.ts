/**
 * [RF008 / RF024 / RF028]: Erros de domínio do fluxo de recebimento de medicamentos.
 */

export class LoteValidadeVencidaException extends Error {
  constructor(numeroLote: string, dataValidade: string) {
    super(
      `Não é permitido receber lotes já vencidos (lote ${numeroLote}, validade informada: ${dataValidade}).`,
    );
    this.name = "LoteValidadeVencidaException";
  }
}

export class ItemRecebimentoInvalidoException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ItemRecebimentoInvalidoException";
  }
}

export class DocumentoEntradaInvalidoException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentoEntradaInvalidoException";
  }
}

export class DocumentoEntradaDuplicadoException extends Error {
  constructor(numeroDocumento: string) {
    super(`Já existe um documento de entrada com o número '${numeroDocumento}' registrado para esta unidade de saúde.`);
    this.name = "DocumentoEntradaDuplicadoException";
  }
}

export class UbsNaoInformadaException extends Error {
  constructor(message = "Unidade de saúde (UBS) de destino não informada.") {
    super(message);
    this.name = "UbsNaoInformadaException";
  }
}

export { LoteValidadeVencidaException as ValidadeVencidaException };

export class ProdutoNaoEncontradoException extends Error {
  constructor(produtoId: string) {
    super(`Produto com ID ${produtoId} não foi encontrado no catálogo ativo.`);
    this.name = "ProdutoNaoEncontradoException";
  }
}

export class FabricanteNaoEncontradoException extends Error {
  constructor(fabricanteId: string) {
    super(`Fabricante com ID ${fabricanteId} não foi encontrado no catálogo ativo.`);
    this.name = "FabricanteNaoEncontradoException";
  }
}

export class DocumentoJaEstornadoException extends Error {
  constructor(numeroDocumento: string) {
    super(`O documento ${numeroDocumento} já se encontra estornado no sistema.`);
    this.name = "DocumentoJaEstornadoException";
  }
}

export class SaldoInsuficienteEstornoException extends Error {
  constructor(numeroLote: string, saldoDisponivel: number, quantidadeEstorno: number) {
    super(
      `Não é possível estornar o lote ${numeroLote}: saldo atual disponível (${saldoDisponivel}) é inferior à quantidade recebida (${quantidadeEstorno}) porque unidades já foram dispensadas.`,
    );
    this.name = "SaldoInsuficienteEstornoException";
  }
}
