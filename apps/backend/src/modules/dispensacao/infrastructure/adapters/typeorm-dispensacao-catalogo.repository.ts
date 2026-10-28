import { Injectable } from "@nestjs/common";
import type { LoteEntradaFefo, MedicamentoBuscaDto } from "@farmaubs/shared";
import { TransactionContext } from "../../../../common/transaction/transaction-context.service";
import type { DispensacaoCatalogoRepositoryPort } from "../../domain/ports/dispensacao-catalogo.repository.port";

interface MedicamentoRow {
  id: string;
  principio_ativo: string;
  nome_comercial?: string | null;
  apresentacao: string;
  categoria?: string | null;
  antimicrobiano?: boolean | null;
  saldo_total_ubs?: string | number | null;
}

interface LoteRow {
  id: string;
  numero_lote: string;
  data_validade: string | Date;
  saldo_atual: number;
  created_at?: Date | string;
}

@Injectable()
export class TypeOrmDispensacaoCatalogoRepository
  implements DispensacaoCatalogoRepositoryPort
{
  constructor(private readonly transactionContext: TransactionContext) {}

  /**
   * Busca medicamentos ativos por termo textual e soma o saldo disponível na UBS informada.
   */
  async buscarPorTermoEUnidade(
    termo: string,
    unidadeId?: string | null,
  ): Promise<MedicamentoBuscaDto[]> {
    const manager = this.transactionContext.getManager();
    const rows: MedicamentoRow[] = await manager.query(
      `SELECT
         p.id,
         p.principio_ativo,
         p.nome_comercial,
         p.apresentacao,
         COALESCE(p.categoria, 'GERAL') AS categoria,
         COALESCE(p.antimicrobiano, false) AS antimicrobiano,
         COALESCE(SUM(l.saldo_atual), 0)::int AS saldo_total_ubs
       FROM public.produtos p
       LEFT JOIN public.lotes l
         ON l.produto_id = p.id
        AND l.saldo_atual > 0
        AND l.status = 'ATIVO'
        AND ($2::uuid IS NULL OR l.ubs_id = $2::uuid)
       WHERE p.ativo = true
         AND (
           p.principio_ativo ILIKE $1
           OR p.nome_comercial ILIKE $1
           OR p.apresentacao ILIKE $1
         )
       GROUP BY p.id, p.principio_ativo, p.nome_comercial, p.apresentacao, p.categoria, p.antimicrobiano
       ORDER BY p.principio_ativo ASC
       LIMIT 20`,
      [`%${termo}%`, unidadeId ?? null],
    );

    return rows.map((r) => this.toMedicamentoDto(r));
  }

  /**
   * Obtém os dados de um medicamento específico do catálogo ativo com seu saldo na UBS.
   */
  async buscarMedicamentoPorId(
    medicamentoId: string,
    unidadeId?: string | null,
  ): Promise<MedicamentoBuscaDto | null> {
    const manager = this.transactionContext.getManager();
    const rows: MedicamentoRow[] = await manager.query(
      `SELECT
         p.id,
         p.principio_ativo,
         p.nome_comercial,
         p.apresentacao,
         COALESCE(p.categoria, 'GERAL') AS categoria,
         COALESCE(p.antimicrobiano, false) AS antimicrobiano,
         COALESCE(SUM(l.saldo_atual), 0)::int AS saldo_total_ubs
       FROM public.produtos p
       LEFT JOIN public.lotes l
         ON l.produto_id = p.id
        AND l.saldo_atual > 0
        AND l.status = 'ATIVO'
        AND ($2::uuid IS NULL OR l.ubs_id = $2::uuid)
       WHERE p.id = $1::uuid
         AND p.ativo = true
       GROUP BY p.id, p.principio_ativo, p.nome_comercial, p.apresentacao, p.categoria, p.antimicrobiano`,
      [medicamentoId, unidadeId ?? null],
    );

    return rows[0] ? this.toMedicamentoDto(rows[0]) : null;
  }

  /**
   * Lista os lotes com saldo > 0 para o medicamento na UBS ativa ordenados por validade e criação.
   */
  async listarLotesPorMedicamentoEUnidade(
    medicamentoId: string,
    unidadeId?: string | null,
  ): Promise<LoteEntradaFefo[]> {
    const manager = this.transactionContext.getManager();
    const rows: LoteRow[] = await manager.query(
      `SELECT
         l.id,
         l.numero_lote,
         l.data_validade,
         l.saldo_atual,
         l.created_at
       FROM public.lotes l
       WHERE l.produto_id = $1::uuid
         AND l.saldo_atual > 0
         AND l.status = 'ATIVO'
         AND ($2::uuid IS NULL OR l.ubs_id = $2::uuid)
       ORDER BY l.data_validade ASC, l.created_at ASC`,
      [medicamentoId, unidadeId ?? null],
    );

    return rows.map((r) => ({
      id: r.id,
      numeroLote: r.numero_lote,
      dataValidade:
        r.data_validade instanceof Date
          ? r.data_validade.toISOString().slice(0, 10)
          : String(r.data_validade).slice(0, 10),
      saldoDisponivel: Number(r.saldo_atual),
      criadoEm: r.created_at,
    }));
  }

  private toMedicamentoDto(r: MedicamentoRow): MedicamentoBuscaDto {
    const antimicrobiano = Boolean(r.antimicrobiano);
    return {
      id: r.id,
      principioAtivo: r.principio_ativo,
      nomeComercial: r.nome_comercial ?? undefined,
      apresentacao: r.apresentacao,
      categoria: r.categoria ?? "GERAL",
      antimicrobiano,
      requerDataReceita: antimicrobiano,
      saldoTotalUbs: Number(r.saldo_total_ubs ?? 0),
    };
  }
}

