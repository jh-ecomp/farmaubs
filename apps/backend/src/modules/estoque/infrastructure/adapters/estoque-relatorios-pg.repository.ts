import { Injectable } from "@nestjs/common";
import {
  MOTIVOS_PERDA_RELATORIO,
  type TipoRelatorioEstoque,
} from "@farmaubs/shared";
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

const ACENTOS = "áàâãäéèêëíìîïóòôõöúùûüç";
const SEM_ACENTOS = "aaaaaeeeeiiiiooooouuuuc";
const CARACTER_ESCAPE = "!";

/** Normaliza uma coluna SQL para comparação case-insensitive e sem acentos. */
const normalizarColuna = (coluna: string): string =>
  `translate(lower(COALESCE(${coluna}, '')), '${ACENTOS}', '${SEM_ACENTOS}')`;

/** Normaliza o termo digitado e monta o padrão LIKE escapando !, % e _. */
function montarPadraoBusca(termo: string): string {
  const normalizado = termo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[!%_]/g, (c) => `${CARACTER_ESCAPE}${c}`);
  return `%${normalizado}%`;
}

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
 * Executa as consultas na mesma conexão transacional em que o RLS foi aplicado via TransactionContext (`app.municipio_id`),
 * combinando isolamento municipal por RLS e filtro explícito por `ubs_id`.
 */
@Injectable()
export class EstoqueRelatoriosPgRepository
  implements RepositorioEstoqueRelatoriosPort
{
  constructor(private readonly transactionContext: TransactionContext) {}

  /**
   * [RF028 / NF015]: Obtém nome da UBS e município para o cabeçalho institucional do relatório.
   * @param ubsId - UUID da UBS consultada.
   * `unidades_saude` é tabela global (sem RLS), então o município ativo (`app.municipio_id`) é filtrado explicitamente.
   * @returns Dados institucionais da UBS ou `null` quando inexistente ou fora do município ativo.
   */
  async obterCabecalhoUbs(
    ubsId: string,
  ): Promise<CabecalhoUbsRelatorio | null> {
    const manager = this.transactionContext.getManager();
    const sql = `
      SELECT
        u.nome AS "nomeUbs",
        m.nome AS "municipio"
      FROM public.unidades_saude u
      JOIN public.municipios m ON m.id = u.municipio_id
      WHERE u.id = $1::uuid
        AND u.municipio_id = NULLIF(current_setting('app.municipio_id', true), '')::uuid
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
   * [RF028]: Consulta saldos atuais de todos os lotes ativos com saldo positivo da UBS.
   * @param filtros - `ubsId` e filtros opcionais por princípio ativo, `produtoId` e categoria.
   * @returns Lista de lotes com saldo positivo ordenada por princípio ativo e validade (FEFO).
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

    this.aplicarFiltrosProduto(filtros, params, whereClauses);

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
   * [RF020 / RF028]: Consulta perdas de estoque (`MOTIVOS_PERDA_RELATORIO`) no período informado.
   * @param filtros - `ubsId`, janela temporal (`dataInicio`, `dataFim` inclusiva) e filtros de produto.
   * @returns Baixas por motivo de perda ordenadas da mais recente para a mais antiga.
   */
  async consultarPerdasVencimento(
    filtros: FiltrosConsultaRelatorioEstoque,
  ): Promise<LinhaRelatorioPerdasVencimento[]> {
    const manager = this.transactionContext.getManager();
    const params: unknown[] = [filtros.ubsId, [...MOTIVOS_PERDA_RELATORIO]];
    const whereClauses: string[] = [
      "m.ubs_id = $1::uuid",
      "m.tipo_movimentacao = 'AJUSTE_SAIDA'",
      "m.motivo = ANY($2::text[])",
    ];

    this.aplicarFiltroPeriodo(filtros, params, whereClauses);
    this.aplicarFiltrosProduto(filtros, params, whereClauses);

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
   * @param filtros - `ubsId`, janela temporal (`dataInicio`, `dataFim` inclusiva) e filtros de produto.
   * @returns Movimentações em ordem cronológica ascendente com saldo resultante e responsável.
   */
  async consultarMovimentacoesPeriodo(
    filtros: FiltrosConsultaRelatorioEstoque,
  ): Promise<LinhaRelatorioMovimentacoesPeriodo[]> {
    const manager = this.transactionContext.getManager();
    const params: unknown[] = [filtros.ubsId];
    const whereClauses: string[] = ["m.ubs_id = $1::uuid"];

    this.aplicarFiltroPeriodo(filtros, params, whereClauses);
    this.aplicarFiltrosProduto(filtros, params, whereClauses);

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
   * @param tipo - Tipo de relatório (`SALDOS_ATUAIS`, `PERDAS_VENCIMENTO` ou `MOVIMENTACOES_PERIODO`).
   * @param filtros - Critérios de filtragem da consulta.
   * @returns Linhas correspondentes ao tipo de relatório solicitado.
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
        throw new Error(`Tipo de relatório não suportado: ${String(tipo)}`);
    }
  }

  private aplicarFiltroPeriodo(
    filtros: FiltrosConsultaRelatorioEstoque,
    params: unknown[],
    whereClauses: string[],
  ): void {
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
  }

  private aplicarFiltrosProduto(
    filtros: FiltrosConsultaRelatorioEstoque,
    params: unknown[],
    whereClauses: string[],
  ): void {
    if (filtros.principioAtivo) {
      params.push(montarPadraoBusca(filtros.principioAtivo));
      whereClauses.push(
        `${normalizarColuna("p.principio_ativo")} LIKE $${params.length} ESCAPE '${CARACTER_ESCAPE}'`,
      );
    }

    if (filtros.produtoId) {
      params.push(filtros.produtoId);
      whereClauses.push(`p.id = $${params.length}::uuid`);
    }

    if (filtros.categoria) {
      params.push(filtros.categoria);
      whereClauses.push(`lower(p.categoria) = lower($${params.length}::text)`);
    }
  }
}
