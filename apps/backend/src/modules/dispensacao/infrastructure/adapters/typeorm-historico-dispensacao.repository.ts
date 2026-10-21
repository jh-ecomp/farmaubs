import { Injectable } from "@nestjs/common";
import {
  type DispensacaoItemListaDto,
  type EstornarDispensacaoResultado,
  type LinhaExportacaoDispensacaoDto,
  formatarCPF,
  limparNaoNumericos,
} from "@farmaubs/shared";
import { TransactionContext } from "../../../../common/transaction/transaction-context.service";
import type {
  DispensacaoParaEstornoInfo,
  FiltrosHistoricoResolvidos,
  HistoricoDispensacaoRepositoryPort,
} from "../../domain/ports/historico-dispensacao.repository.port";
import { DispensacaoEntity } from "../persistence/entities/dispensacao.entity";

@Injectable()
export class TypeOrmHistoricoDispensacaoRepository
  implements HistoricoDispensacaoRepositoryPort
{
  constructor(private readonly transactionContext: TransactionContext) {}

  /**
   * Lista dispensações paginadas e filtradas por período, paciente, medicamento, categoria e status.
   */
  async listarFiltrado(filtros: FiltrosHistoricoResolvidos): Promise<{
    itens: DispensacaoItemListaDto[];
    totalItens: number;
  }> {
    const manager = this.transactionContext.getManager();
    const { whereSql, params } = this.montarFiltrosSql(filtros);

    const countRows = await manager.query(
      `SELECT COUNT(DISTINCT d.id)::int AS total
         FROM public.dispensacoes d
         INNER JOIN public.pacientes p ON p.id = d.paciente_id
         LEFT JOIN public.dispensacao_itens di ON di.dispensacao_id = d.id
         LEFT JOIN public.medicamentos m ON m.id = di.medicamento_id
        WHERE ${whereSql}`,
      params,
    );
    const totalItens = Number(countRows[0]?.total ?? 0);

    const offset = (filtros.pagina - 1) * filtros.limite;
    const rows = await manager.query(
      `SELECT
         d.id,
         COALESCE(d.numero_atendimento, d.id::text) AS numero_atendimento,
         d.created_at AS data_atendimento,
         d.status,
         p.nome_completo AS paciente_nome,
         p.cpf AS paciente_cpf,
         p.cns AS paciente_cns,
         COALESCE(u.nome_completo, 'Farmacêutico') AS dispensador_nome,
         COUNT(di.id)::int AS total_itens,
         COALESCE(
           STRING_AGG(
             COALESCE(m.principio_ativo, di.medicamento_id::text) || ' (' || di.quantidade_dispensada || ')',
             ', '
           ),
           ''
         ) AS medicamentos_resumo
       FROM public.dispensacoes d
       INNER JOIN public.pacientes p ON p.id = d.paciente_id
       LEFT JOIN public.users u ON u.id = d.dispensador_id
       LEFT JOIN public.dispensacao_itens di ON di.dispensacao_id = d.id
       LEFT JOIN public.medicamentos m ON m.id = di.medicamento_id
       WHERE ${whereSql}
       GROUP BY d.id, d.numero_atendimento, d.created_at, d.status, p.nome_completo, p.cpf, p.cns, u.nome_completo
       ORDER BY d.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filtros.limite, offset],
    );

    const itens: DispensacaoItemListaDto[] = rows.map((r: any) => ({
      id: r.id,
      numeroAtendimento: r.numero_atendimento,
      dataAtendimento: r.data_atendimento,
      status: r.status,
      pacienteNome: r.paciente_nome,
      pacienteCpf: r.paciente_cpf,
      pacienteCns: r.paciente_cns,
      dispensadorNome: r.dispensador_nome,
      totalItens: Number(r.total_itens ?? 0),
      medicamentosResumo: r.medicamentos_resumo ?? "",
    }));

    return { itens, totalItens };
  }

  /**
   * Busca as linhas detalhadas (item a item) para preenchimento das 12 colunas da planilha .xlsx.
   */
  async buscarParaExportacao(
    filtros: Omit<FiltrosHistoricoResolvidos, "pagina" | "limite">,
  ): Promise<LinhaExportacaoDispensacaoDto[]> {
    const manager = this.transactionContext.getManager();
    const { whereSql, params } = this.montarFiltrosSql(filtros);

    const rows = await manager.query(
      `SELECT
         d.created_at AS data_atendimento,
         d.status,
         p.nome_completo AS paciente_nome,
         p.cpf AS paciente_cpf,
         p.cns AS paciente_cns,
         COALESCE(u.nome_completo, 'Farmacêutico') AS dispensador_nome,
         COALESCE(
           TRIM(COALESCE(m.principio_ativo, di.medicamento_id::text) || ' ' || COALESCE(m.apresentacao, '')),
           di.medicamento_id::text
         ) AS medicamento_apresentacao,
         COALESCE(m.categoria, 'GERAL') AS categoria,
         COALESCE(l.numero_lote, di.lote_id::text) AS numero_lote,
         COALESCE(l.data_validade::text, '') AS data_validade_lote,
         di.quantidade_dispensada,
         COALESCE(di.posologia, '') AS posologia
       FROM public.dispensacoes d
       INNER JOIN public.pacientes p ON p.id = d.paciente_id
       LEFT JOIN public.users u ON u.id = d.dispensador_id
       INNER JOIN public.dispensacao_itens di ON di.dispensacao_id = d.id
       LEFT JOIN public.medicamentos m ON m.id = di.medicamento_id
       LEFT JOIN public.lotes l ON l.id = di.lote_id
       WHERE ${whereSql}
       ORDER BY d.created_at DESC`,
      params,
    );

    return rows.map((r: any) => ({
      dataHoraAtendimento:
        r.data_atendimento instanceof Date
          ? r.data_atendimento.toISOString()
          : String(r.data_atendimento),
      pacienteNome: r.paciente_nome,
      pacienteCpfFormatado: formatarCPF(String(r.paciente_cpf ?? "")),
      pacienteCns: r.paciente_cns,
      medicamentoApresentacao: r.medicamento_apresentacao,
      categoria: r.categoria,
      numeroLote: r.numero_lote,
      dataValidadeLote: String(r.data_validade_lote).slice(0, 10),
      quantidadeDispensada: Number(r.quantidade_dispensada),
      posologia: r.posologia,
      dispensadorNome: r.dispensador_nome,
      statusAtendimento: r.status,
    }));
  }

  /**
   * Busca a dispensação e seus itens com bloqueio para estorno na UBS atual.
   */
  async buscarDispensacaoParaEstorno(
    dispensacaoId: string,
    unidadeId?: string | null,
  ): Promise<DispensacaoParaEstornoInfo | null> {
    const manager = this.transactionContext.getManager();
    const dispRows = await manager.query(
      `SELECT d.id, d.unidade_id, d.status
         FROM public.dispensacoes d
        WHERE d.id = $1::uuid
          AND ($2::uuid IS NULL OR d.unidade_id = $2::uuid)
        FOR UPDATE OF d`,
      [dispensacaoId, unidadeId ?? null],
    );

    const disp = dispRows[0];
    if (!disp) return null;

    const itemRows = await manager.query(
      `SELECT
         di.lote_id,
         COALESCE(l.numero_lote, di.lote_id::text) AS numero_lote,
         di.quantidade_dispensada
       FROM public.dispensacao_itens di
       LEFT JOIN public.lotes l ON l.id = di.lote_id
       WHERE di.dispensacao_id = $1::uuid`,
      [dispensacaoId],
    );

    return {
      id: disp.id,
      unidadeId: disp.unidade_id,
      status: disp.status,
      itens: itemRows.map((i: any) => ({
        loteId: i.lote_id,
        numeroLote: i.numero_lote,
        quantidadeDispensada: Number(i.quantidade_dispensada),
      })),
    };
  }

  /**
   * Atualiza o status da dispensação para 'estornada' e restitui os saldos físicos aos lotes.
   */
  async executarEstornoAtomico(params: {
    dispensacaoId: string;
    estornadoPorId: string;
    motivoEstorno: string;
    itens: {
      loteId: string;
      numeroLote: string;
      quantidadeDispensada: number;
    }[];
  }): Promise<EstornarDispensacaoResultado> {
    const manager = this.transactionContext.getManager();
    const agora = new Date();

    await manager.update(
      DispensacaoEntity,
      { id: params.dispensacaoId },
      {
        status: "estornada",
        estornado_em: agora,
        estornado_por_id: params.estornadoPorId,
        motivo_estorno: params.motivoEstorno,
      },
    );

    const itensDevolvidos: EstornarDispensacaoResultado["itensDevolvidos"] = [];
    for (const item of params.itens) {
      const loteRows = await manager.query(
        `UPDATE public.lotes
            SET saldo_atual = saldo_atual + $2,
                updated_at = now()
          WHERE id = $1::uuid
        RETURNING saldo_atual`,
        [item.loteId, item.quantidadeDispensada],
      );

      itensDevolvidos.push({
        loteId: item.loteId,
        numeroLote: item.numeroLote,
        quantidadeRestituida: item.quantidadeDispensada,
        novoSaldoLote: Number(loteRows[0]?.saldo_atual ?? 0),
      });
    }

    return {
      id: params.dispensacaoId,
      status: "estornada",
      estornadoEm: agora,
      motivoEstorno: params.motivoEstorno,
      itensDevolvidos,
    };
  }

  private montarFiltrosSql(
    filtros: Omit<FiltrosHistoricoResolvidos, "pagina" | "limite">,
  ): { whereSql: string; params: unknown[] } {
    const clauses: string[] = [
      "d.created_at >= ($1::date)::timestamptz",
      "d.created_at <= (($2::date) + interval '1 day' - interval '1 millisecond')::timestamptz",
    ];
    const params: unknown[] = [filtros.dataInicio, filtros.dataFim];

    if (filtros.unidadeId) {
      params.push(filtros.unidadeId);
      clauses.push(`d.unidade_id = $${params.length}::uuid`);
    }

    if (filtros.status) {
      params.push(filtros.status);
      clauses.push(`d.status = $${params.length}`);
    }

    if (filtros.pacienteTermo) {
      const num = limparNaoNumericos(filtros.pacienteTermo);
      params.push(`%${filtros.pacienteTermo}%`);
      const idxNome = params.length;
      if (num.length >= 3) {
        params.push(`%${num}%`);
        const idxNum = params.length;
        clauses.push(
          `(p.nome_completo ILIKE $${idxNome} OR p.cpf ILIKE $${idxNum} OR p.cns ILIKE $${idxNum})`,
        );
      } else {
        clauses.push(`p.nome_completo ILIKE $${idxNome}`);
      }
    }

    if (filtros.medicamentoTermo) {
      params.push(`%${filtros.medicamentoTermo}%`);
      const idxMed = params.length;
      clauses.push(
        `(m.principio_ativo ILIKE $${idxMed} OR m.nome_comercial ILIKE $${idxMed})`,
      );
    }

    if (filtros.categoria) {
      params.push(filtros.categoria);
      clauses.push(`m.categoria ILIKE $${params.length}`);
    }

    return {
      whereSql: clauses.join(" AND "),
      params,
    };
  }
}

