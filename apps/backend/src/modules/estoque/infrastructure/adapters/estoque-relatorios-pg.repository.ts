import { Injectable } from "@nestjs/common";
import type { TipoRelatorioEstoque } from "@farmaubs/shared";
import { TransactionContext } from "../../../../common/transaction/transaction-context.service";
import type {
  CabecalhoUbsRelatorio,
  FiltrosConsultaRelatorioEstoque,
  RepositorioEstoqueRelatoriosPort,
} from "../../domain/ports/estoque-relatorios.repository.port";
import type {
  LinhaRelatorioEstoque,
  LinhaRelatorioMovimentacoesPeriodo,
  LinhaRelatorioPerdasVencimento,
  LinhaRelatorioSaldosAtuais,
} from "../../domain/ports/gerador-planilha-estoque.port";

interface SaldoAtualRow {
  medicamento: string;
  principioAtivo: string | null;
  fabricante: string | null;
  lote: string;
  validade: string;
  saldo: number | string;
  status: string;
}

interface PerdaVencimentoRow {
  data: string;
  medicamento: string;
  lote: string;
  quantidade: number | string;
  motivo: string;
}

interface MovimentacaoPeriodoRow {
  dataHoraRaw: Date | string;
  tipo: string;
  medicamento: string;
  lote: string;
  quantidade: number | string;
  saldoResultante: number | string;
  responsavel: string;
}

interface CabecalhoUbsRow {
  nomeUbs: string;
  municipio: string;
}

/**
 * [RF020 / RF028 / NF007 / NF015]: Adaptador PostgreSQL para geração de relatórios de estoque.
 * Executa as consultas na mesma conexão em que o RLS foi configurado via TransactionContext (app.municipio_id),
 * mantendo o filtro explícito por ubs_id em todas as consultas.
 */
@Injectable()
export class EstoqueRelatoriosPgRepository implements RepositorioEstoqueRelatoriosPort {
  constructor(private readonly transactionContext: TransactionContext) {}

  /**
   * Obtém nome, CNES e município da UBS para o cabeçalho institucional do relatório.
   */
  async obterCabecalhoUbs(ubsId: string): Promise<CabecalhoUbsRelatorio | null> {
    const manager = this.transactionContext.getManager();
    const sql = `
      SELECT
        u.nome AS "nomeUbs",
        m.nome AS "municipio"
      FROM public.unidades_saude u
      JOIN public.municipios m ON m.id = u.municipio_id
      WHERE u.id = $1::uuid
      LIMIT 1
    `;
    const rows: CabecalhoUbsRow[] = await manager.query(sql, [ubsId]);
    if (!rows || rows.length === 0) {
      return null;
    }
    const row = rows[0];
    return {
      nomeUbs: row.nomeUbs,
      municipio: row.municipio,
    };
  }

  /**
   * [RF028]: Consulta saldos atuais de todos os lotes com saldo positivo da UBS.
   * Filtros opcionais por princípio ativo (ILIKE), produtoId ou categoria.
   */
  async consultarSaldosAtuais(
    filtros: FiltrosConsultaRelatorioEstoque,
  ): Promise<LinhaRelatorioSaldosAtuais[]> {
    const manager = this.transactionContext.getManager();
    const params: unknown[] = [filtros.ubsId];
    const whereClauses: string[] = [
      "l.ubs_id = $1::uuid",
      "l.status = 'ATIVO'",
      "l.saldo_atual > 0",
    ];

    if (filtros.principioAtivo) {
      params.push(`%${filtros.principioAtivo}%`);
      whereClauses.push(`p.principio_ativo ILIKE $${params.length}`);
    }

    if (filtros.produtoId) {
      params.push(filtros.produtoId);
      whereClauses.push(`p.id = $${params.length}::uuid`);
    }

    if (filtros.categoria) {
      params.push(filtros.categoria);
      whereClauses.push(`p.categoria = $${params.length}`);
    }

    const sql = `
      SELECT
        COALESCE(p.nome_comercial, p.principio_ativo) AS medicamento,
        p.principio_ativo AS "principioAtivo",
        COALESCE(f.nome_fantasia, f.razao_social) AS fabricante,
        l.numero_lote AS lote,
        to_char(l.data_validade, 'YYYY-MM-DD') AS validade,
        l.saldo_atual AS saldo,
        l.status AS status
      FROM public.lotes l
      JOIN public.produtos p ON p.id = l.produto_id
      JOIN public.fabricantes f ON f.id = l.fabricante_id
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY p.principio_ativo ASC, l.data_validade ASC, l.numero_lote ASC
    `;

    const rows: SaldoAtualRow[] = await manager.query(sql, params);
    return rows.map((r) => ({
      medicamento: r.medicamento,
      principioAtivo: r.principioAtivo ?? undefined,
      fabricante: r.fabricante ?? undefined,
      lote: r.lote,
      validade: r.validade,
      saldo: Number(r.saldo),
      status: r.status,
    }));
  }

  /**
   * [RF020 / RF028]: Consulta perdas por vencimento e avaria física no período informado.
   * Considera baixas de ajuste de saída com motivo VENCIMENTO ou AVARIA_FISICA.
   * Regra de dataFim inclusiva: created_at < dataFim + 1 dia.
   */
  async consultarPerdasVencimento(
    filtros: FiltrosConsultaRelatorioEstoque,
  ): Promise<LinhaRelatorioPerdasVencimento[]> {
    const manager = this.transactionContext.getManager();
    const params: unknown[] = [filtros.ubsId];
    const whereClauses: string[] = [
      "m.ubs_id = $1::uuid",
      "m.tipo_movimentacao = 'AJUSTE_SAIDA'",
      "m.motivo IN ('VENCIMENTO', 'AVARIA_FISICA')",
    ];

    if (filtros.dataInicio) {
      params.push(filtros.dataInicio);
      whereClauses.push(
        `m.created_at >= ($${params.length}::date)::timestamp AT TIME ZONE 'America/Fortaleza'`,
      );
    }

    if (filtros.dataFim) {
      params.push(filtros.dataFim);
      whereClauses.push(
        `m.created_at < (($${params.length}::date) + interval '1 day')::timestamp AT TIME ZONE 'America/Fortaleza'`,
      );
    }

    if (filtros.principioAtivo) {
      params.push(`%${filtros.principioAtivo}%`);
      whereClauses.push(`p.principio_ativo ILIKE $${params.length}`);
    }

    if (filtros.produtoId) {
      params.push(filtros.produtoId);
      whereClauses.push(`p.id = $${params.length}::uuid`);
    }

    if (filtros.categoria) {
      params.push(filtros.categoria);
      whereClauses.push(`p.categoria = $${params.length}`);
    }

    const sql = `
      SELECT
        to_char(m.created_at AT TIME ZONE 'America/Fortaleza', 'YYYY-MM-DD') AS data,
        COALESCE(p.nome_comercial, p.principio_ativo) AS medicamento,
        l.numero_lote AS lote,
        m.quantidade AS quantidade,
        m.motivo AS motivo
      FROM public.movimentacoes_estoque m
      JOIN public.lotes l ON l.id = m.lote_id
      JOIN public.produtos p ON p.id = l.produto_id
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY m.created_at DESC, m.id DESC
    `;

    const rows: PerdaVencimentoRow[] = await manager.query(sql, params);
    return rows.map((r) => ({
      data: r.data,
      medicamento: r.medicamento,
      lote: r.lote,
      quantidade: Number(r.quantidade),
      motivo: r.motivo,
    }));
  }

  /**
   * [RF028]: Extrato cronológico de todas as movimentações da UBS no período informado.
   * Regra de dataFim inclusiva: created_at < dataFim + 1 dia.
   */
  async consultarMovimentacoesPeriodo(
    filtros: FiltrosConsultaRelatorioEstoque,
  ): Promise<LinhaRelatorioMovimentacoesPeriodo[]> {
    const manager = this.transactionContext.getManager();
    const params: unknown[] = [filtros.ubsId];
    const whereClauses: string[] = ["m.ubs_id = $1::uuid"];

    if (filtros.dataInicio) {
      params.push(filtros.dataInicio);
      whereClauses.push(
        `m.created_at >= ($${params.length}::date)::timestamp AT TIME ZONE 'America/Fortaleza'`,
      );
    }

    if (filtros.dataFim) {
      params.push(filtros.dataFim);
      whereClauses.push(
        `m.created_at < (($${params.length}::date) + interval '1 day')::timestamp AT TIME ZONE 'America/Fortaleza'`,
      );
    }

    if (filtros.principioAtivo) {
      params.push(`%${filtros.principioAtivo}%`);
      whereClauses.push(`p.principio_ativo ILIKE $${params.length}`);
    }

    if (filtros.produtoId) {
      params.push(filtros.produtoId);
      whereClauses.push(`p.id = $${params.length}::uuid`);
    }

    if (filtros.categoria) {
      params.push(filtros.categoria);
      whereClauses.push(`p.categoria = $${params.length}`);
    }

    const sql = `
      SELECT
        m.created_at AS "dataHoraRaw",
        m.tipo_movimentacao AS tipo,
        COALESCE(p.nome_comercial, p.principio_ativo) AS medicamento,
        l.numero_lote AS lote,
        m.quantidade AS quantidade,
        m.saldo_posterior AS "saldoResultante",
        u.nome_completo AS responsavel
      FROM public.movimentacoes_estoque m
      JOIN public.lotes l ON l.id = m.lote_id
      JOIN public.produtos p ON p.id = l.produto_id
      JOIN public.users u ON u.id = m.usuario_id
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY m.created_at ASC, m.id ASC
    `;

    const rows: MovimentacaoPeriodoRow[] = await manager.query(sql, params);
    return rows.map((r) => ({
      dataHora:
        r.dataHoraRaw instanceof Date
          ? r.dataHoraRaw.toISOString()
          : new Date(r.dataHoraRaw).toISOString(),
      tipo: r.tipo,
      medicamento: r.medicamento,
      lote: r.lote,
      quantidade: Number(r.quantidade),
      saldoResultante: Number(r.saldoResultante),
      responsavel: r.responsavel,
    }));
  }

  /**
   * [RF028]: Ponto de entrada polimórfico que despacha para a consulta do tipo informado.
   */
  async consultarDadosParaRelatorio(
    tipo: TipoRelatorioEstoque,
    filtros: FiltrosConsultaRelatorioEstoque,
  ): Promise<LinhaRelatorioEstoque[]> {
    switch (tipo) {
      case "SALDOS_ATUAIS":
        return this.consultarSaldosAtuais(filtros);
      case "PERDAS_VENCIMENTO":
        return this.consultarPerdasVencimento(filtros);
      case "MOVIMENTACOES_PERIODO":
        return this.consultarMovimentacoesPeriodo(filtros);
      default:
        throw new Error(`Tipo de relatório não suportado: ${tipo}`);
    }
  }
}
