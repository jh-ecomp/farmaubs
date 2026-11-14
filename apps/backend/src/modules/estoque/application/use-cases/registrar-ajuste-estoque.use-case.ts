import {
  TIPO_MOVIMENTACAO_AJUSTE,
  TIPOS_OPERACAO_AJUSTE,
  motivoCompativelComTipo,
  saldoSuficiente,
  validarJustificativaAjuste,
  type AjusteEstoqueResultadoDto,
  type RegistrarAjusteLoteInputDto,
} from "@farmaubs/shared";
import {
  DadosAjusteInvalidosException,
  JustificativaInvalidaException,
  LoteNaoEncontradoException,
  MotivoIncompativelException,
  SaldoInsuficienteException,
} from "../../domain/errors/ajuste-estoque.errors";
import type { RepositorioEstoqueAjustesPort } from "../../domain/ports/estoque-ajustes.repository.port";

export interface ContextoAjusteEstoque {
  usuarioId: string;
  usuarioNome: string;
  unidadeIds: string[];
}

export class RegistrarAjusteEstoqueUseCase {
  constructor(private readonly repositorio: RepositorioEstoqueAjustesPort) {}

  /**
   * [RF009 / RF011 / RF028 / ADR-008]: Registra ajuste manual (+/-) de um lote, com lock pessimista,
   * validação de saldo e auditoria. Deve rodar dentro da transação da requisição.
   * @param loteId - Lote a ajustar.
   * @param request - Tipo, quantidade, motivo e justificativa.
   * @param contexto - Usuário logado e UBSs do seu escopo.
   * @returns Resultado do ajuste com saldos anterior e atualizado.
   * @throws {SaldoInsuficienteException} Saída maior que o saldo do lote.
   * @throws {LoteNaoEncontradoException} Lote inexistente ou fora das UBSs do usuário.
   */
  async execute(
    loteId: string,
    request: RegistrarAjusteLoteInputDto,
    contexto: ContextoAjusteEstoque,
  ): Promise<AjusteEstoqueResultadoDto> {
    if (!contexto.usuarioId) {
      throw new DadosAjusteInvalidosException(
        "Profissional responsável pelo ajuste não identificado na sessão.",
      );
    }
    if (
      !(TIPOS_OPERACAO_AJUSTE as readonly string[]).includes(
        request.tipoOperacao,
      )
    ) {
      throw new DadosAjusteInvalidosException("Tipo de operação inválido.");
    }
    if (!Number.isInteger(request.quantidade) || request.quantidade < 1) {
      throw new DadosAjusteInvalidosException(
        "A quantidade deve ser um número inteiro estritamente positivo",
      );
    }
    if (!motivoCompativelComTipo(request.tipoOperacao, request.motivo)) {
      throw new MotivoIncompativelException(
        request.tipoOperacao,
        request.motivo,
      );
    }
    const erroJustificativa = validarJustificativaAjuste(
      request.motivo,
      request.justificativa,
    );
    if (erroJustificativa)
      throw new JustificativaInvalidaException(erroJustificativa);
    const justificativa = request.justificativa.trim();

    const lote = await this.repositorio.bloquearLotePorId(loteId);
    // Lote de outra UBS recebe o mesmo erro do inexistente, para não revelar sua existência.
    if (!lote || !contexto.unidadeIds.includes(lote.ubsId)) {
      throw new LoteNaoEncontradoException(loteId);
    }

    const ehSaida = request.tipoOperacao === "SAIDA";
    if (ehSaida && !saldoSuficiente(lote.saldoAtual, request.quantidade)) {
      throw new SaldoInsuficienteException();
    }

    const saldoAtualizado = ehSaida
      ? lote.saldoAtual - request.quantidade
      : lote.saldoAtual + request.quantidade;

    await this.repositorio.atualizarSaldo(lote.id, saldoAtualizado);
    const movimentacao = await this.repositorio.registrarMovimentacao({
      municipioId: lote.municipioId,
      ubsId: lote.ubsId,
      loteId: lote.id,
      tipoMovimentacao: TIPO_MOVIMENTACAO_AJUSTE[request.tipoOperacao],
      quantidade: request.quantidade,
      saldoAnterior: lote.saldoAtual,
      saldoPosterior: saldoAtualizado,
      usuarioId: contexto.usuarioId,
      motivo: request.motivo,
      justificativa,
    });

    return {
      movimentacaoId: movimentacao.id,
      loteId: lote.id,
      tipoOperacao: request.tipoOperacao,
      quantidadeAjustada: request.quantidade,
      saldoAnterior: lote.saldoAtual,
      saldoAtualizado,
      motivo: request.motivo,
      justificativa,
      realizadoPor: { id: contexto.usuarioId, nome: contexto.usuarioNome },
      dataHora: movimentacao.dataHora,
    };
  }
}
