import { Injectable } from "@nestjs/common";
import { TransactionContext } from "../../../../common/transaction/transaction-context.service";
import type {
  RepositorioEstoqueRastreabilidadePort,
  RastreabilidadeLoteBruta,
} from "../../domain/ports/estoque-rastreabilidade.repository.port";

interface CabecalhoRow {
  lote_id: string;
  numero_lote: string;
  data_validade: string;
  saldo_atual: number | string;
  created_at: Date;
  fabricante_nome: string;
  produto_id: string;
  nome: string;
  principio_ativo: string;
  codigo_catmat: string | null;
  codigo_atc: string | null;
  forma_farmaceutica: string | null;
  dosagem: string | null;
  apresentacao: string | null;
}

interface MovimentacaoRow {
  id: string;
  created_at: Date;
  tipo_movimentacao: string;
  quantidade: number;
  saldo_anterior: number;
  saldo_posterior: number;
  documento_referencia: string | null;
  motivo: string | null;
  justificativa: string | null;
  usuario_id: string;
  usuario_nome: string;
}

@Injectable()
export class EstoqueRastreabilidadePgRepository implements RepositorioEstoqueRastreabilidadePort {
  constructor(private readonly transactionContext: TransactionContext) {}

  /**
   * [RF028 / NF007 / NF015]: Lê o cabeçalho do lote e a linha do tempo do livro-razão, filtrando `ubs_id`; o RLS isola o município.
   * @param loteId - UUID do lote consultado.
   * @param unidadeIds - UUIDs das UBSs às quais o usuário tem acesso.
   * @returns Dados brutos (lote, medicamento e movimentações em ordem cronológica) ou `null` se o lote não existir ou estiver fora das UBSs (vira 404).
   * @throws Erros do banco propagados de `manager.query`, sem tratamento local.
   */
  async buscarLinhaDoTempoLote(
    loteId: string,
    unidadeIds: string[],
  ): Promise<RastreabilidadeLoteBruta | null> {
    const manager = this.transactionContext.getManager();

    const cabecalho: CabecalhoRow[] = await manager.query(
      `SELECT l.id AS lote_id, l.numero_lote,
        to_char(l.data_validade, 'YYYY-MM-DD') AS data_validade,
        l.saldo_atual,
        l.created_at,
        COALESCE(f.nome_fantasia, f.razao_social) AS fabricante_nome,
        p.id AS produto_id,
        COALESCE(p.nome_comercial, p.principio_ativo) AS nome,
        p.principio_ativo,
        p.codigo_catmat, p.codigo_atc, p.forma_farmaceutica, p.dosagem,
        COALESCE(
          p.apresentacao,
          NULLIF(concat_ws(' ', p.forma_farmaceutica, p.dosagem), '')
        ) AS apresentacao
   FROM lotes l
   JOIN produtos p ON p.id = l.produto_id
   JOIN fabricantes f ON f.id = l.fabricante_id
  WHERE l.id = $1 AND l.ubs_id = ANY($2::uuid[])`,
      [loteId, unidadeIds],
    );
    if (cabecalho.length === 0) return null;

    const movs: MovimentacaoRow[] = await manager.query(
      `SELECT m.id, m.created_at, m.tipo_movimentacao, m.quantidade,
              m.saldo_anterior, m.saldo_posterior, m.motivo, m.justificativa,
              u.id AS usuario_id, u.nome_completo AS usuario_nome,
              COALESCE(de.numero_documento, d.numero_atendimento) AS documento_referencia
         FROM movimentacoes_estoque m
         JOIN users u ON u.id = m.usuario_id
         LEFT JOIN documentos_entrada de
                ON m.tipo_documento_referencia = 'DOCUMENTO_ENTRADA'
               AND de.id = m.documento_referencia_id
         LEFT JOIN dispensacoes d
                ON m.tipo_documento_referencia = 'DISPENSACAO'
               AND d.id = m.documento_referencia_id
        WHERE m.lote_id = $1 AND m.ubs_id = ANY($2::uuid[])
        ORDER BY m.created_at ASC, m.id ASC`,
      [loteId, unidadeIds],
    );

    const c = cabecalho[0];
    return {
      lote: {
        id: c.lote_id,
        numeroLote: c.numero_lote,
        dataValidade: c.data_validade,
        dataCadastro: c.created_at.toISOString(),
        saldoAtual: Number(c.saldo_atual),
        fabricanteNome: c.fabricante_nome,
      },
      medicamento: {
        id: c.produto_id,
        nome: c.nome,
        principioAtivo: c.principio_ativo,
        apresentacao: c.apresentacao ?? "",
        codigoCatmat: c.codigo_catmat ?? undefined,
        codigoAtc: c.codigo_atc ?? undefined,
        formaFarmaceutica: c.forma_farmaceutica ?? undefined,
        concentracao: c.dosagem ?? undefined,
      },
      movimentacoes: movs.map((m) => ({
        id: m.id,
        dataHora: m.created_at.toISOString(),
        tipoBanco: m.tipo_movimentacao, // o use case traduz para o enum do DTO
        operacao: m.saldo_posterior >= m.saldo_anterior ? "+" : "-",
        quantidade: m.quantidade,
        saldoAnterior: m.saldo_anterior,
        saldoResultante: m.saldo_posterior,
        documentoReferencia: m.documento_referencia ?? undefined,
        motivo: m.motivo ?? undefined,
        justificativa: m.justificativa ?? undefined,
        usuarioResponsavel: { id: m.usuario_id, nome: m.usuario_nome },
      })),
    };
  }
}
