import { Injectable } from "@nestjs/common";
import {
  DetalhesRecebimentoCompleto,
  FiltroHistoricoRecebimento,
  HistoricoRecebimentoPaginado,
  ItemDetalheRecebimento,
  ItemResumoHistoricoRecebimento,
  ResultadoEstornoRecebimento,
} from "@farmaubs/shared";
import { TransactionContext } from "../../../../common/transaction/transaction-context.service";
import type {
  ExecutarEstornoParams,
  HistoricoRecebimentoRepositoryPort,
} from "../../domain/ports/historico-recebimento.repository.port";
import { DocumentoEntradaEntity } from "../persistence/entities/documento-entrada.entity";
import { RecebimentoItemEntity } from "../persistence/entities/recebimento-item.entity";
import { LoteEntity } from "../persistence/entities/lote.entity";
import { MovimentacaoEstoqueEntity } from "../persistence/entities/movimentacao-estoque.entity";
import { ProdutoEntity } from "../persistence/entities/produto.entity";
import { FabricanteEntity } from "../persistence/entities/fabricante.entity";
import {
  DocumentoJaEstornadoException,
  DocumentoNaoEncontradoException,
  SaldoInsuficienteEstornoException,
} from "../../domain/errors/recebimento.errors";

/**
 * [RF008 / RF028 / ADR-017]: Adaptador TypeORM transacional para histórico e estorno de recebimentos.
 */
@Injectable()
export class TypeOrmHistoricoRecebimentoRepository
  implements HistoricoRecebimentoRepositoryPort
{
  constructor(private readonly transactionContext: TransactionContext) {}

  /**
   * Consulta paginada do histórico de documentos de entrada.
   */
  async listarHistorico(
    filtro: FiltroHistoricoRecebimento,
    municipioId: string,
    ubsIdsPermitidas: string[],
  ): Promise<HistoricoRecebimentoPaginado> {
    const manager = this.transactionContext.getManager();
    const pagina = filtro.pagina && filtro.pagina > 0 ? filtro.pagina : 1;
    const limite = filtro.limite && filtro.limite > 0 ? filtro.limite : 20;
    const offset = (pagina - 1) * limite;

    let query = manager
      .createQueryBuilder(DocumentoEntradaEntity, "d")
      .where("d.municipio_id = :municipioId", { municipioId });

    if (filtro.ubsId) {
      query = query.andWhere("d.ubs_id = :ubsId", { ubsId: filtro.ubsId });
    } else if (ubsIdsPermitidas.length > 0) {
      query = query.andWhere("d.ubs_id IN (:...ubsIdsPermitidas)", {
        ubsIdsPermitidas,
      });
    }

    if (filtro.status && filtro.status !== "TODOS") {
      query = query.andWhere("d.status = :status", { status: filtro.status });
    }

    if (filtro.termoBusca && filtro.termoBusca.trim().length > 0) {
      const termo = `%${filtro.termoBusca.trim()}%`;
      query = query.andWhere(
        "(d.numero_documento ILIKE :termo OR d.fornecedor_origem ILIKE :termo)",
        { termo },
      );
    }

    // Filtros de data
    const agora = new Date();
    if (filtro.periodo === "HOJE") {
      const hojeInicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
      query = query.andWhere("d.data_recebimento >= :hojeInicio", { hojeInicio });
    } else if (filtro.periodo === "ONTEM") {
      const ontemInicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1);
      query = query.andWhere("d.data_recebimento >= :ontemInicio", { ontemInicio });
    } else if (filtro.periodo === "ULTIMOS_7_DIAS") {
      const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
      query = query.andWhere("d.data_recebimento >= :seteDiasAtras", { seteDiasAtras });
    } else if (filtro.periodo === "ULTIMOS_30_DIAS") {
      const trintaDiasAtras = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
      query = query.andWhere("d.data_recebimento >= :trintaDiasAtras", { trintaDiasAtras });
    } else if (filtro.dataInicio || filtro.dataFim) {
      if (filtro.dataInicio) {
        query = query.andWhere("d.data_recebimento >= :dataInicio", {
          dataInicio: new Date(`${filtro.dataInicio}T00:00:00Z`),
        });
      }
      if (filtro.dataFim) {
        query = query.andWhere("d.data_recebimento <= :dataFim", {
          dataFim: new Date(`${filtro.dataFim}T23:59:59.999Z`),
        });
      }
    }

    const [documentos, total] = await query
      .orderBy("d.data_recebimento", "DESC")
      .addOrderBy("d.created_at", "DESC")
      .skip(offset)
      .take(limite)
      .getManyAndCount();

    const itensResumo: ItemResumoHistoricoRecebimento[] = [];

    for (const doc of documentos) {
      // Itens do documento para somar totais e checar estornabilidade
      const itens = await manager.find(RecebimentoItemEntity, {
        where: { documento_entrada_id: doc.id },
      });

      const totalItens = itens.length;
      const totalUnidades = itens.reduce(
        (acc, curr) => acc + Number(curr.quantidade_recebida),
        0,
      );

      // Checa se pode estornar
      let podeEstornar = doc.status === "CONCLUIDO";
      if (podeEstornar) {
        for (const item of itens) {
          const lote = await manager.findOne(LoteEntity, {
            where: { id: item.lote_id },
            select: { saldo_atual: true },
          });
          if (!lote || Number(lote.saldo_atual) < Number(item.quantidade_recebida)) {
            podeEstornar = false;
            break;
          }
        }
      }

      itensResumo.push({
        id: doc.id,
        numeroDocumento: doc.numero_documento,
        tipoDocumento: doc.tipo_documento,
        fornecedorOrigem: doc.fornecedor_origem,
        dataRecebimento: doc.data_recebimento,
        usuarioRecebedorNome: "Operador UBS",
        totalItens,
        totalUnidades,
        status: doc.status as "CONCLUIDO" | "ESTORNADO",
        podeEstornar,
        motivoEstorno: doc.observacoes?.includes("ESTORNO:") ? doc.observacoes : null,
      });
    }

    return {
      itens: itensResumo,
      total,
      pagina,
      totalPaginas: Math.ceil(total / limite),
    };
  }

  /**
   * Obtém detalhes completos de uma entrada e seus itens físicos.
   */
  async obterDetalhesPorId(
    id: string,
    municipioId: string,
  ): Promise<DetalhesRecebimentoCompleto | null> {
    const manager = this.transactionContext.getManager();

    const doc = await manager.findOne(DocumentoEntradaEntity, {
      where: { id, municipio_id: municipioId },
    });

    if (!doc) return null;

    const itensRaw = await manager.find(RecebimentoItemEntity, {
      where: { documento_entrada_id: doc.id },
      order: { created_at: "ASC" },
    });

    const itensDetalhe: ItemDetalheRecebimento[] = [];
    let podeEstornar = doc.status === "CONCLUIDO";

    for (const item of itensRaw) {
      const prod = await manager.findOne(ProdutoEntity, {
        where: { id: item.produto_id },
      });
      const fab = await manager.findOne(FabricanteEntity, {
        where: { id: item.fabricante_id },
      });
      const lote = await manager.findOne(LoteEntity, {
        where: { id: item.lote_id },
      });

      const saldoAtualLote = lote ? Number(lote.saldo_atual) : 0;
      if (saldoAtualLote < Number(item.quantidade_recebida)) {
        podeEstornar = false;
      }

      itensDetalhe.push({
        id: item.id,
        produtoId: item.produto_id,
        produtoNome: prod ? prod.principio_ativo : "Medicamento",
        formaFarmaceutica: prod?.forma_farmaceutica ?? "-",
        concentracao: prod?.dosagem ?? "-",
        fabricanteId: item.fabricante_id,
        fabricanteNome: fab ? fab.nome_fantasia : "Fabricante",
        loteId: item.lote_id,
        numeroLote: item.numero_lote,
        dataValidade: String(item.data_validade).slice(0, 10),
        quantidadeRecebida: Number(item.quantidade_recebida),
        saldoAtualLote,
        observacoes: item.observacoes,
      });
    }

    const totalUnidades = itensDetalhe.reduce(
      (acc, curr) => acc + curr.quantidadeRecebida,
      0,
    );

    return {
      id: doc.id,
      ubsId: doc.ubs_id,
      numeroDocumento: doc.numero_documento,
      tipoDocumento: doc.tipo_documento,
      fornecedorOrigem: doc.fornecedor_origem,
      dataRecebimento: doc.data_recebimento,
      usuarioRecebedorId: doc.usuario_recebedor_id,
      usuarioRecebedorNome: "Operador UBS",
      status: doc.status as "CONCLUIDO" | "ESTORNADO",
      motivoEstorno: doc.observacoes?.includes("ESTORNO:") ? doc.observacoes : null,
      observacoes: doc.observacoes,
      itens: itensDetalhe,
      totalItens: itensDetalhe.length,
      totalUnidades,
      podeEstornar,
    };
  }

  /**
   * Reversão atômica de recebimento com bloqueio pessimista e livro-razão (RF028 / ADR-017).
   */
  async executarEstornoAtomico(
    params: ExecutarEstornoParams,
  ): Promise<ResultadoEstornoRecebimento> {
    const manager = this.transactionContext.getManager();
    const { documentoId, motivo, usuarioId, municipioId } = params;

    const doc = await manager.findOne(DocumentoEntradaEntity, {
      where: { id: documentoId, municipio_id: municipioId },
    });

    if (!doc) {
      throw new DocumentoNaoEncontradoException(documentoId);
    }

    if (doc.status === "ESTORNADO") {
      throw new DocumentoJaEstornadoException(doc.numero_documento);
    }

    const itens = await manager.find(RecebimentoItemEntity, {
      where: { documento_entrada_id: doc.id },
    });

    let totalUnidadesEstornadas = 0;

    // 1. Lock pessimista FOR UPDATE em todos os lotes e validação de saldos
    for (const item of itens) {
      const loteRows = await manager.query(
        `SELECT id, saldo_atual
           FROM public.lotes
          WHERE id = $1::uuid
          FOR UPDATE`,
        [item.lote_id],
      );

      if (loteRows.length === 0) {
        throw new SaldoInsuficienteEstornoException(
          item.numero_lote,
          0,
          Number(item.quantidade_recebida),
        );
      }

      const saldoAtual = Number(loteRows[0].saldo_atual);
      const qtdRecebida = Number(item.quantidade_recebida);

      if (saldoAtual < qtdRecebida) {
        throw new SaldoInsuficienteEstornoException(
          item.numero_lote,
          saldoAtual,
          qtdRecebida,
        );
      }
    }

    // 2. Com todas as validações confirmadas, executa o decremento dos lotes e registra no livro-razão
    for (const item of itens) {
      const loteRows = await manager.query(
        `SELECT id, saldo_atual
           FROM public.lotes
          WHERE id = $1::uuid`,
        [item.lote_id],
      );

      const saldoAnterior = Number(loteRows[0].saldo_atual);
      const qtdEstorno = Number(item.quantidade_recebida);
      const saldoPosterior = saldoAnterior - qtdEstorno;

      await manager.query(
        `UPDATE public.lotes
            SET saldo_atual = $1,
                updated_at = now()
          WHERE id = $2::uuid`,
        [saldoPosterior, item.lote_id],
      );

      // Grava no livro-razão (movimentacoes_estoque)
      const movimentacao = manager.create(MovimentacaoEstoqueEntity, {
        municipio_id: municipioId,
        ubs_id: doc.ubs_id,
        lote_id: item.lote_id,
        tipo_movimentacao: "ESTORNO_RECEBIMENTO",
        quantidade: qtdEstorno,
        saldo_anterior: saldoAnterior,
        saldo_posterior: saldoPosterior,
        documento_referencia_id: doc.id,
        tipo_documento_referencia: "DOCUMENTO_ENTRADA",
        usuario_id: usuarioId,
        justificativa: `Estorno guia ${doc.numero_documento}: ${motivo}`,
      });
      await manager.save(MovimentacaoEstoqueEntity, movimentacao);

      totalUnidadesEstornadas += qtdEstorno;
    }

    // 3. Atualiza status do documento para ESTORNADO
    const observacoesAtualizadas = doc.observacoes
      ? `${doc.observacoes} | ESTORNO: ${motivo}`
      : `ESTORNO: ${motivo}`;

    await manager.update(DocumentoEntradaEntity, doc.id, {
      status: "ESTORNADO",
      observacoes: observacoesAtualizadas,
    });

    return {
      id: doc.id,
      numeroDocumento: doc.numero_documento,
      status: "ESTORNADO",
      dataEstorno: new Date(),
      usuarioEstornoId: usuarioId,
      motivoEstorno: motivo,
      totalItensEstornados: itens.length,
      totalUnidadesEstornadas,
    };
  }
}
