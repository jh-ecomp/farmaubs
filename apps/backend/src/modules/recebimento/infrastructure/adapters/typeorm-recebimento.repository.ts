import { Injectable } from "@nestjs/common";
import type {
  EntradaEstoqueEfetivadaResultado,
  ItemRecebimentoResultadoDto,
} from "@farmaubs/shared";
import { TransactionContext } from "../../../../common/transaction/transaction-context.service";
import type {
  RecebimentoRepositoryPort,
  RegistrarEntradaAtomicaParams,
} from "../../domain/ports/recebimento.repository.port";
import { DocumentoEntradaEntity } from "../persistence/entities/documento-entrada.entity";
import { RecebimentoItemEntity } from "../persistence/entities/recebimento-item.entity";
import { LoteEntity } from "../persistence/entities/lote.entity";
import { MovimentacaoEstoqueEntity } from "../persistence/entities/movimentacao-estoque.entity";

/**
 * [RF008 / RF028 / ADR-008 / ADR-015]: Adaptador TypeORM transacional para recebimento de cargas e estoque.
 */
@Injectable()
export class TypeOrmRecebimentoRepository implements RecebimentoRepositoryPort {
  constructor(private readonly transactionContext: TransactionContext) {}

  /**
   * Busca documento de entrada por número na UBS para verificação de duplicidade.
   */
  async buscarDocumentoPorNumero(
    numeroDocumento: string,
    ubsId: string,
  ): Promise<{ id: string; numeroDocumento: string; status: string } | null> {
    const manager = this.transactionContext.getManager();
    const doc = await manager.findOne(DocumentoEntradaEntity, {
      where: { numero_documento: numeroDocumento, ubs_id: ubsId },
      select: { id: true, numero_documento: true, status: true },
    });

    if (!doc) return null;

    return {
      id: doc.id,
      numeroDocumento: doc.numero_documento,
      status: doc.status,
    };
  }

  /**
   * Executa a transação completa de entrada de estoque:
   * 1. Salva DocumentoEntradaEntity
   * 2. Lock pessimista e upsert seguro de lotes (RF008)
   * 3. Salva RecebimentoItemEntity
   * 4. Registra livro-razão em MovimentacaoEstoqueEntity (RF028 / ADR-017)
   */
  async registrarEntradaAtomica(
    params: RegistrarEntradaAtomicaParams,
  ): Promise<EntradaEstoqueEfetivadaResultado> {
    const manager = this.transactionContext.getManager();
    const { contexto, documento, itens, avisos } = params;

    // 1. Grava o cabeçalho do documento
    const docEntity = manager.create(DocumentoEntradaEntity, {
      municipio_id: contexto.municipioId,
      ubs_id: contexto.ubsId,
      numero_documento: documento.numeroDocumento,
      tipo_documento: documento.tipoDocumento,
      fornecedor_origem: documento.fornecedorOrigem,
      data_recebimento: documento.dataRecebimento ?? new Date(),
      usuario_recebedor_id: contexto.usuarioId,
      status: "CONCLUIDO",
      observacoes: documento.observacoes ?? null,
    });
    const documentoSalvo = await manager.save(DocumentoEntradaEntity, docEntity);

    const itensResultado: ItemRecebimentoResultadoDto[] = [];

    // 2. Itera atomicamente sobre cada item
    for (const item of itens) {
      // Lock pessimista para upsert de lote na UBS
      const loteExistenteRows = await manager.query(
        `SELECT id, saldo_atual
           FROM public.lotes
          WHERE ubs_id = $1::uuid
            AND produto_id = $2::uuid
            AND numero_lote = $3
            AND fabricante_id = $4::uuid
          FOR UPDATE`,
        [contexto.ubsId, item.produtoId, item.numeroLote, item.fabricanteId],
      );

      let loteId: string;
      let saldoAnterior = 0;
      let saldoFinal = item.quantidadeRecebida;

      if (loteExistenteRows.length > 0) {
        const row = loteExistenteRows[0];
        loteId = row.id;
        saldoAnterior = Number(row.saldo_atual);
        saldoFinal = saldoAnterior + item.quantidadeRecebida;

        await manager.query(
          `UPDATE public.lotes
              SET saldo_atual = $1,
                  data_validade = $2::date,
                  status = 'ATIVO',
                  updated_at = now()
            WHERE id = $3::uuid`,
          [saldoFinal, item.dataValidade, loteId],
        );
      } else {
        const [novoLote] = await manager.query(
          `INSERT INTO public.lotes (
             municipio_id, ubs_id, produto_id, fabricante_id,
             numero_lote, data_validade, saldo_atual, status
           ) VALUES (
             $1::uuid, $2::uuid, $3::uuid, $4::uuid,
             $5, $6::date, $7, 'ATIVO'
           ) RETURNING id`,
          [
            contexto.municipioId,
            contexto.ubsId,
            item.produtoId,
            item.fabricanteId,
            item.numeroLote,
            item.dataValidade,
            saldoFinal,
          ],
        );
        loteId = novoLote.id;
      }

      // 3. Grava o item do recebimento físico
      const itemEntity = manager.create(RecebimentoItemEntity, {
        municipio_id: contexto.municipioId,
        documento_entrada_id: documentoSalvo.id,
        produto_id: item.produtoId,
        fabricante_id: item.fabricanteId,
        lote_id: loteId,
        numero_lote: item.numeroLote,
        data_validade: item.dataValidade,
        quantidade_recebida: item.quantidadeRecebida,
        observacoes: item.observacoes ?? null,
      });
      const itemSalvo = await manager.save(RecebimentoItemEntity, itemEntity);

      // 4. Grava livro-razão em movimentacoes_estoque (ADR-017 / RF028)
      const movimentacao = manager.create(MovimentacaoEstoqueEntity, {
        municipio_id: contexto.municipioId,
        ubs_id: contexto.ubsId,
        lote_id: loteId,
        tipo_movimentacao: "ENTRADA_RECEBIMENTO",
        quantidade: item.quantidadeRecebida,
        saldo_anterior: saldoAnterior,
        saldo_posterior: saldoFinal,
        documento_referencia_id: documentoSalvo.id,
        tipo_documento_referencia: "DOCUMENTO_ENTRADA",
        usuario_id: contexto.usuarioId,
        justificativa: `Recebimento guia ${documento.numeroDocumento} - ${documento.fornecedorOrigem}`,
      });
      await manager.save(MovimentacaoEstoqueEntity, movimentacao);

      itensResultado.push({
        itemId: itemSalvo.id,
        produtoId: item.produtoId,
        produtoNome: item.produtoNome,
        fabricanteId: item.fabricanteId,
        fabricanteNome: item.fabricanteNome,
        loteId,
        numeroLote: item.numeroLote,
        dataValidade: item.dataValidade,
        quantidadeRecebida: item.quantidadeRecebida,
        saldoFinalLote: saldoFinal,
      });
    }

    return {
      id: documentoSalvo.id,
      numeroDocumento: documentoSalvo.numero_documento,
      tipoDocumento: documentoSalvo.tipo_documento,
      fornecedorOrigem: documentoSalvo.fornecedor_origem,
      dataRecebimento: documentoSalvo.data_recebimento,
      usuarioRecebedorId: contexto.usuarioId,
      itens: itensResultado,
      avisos,
    };
  }
}
