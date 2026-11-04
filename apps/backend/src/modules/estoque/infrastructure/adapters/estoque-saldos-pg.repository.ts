import { Injectable } from "@nestjs/common";
import {
  JANELA_VALIDADE_CURTA_DIAS,
  MARGEM_SEGURANCA_DIAS_PADRAO,
  TEMPO_ENTREGA_CAF_DIAS_PADRAO,
} from "@farmaubs/shared";
import { TransactionContext } from "../../../../common/transaction/transaction-context.service";
import type {
  FiltrosConsultaSaldos,
  LoteSaldoAgregado,
  ProdutoSaldoAgregado,
  RepositorioEstoqueSaldosPort,
  ResultadoSaldosPaginados,
} from "../../domain/ports/estoque-saldos.repository.port";
import { JANELA_CONSUMO_DIAS } from "./estoque-metricas-pg.repository";

/** Cobertura (dias) abaixo da qual o medicamento é BAIXO_ESTOQUE: prazo CAF + margem (ES-01). */
const LIMITE_COBERTURA_DIAS =
  TEMPO_ENTREGA_CAF_DIAS_PADRAO + MARGEM_SEGURANCA_DIAS_PADRAO;

const ACENTOS = "áàâãäéèêëíìîïóòôõöúùûüç";
const SEM_ACENTOS = "aaaaaeeeeiiiiooooouuuuc";
const CARACTER_ESCAPE = "!";

/** Normaliza uma coluna para busca case-insensitive e sem acentos. */
const normalizarColuna = (coluna: string): string =>
  `translate(lower(COALESCE(${coluna}, '')), '${ACENTOS}', '${SEM_ACENTOS}')`;

/** Normaliza o termo digitado e monta o padrão LIKE (escapando %, _ e o caractere de escape). */
function montarPadraoBusca(termo: string): string {
  const normalizado = termo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[!%_]/g, (c) => `${CARACTER_ESCAPE}${c}`);
  return `%${normalizado}%`;
}

interface ProdutoRow {
  produto_id: string;
  nome: string;
  principio_ativo: string;
  forma_farmaceutica: string;
  concentracao: string;
  unidade_medida: string;
  categoria: string;
  saldo_total: number | string;
  total_dispensado: number | string;
  dias_apurados: number | string;
}

interface LoteRow {
  id: string;
  produto_id: string;
  numero_lote: string;
  fabricante_id: string;
  fabricante_nome: string;
  data_validade: string;
  saldo_atual: number | string;
}

@Injectable()
export class EstoqueSaldosPgRepository implements RepositorioEstoqueSaldosPort {
  constructor(private readonly transactionContext: TransactionContext) {}

  /**
   * [RF005 / RF022]: Lista medicamentos com lote ativo na UBS, paginando por medicamento
   * (subconsulta) e carregando os lotes só dos medicamentos da página.
   * Filtra `ubs_id` explicitamente; o RLS isola o município via `app.municipio_id`.
   */
  async consultarSaldosPaginados(
    ubsId: string,
    filtros: FiltrosConsultaSaldos,
    hoje: string,
  ): Promise<ResultadoSaldosPaginados> {
    const manager = this.transactionContext.getManager();
    const { cte, params } = this.montarConsulta(ubsId, filtros, hoje);

    const contagem: { total: number | string }[] = await manager.query(
      `${cte} SELECT COUNT(*)::int AS total FROM filtrado`,
      params,
    );
    const total = Number(contagem[0]?.total ?? 0);
    if (total === 0) return { itens: [], total: 0 };

    const offset = (filtros.pagina - 1) * filtros.itensPorPagina;
    const produtos: ProdutoRow[] = await manager.query(
      `${cte}
       SELECT produto_id, nome, principio_ativo, forma_farmaceutica, concentracao,
              unidade_medida, categoria, saldo_total, total_dispensado, dias_apurados
       FROM filtrado
       ORDER BY lower(nome), produto_id
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filtros.itensPorPagina, offset],
    );
    if (produtos.length === 0) return { itens: [], total };

    const lotes: LoteRow[] = await manager.query(
      `SELECT l.id, l.produto_id, l.numero_lote, l.fabricante_id,
              f.nome_fantasia AS fabricante_nome,
              l.data_validade::text AS data_validade, l.saldo_atual
       FROM public.lotes l
       JOIN public.fabricantes f ON f.id = l.fabricante_id
       WHERE l.ubs_id = $1::uuid
         AND l.status = 'ATIVO'
         AND l.saldo_atual > 0
         AND l.produto_id = ANY($2::uuid[])`,
      [ubsId, produtos.map((p) => p.produto_id)],
    );

    const lotesPorProduto = new Map<string, LoteSaldoAgregado[]>();
    for (const l of lotes) {
      const lista = lotesPorProduto.get(l.produto_id) ?? [];
      lista.push({
        id: l.id,
        numeroLote: l.numero_lote,
        fabricanteId: l.fabricante_id,
        fabricanteNome: l.fabricante_nome,
        dataValidade: l.data_validade,
        saldoAtual: Number(l.saldo_atual),
      });
      lotesPorProduto.set(l.produto_id, lista);
    }

    const itens: ProdutoSaldoAgregado[] = produtos.map((p) => ({
      produtoId: p.produto_id,
      nome: p.nome,
      principioAtivo: p.principio_ativo,
      formaFarmaceutica: p.forma_farmaceutica,
      concentracao: p.concentracao,
      unidadeMedida: p.unidade_medida,
      categoria: p.categoria,
      saldoTotal: Number(p.saldo_total),
      totalDispensado: Number(p.total_dispensado),
      diasApurados: Number(p.dias_apurados),
      lotes: lotesPorProduto.get(p.produto_id) ?? [],
    }));

    return { itens, total };
  }

  /**
   * Monta a CTE comum (saldo, consumo, status e filtros) e os parâmetros posicionais.
   * Todo parâmetro adicionado aparece no texto da CTE.
   */
  private montarConsulta(
    ubsId: string,
    filtros: FiltrosConsultaSaldos,
    hoje: string,
  ): { cte: string; params: unknown[] } {
    const params: unknown[] = [
      ubsId,
      hoje,
      JANELA_CONSUMO_DIAS,
      LIMITE_COBERTURA_DIAS,
    ];
    const adicionar = (valor: unknown): string => {
      params.push(valor);
      return `$${params.length}`;
    };

    const condicoes: string[] = [];

    if (filtros.termo) {
      const p = adicionar(montarPadraoBusca(filtros.termo));
      const like = (coluna: string) =>
        `${normalizarColuna(coluna)} LIKE ${p} ESCAPE '${CARACTER_ESCAPE}'`;
      condicoes.push(
        `(${like("a.nome_comercial")}
          OR ${like("a.principio_ativo")}
          OR ${like("a.apresentacao")}
          OR EXISTS (
            SELECT 1 FROM public.lotes lt
            WHERE lt.ubs_id = $1::uuid AND lt.status = 'ATIVO'
              AND lt.produto_id = a.produto_id
              AND ${like("lt.numero_lote")}
          ))`,
      );
    }

    if (filtros.categoria) {
      condicoes.push(`lower(a.categoria) = lower(${adicionar(filtros.categoria)}::text)`);
    }

    if (filtros.statusEstoque !== "TODOS") {
      condicoes.push(`a.status_estoque = ${adicionar(filtros.statusEstoque)}::text`);
    }

    const lotePorValidade = (condicaoLote: string) =>
      `EXISTS (
         SELECT 1 FROM public.lotes lv
         WHERE lv.ubs_id = $1::uuid AND lv.status = 'ATIVO' AND lv.saldo_atual > 0
           AND lv.produto_id = a.produto_id
           AND ${condicaoLote}
       )`;

    if (filtros.filtroValidade === "MES_CORRENTE") {
      condicoes.push(
        lotePorValidade(
          `lv.data_validade >= $2::date
           AND lv.data_validade < (date_trunc('month', $2::date) + interval '1 month')::date`,
        ),
      );
    } else if (filtros.filtroValidade === "VALIDADE_90D") {
      const janela = adicionar(JANELA_VALIDADE_CURTA_DIAS);
      condicoes.push(
        lotePorValidade(
          `lv.data_validade >= $2::date AND lv.data_validade <= ($2::date + ${janela}::int)`,
        ),
      );
    } else if (filtros.filtroValidade === "VENCIDOS") {
      condicoes.push(lotePorValidade(`lv.data_validade < $2::date`));
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";

    const cte = `
      WITH base AS (
        SELECT l.produto_id, COALESCE(SUM(l.saldo_atual), 0)::bigint AS saldo_total
        FROM public.lotes l
        WHERE l.ubs_id = $1::uuid AND l.status = 'ATIVO'
        GROUP BY l.produto_id
      ),
      consumo AS (
        SELECT di.medicamento_id AS produto_id,
               SUM(di.quantidade_dispensada)::bigint AS total_dispensado,
               GREATEST(1, LEAST($3::int, ($2::date - MIN(d.created_at)::date))) AS dias_apurados
        FROM public.dispensacao_itens di
        JOIN public.dispensacoes d ON d.id = di.dispensacao_id
        WHERE d.unidade_id = $1::uuid
          AND d.status = 'concluida'
          AND d.created_at >= ($2::date - $3::int)
        GROUP BY di.medicamento_id
      ),
      agregado AS (
        SELECT p.id AS produto_id,
               COALESCE(NULLIF(p.nome_comercial, ''), p.principio_ativo) AS nome,
               p.nome_comercial,
               p.principio_ativo,
               p.apresentacao,
               COALESCE(p.forma_farmaceutica, '') AS forma_farmaceutica,
               COALESCE(p.dosagem, '') AS concentracao,
               COALESCE(p.unidade_medida, '') AS unidade_medida,
               p.categoria,
               b.saldo_total,
               COALESCE(c.total_dispensado, 0) AS total_dispensado,
               COALESCE(c.dias_apurados, $3::int) AS dias_apurados,
               CASE
                 WHEN b.saldo_total <= 0 THEN 'ZERADO'
                 WHEN COALESCE(c.total_dispensado, 0) > 0
                  AND b.saldo_total * c.dias_apurados <= $4::int * c.total_dispensado
                   THEN 'BAIXO_ESTOQUE'
                 ELSE 'REGULAR'
               END AS status_estoque
        FROM base b
        JOIN public.produtos p ON p.id = b.produto_id AND p.ativo = true
        LEFT JOIN consumo c ON c.produto_id = b.produto_id
      ),
      filtrado AS (
        SELECT a.* FROM agregado a ${where}
      )`;

    return { cte, params };
  }
}
