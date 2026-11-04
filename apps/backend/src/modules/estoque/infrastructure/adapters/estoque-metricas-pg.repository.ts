import { Injectable } from "@nestjs/common";
import { TransactionContext } from "../../../../common/transaction/transaction-context.service";
import type {
  ConsumoProdutoAgregado,
  ContagemLotesValidade,
  RepositorioEstoqueMetricasPort,
} from "../../domain/ports/estoque-metricas.repository.port";

/** Janela de apuração do consumo médio diário (RF023). */
export const JANELA_CONSUMO_DIAS = 90;
/** Limite de validade curta em dias corridos (RF022). */
export const LIMITE_VALIDADE_CURTA_DIAS = 90;

interface TotaisRow {
  total_medicamentos_ativos: number | string;
  total_unidades_fisicas: number | string;
}

interface ConsumoRow {
  produto_id: string;
  saldo_atual: number | string;
  total_dispensado: number | string;
  dias_apurados: number | string;
}

interface ValidadeRow {
  lotes_vencidos: number | string;
  lotes_validade_mes_atual: number | string;
  lotes_validade_curta_90d: number | string;
}

@Injectable()
export class EstoqueMetricasPgRepository implements RepositorioEstoqueMetricasPort {
  constructor(private readonly transactionContext: TransactionContext) {}

  /**
   * [RF018]: Totaliza medicamentos ativos com lote na UBS e unidades físicas (saldo > 0).
   * @param ubsId - UBS consultada (filtro explícito; o RLS isola apenas o município).
   * @returns Totais agregados no banco.
   */
  async obterTotais(ubsId: string): Promise<{
    totalMedicamentosAtivos: number;
    totalUnidadesFisicas: number;
  }> {
    const manager = this.transactionContext.getManager();
    const rows: TotaisRow[] = await manager.query(
      `SELECT
         COUNT(DISTINCT l.produto_id) FILTER (WHERE p.ativo)::int AS total_medicamentos_ativos,
         COALESCE(SUM(l.saldo_atual) FILTER (WHERE l.saldo_atual > 0), 0)::int AS total_unidades_fisicas
       FROM public.lotes l
       JOIN public.produtos p ON p.id = l.produto_id
       WHERE l.ubs_id = $1::uuid
         AND l.status = 'ATIVO'`,
      [ubsId],
    );
    const r = rows[0];
    return {
      totalMedicamentosAtivos: Number(r?.total_medicamentos_ativos ?? 0),
      totalUnidadesFisicas: Number(r?.total_unidades_fisicas ?? 0),
    };
  }

  /**
   * [RF023]: Saldo atual e consumo dos últimos 90 dias por medicamento da UBS.
   * @param ubsId - UBS consultada.
   * @param hoje - Data de referência 'AAAA-MM-DD'.
   * @returns Uma linha por medicamento ativo com lote na UBS (inclui saldo zero).
   */
  async listarConsumoPorProduto(
    ubsId: string,
    hoje: string,
  ): Promise<ConsumoProdutoAgregado[]> {
    const manager = this.transactionContext.getManager();
    const rows: ConsumoRow[] = await manager.query(
      `WITH saldo AS (
         SELECT l.produto_id, COALESCE(SUM(l.saldo_atual), 0)::int AS saldo_atual
         FROM public.lotes l
         JOIN public.produtos p ON p.id = l.produto_id AND p.ativo = true
         WHERE l.ubs_id = $1::uuid
           AND l.status = 'ATIVO'
         GROUP BY l.produto_id
       ),
       consumo AS (
         SELECT di.medicamento_id AS produto_id,
                SUM(di.quantidade_dispensada)::int AS total_dispensado,
                MIN(d.created_at) AS primeira_dispensacao
         FROM public.dispensacao_itens di
         JOIN public.dispensacoes d ON d.id = di.dispensacao_id
         WHERE d.unidade_id = $1::uuid
           AND d.status = 'concluida'
           AND d.created_at >= ($2::date - $3::int)
         GROUP BY di.medicamento_id
       )
       SELECT
         s.produto_id,
         s.saldo_atual,
         COALESCE(c.total_dispensado, 0)::int AS total_dispensado,
         CASE
           WHEN c.primeira_dispensacao IS NULL THEN $3::int
           ELSE GREATEST(1, LEAST($3::int, ($2::date - c.primeira_dispensacao::date)))
         END AS dias_apurados
       FROM saldo s
       LEFT JOIN consumo c ON c.produto_id = s.produto_id`,
      [ubsId, hoje, JANELA_CONSUMO_DIAS],
    );

    return rows.map((r) => ({
      produtoId: r.produto_id,
      saldoAtual: Number(r.saldo_atual),
      totalDispensado: Number(r.total_dispensado),
      diasApurados: Number(r.dias_apurados),
    }));
  }

  /**
   * [RF022]: Conta lotes com saldo > 0 vencidos, vencendo no mês e com validade curta.
   * @param ubsId - UBS consultada.
   * @param hoje - Data de referência 'AAAA-MM-DD'.
   * @returns Contagens agregadas via COUNT(*) FILTER.
   */
  async contarLotesPorValidade(
    ubsId: string,
    hoje: string,
  ): Promise<ContagemLotesValidade> {
    const manager = this.transactionContext.getManager();
    const rows: ValidadeRow[] = await manager.query(
      `SELECT
         COUNT(*) FILTER (WHERE l.data_validade < $2::date)::int AS lotes_vencidos,
         COUNT(*) FILTER (
           WHERE l.data_validade >= $2::date
             AND l.data_validade < (date_trunc('month', $2::date) + interval '1 month')::date
         )::int AS lotes_validade_mes_atual,
         COUNT(*) FILTER (
           WHERE l.data_validade >= $2::date
             AND l.data_validade <= ($2::date + $3::int)
         )::int AS lotes_validade_curta_90d
       FROM public.lotes l
       WHERE l.ubs_id = $1::uuid
         AND l.status = 'ATIVO'
         AND l.saldo_atual > 0`,
      [ubsId, hoje, LIMITE_VALIDADE_CURTA_DIAS],
    );
    const r = rows[0];
    return {
      lotesVencidos: Number(r?.lotes_vencidos ?? 0),
      lotesValidadeMesAtual: Number(r?.lotes_validade_mes_atual ?? 0),
      lotesValidadeCurta90d: Number(r?.lotes_validade_curta_90d ?? 0),
    };
  }
}
