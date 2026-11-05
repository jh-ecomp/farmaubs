import { Injectable } from "@nestjs/common";
import { TransactionContext } from "../../../../common/transaction/transaction-context.service";
import type {
  LoteBloqueadoAjuste,
  MovimentacaoAjusteRegistrada,
  RegistrarMovimentacaoAjusteParams,
  RepositorioEstoqueAjustesPort,
} from "../../domain/ports/estoque-ajustes.repository.port";

/**
 * [RF009 / RF011 / RF028 / ADR-008]: Adaptador PostgreSQL dos ajustes de estoque.
 * Usa o manager da transação da requisição (TransactionInterceptor), que já aplica o GUC de tenant.
 */
@Injectable()
export class EstoqueAjustesPgRepository implements RepositorioEstoqueAjustesPort {
  constructor(private readonly transactionContext: TransactionContext) {}

  /**
   * [ADR-008 / ADR-015]: Lê o lote com SELECT ... FOR UPDATE, serializando ajustes concorrentes.
   * @param loteId - UUID do lote.
   * @returns Lote bloqueado ou null se inexistente/fora do tenant (RLS).
   */
  async bloquearLotePorId(loteId: string): Promise<LoteBloqueadoAjuste | null> {
    const manager = this.transactionContext.getManager();
    const rows = await manager.query(
      `SELECT l.id, l.municipio_id, l.ubs_id, l.saldo_atual
         FROM public.lotes l
        WHERE l.id = $1::uuid
          FOR UPDATE OF l`,
      [loteId],
    );

    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      municipioId: r.municipio_id,
      ubsId: r.ubs_id,
      saldoAtual: Number(r.saldo_atual),
    };
  }

  /**
   * [RF009 / RF011]: Grava o novo saldo físico do lote na transação ativa.
   * @param loteId - UUID do lote já bloqueado.
   * @param novoSaldo - Saldo resultante do ajuste.
   */
  async atualizarSaldo(loteId: string, novoSaldo: number): Promise<void> {
    const manager = this.transactionContext.getManager();
    await manager.query(
      `UPDATE public.lotes
          SET saldo_atual = $2,
              updated_at = now()
        WHERE id = $1::uuid`,
      [loteId, novoSaldo],
    );
  }

  /**
   * [RF028]: Insere a movimentação de auditoria do ajuste (registro de rastreabilidade do lote).
   * @param dados - Dados do ajuste, usuário, motivo e justificativa.
   * @returns Identificador e data/hora (ISO 8601) da movimentação criada.
   */
  async registrarMovimentacao(
    dados: RegistrarMovimentacaoAjusteParams,
  ): Promise<MovimentacaoAjusteRegistrada> {
    const manager = this.transactionContext.getManager();
    const rows = await manager.query(
      `INSERT INTO public.movimentacoes_estoque
         (municipio_id, ubs_id, lote_id, tipo_movimentacao, quantidade,
          saldo_anterior, saldo_posterior, usuario_id, motivo, justificativa)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8::uuid, $9, $10)
       RETURNING id, created_at`,
      [
        dados.municipioId,
        dados.ubsId,
        dados.loteId,
        dados.tipoMovimentacao,
        dados.quantidade,
        dados.saldoAnterior,
        dados.saldoPosterior,
        dados.usuarioId,
        dados.motivo,
        dados.justificativa,
      ],
    );

    const r = rows[0];
    return {
      id: r.id,
      dataHora:
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : new Date(r.created_at).toISOString(),
    };
  }
}
