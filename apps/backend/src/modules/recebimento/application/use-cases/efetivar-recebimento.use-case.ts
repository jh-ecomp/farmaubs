import {
  AvisoRecebimentoDto,
  CriarEntradaEstoqueRequest,
  EntradaEstoqueEfetivadaResultado,
  validarValidadeRecebimento,
} from "@farmaubs/shared";
import type {
  ContextoOperacionalRecebimento,
  ItemRecebimentoResolvido,
  RecebimentoRepositoryPort,
} from "../../domain/ports/recebimento.repository.port";
import type { CatalogoRepositoryPort } from "../../domain/ports/catalogo.repository.port";
import {
  DocumentoEntradaDuplicadoException,
  DocumentoEntradaInvalidoException,
  FabricanteNaoEncontradoException,
  ItemRecebimentoInvalidoException,
  LoteValidadeVencidaException,
  ProdutoNaoEncontradoException,
} from "../../domain/errors/recebimento.errors";

/**
 * [RF008 / RF024 / RF028]: Caso de uso puro para efetivação atômica de entrada de estoque na UBS.
 */
export class EfetivarRecebimentoUseCase {
  constructor(
    private readonly recebimentoRepo: RecebimentoRepositoryPort,
    private readonly catalogoRepo: CatalogoRepositoryPort,
  ) {}

  /**
   * Valida clinicamente e registra a carga de recebimento, criando lotes e histórico.
   * @param request - Dados da nota/guia e itens recebidos.
   * @param contexto - Município, UBS e usuário autenticado.
   * @param dataReferencia - Data base para cálculo de validade (padrão: hoje).
   * @returns Entrada efetivada com saldos físicos atualizados e eventuais alertas de validade.
   * @throws {DocumentoEntradaInvalidoException} Se cabeçalho ou lista de itens forem inválidos.
   * @throws {LoteValidadeVencidaException} Se qualquer lote recebido estiver vencido.
   * @throws {ProdutoNaoEncontradoException} Se o medicamento não existir no catálogo.
   * @throws {FabricanteNaoEncontradoException} Se o fabricante não existir no catálogo.
   */
  async execute(
    request: CriarEntradaEstoqueRequest,
    contexto: ContextoOperacionalRecebimento,
    dataReferencia: Date = new Date(),
  ): Promise<EntradaEstoqueEfetivadaResultado> {
    const numeroDocumento = request.numeroDocumento?.trim() ?? "";
    if (numeroDocumento.length < 2) {
      throw new DocumentoEntradaInvalidoException(
        "O número da guia ou documento deve conter ao menos 2 caracteres.",
      );
    }

    const fornecedorOrigem = request.fornecedorOrigem?.trim() ?? "";
    if (fornecedorOrigem.length < 3) {
      throw new DocumentoEntradaInvalidoException(
        "O fornecedor ou origem da carga deve ter ao menos 3 caracteres.",
      );
    }

    if (!request.itens || request.itens.length === 0) {
      throw new DocumentoEntradaInvalidoException(
        "A carga recebida deve conter pelo menos um item de medicamento.",
      );
    }

    const docExistente = await this.recebimentoRepo.buscarDocumentoPorNumero(
      numeroDocumento,
      contexto.ubsId,
    );
    if (docExistente) {
      throw new DocumentoEntradaDuplicadoException(numeroDocumento);
    }

    const avisos: AvisoRecebimentoDto[] = [];
    const itensResolvidos: ItemRecebimentoResolvido[] = [];

    for (const item of request.itens) {
      if (!item.quantidadeRecebida || item.quantidadeRecebida <= 0) {
        throw new ItemRecebimentoInvalidoException(
          `Quantidade recebida para o lote ${item.numeroLote} deve ser um número inteiro positivo maior que zero.`,
        );
      }

      const numeroLote = item.numeroLote?.trim() ?? "";
      if (numeroLote.length < 2) {
        throw new ItemRecebimentoInvalidoException(
          "O código do lote deve ter ao menos 2 caracteres.",
        );
      }

      // Validação de validade (RF024)
      const checagemValidade = validarValidadeRecebimento(
        item.dataValidade,
        dataReferencia,
      );

      if (checagemValidade.vencido) {
        throw new LoteValidadeVencidaException(
          numeroLote,
          String(item.dataValidade).slice(0, 10),
        );
      }

      if (checagemValidade.validadeCurta) {
        avisos.push({
          tipo: "VALIDADE_CURTA",
          lote: numeroLote,
          mensagem: `Lote ${numeroLote} vence em menos de 6 meses (${checagemValidade.diasRestantes} dias restantes).`,
        });
      }

      // Validação de existência do Produto e Fabricante
      const produto = await this.catalogoRepo.buscarProdutoPorId(item.produtoId);
      if (!produto) {
        throw new ProdutoNaoEncontradoException(item.produtoId);
      }

      const fabricantes = await this.catalogoRepo.listarFabricantesAtivos();
      const fabricante = fabricantes.find((f) => f.id === item.fabricanteId);
      if (!fabricante) {
        throw new FabricanteNaoEncontradoException(item.fabricanteId);
      }

      itensResolvidos.push({
        produtoId: produto.id,
        produtoNome: produto.principioAtivo,
        fabricanteId: fabricante.id,
        fabricanteNome: fabricante.nomeFantasia,
        numeroLote,
        dataValidade: String(item.dataValidade).slice(0, 10),
        quantidadeRecebida: Math.floor(item.quantidadeRecebida),
        observacoes: item.observacoes?.trim() ?? null,
      });
    }

    return this.recebimentoRepo.registrarEntradaAtomica({
      contexto,
      documento: {
        numeroDocumento,
        tipoDocumento: request.tipoDocumento ?? "GUIA_CAF",
        fornecedorOrigem,
        dataRecebimento: request.dataRecebimento
          ? new Date(request.dataRecebimento)
          : dataReferencia,
        observacoes: request.observacoes?.trim() ?? null,
      },
      itens: itensResolvidos,
      avisos,
    });
  }
}
