export const REPOSITORIO_ESTOQUE_AJUSTES_PORT = Symbol(
  "REPOSITORIO_ESTOQUE_AJUSTES_PORT",
);

export interface LoteBloqueadoAjuste {
  id: string;
  municipioId: string;
  ubsId: string;
  saldoAtual: number;
}

export interface RegistrarMovimentacaoAjusteParams {
  municipioId: string;
  ubsId: string;
  loteId: string;
  tipoMovimentacao: "AJUSTE_ENTRADA" | "AJUSTE_SAIDA";
  quantidade: number;
  saldoAnterior: number;
  saldoPosterior: number;
  usuarioId: string;
  motivo: string;
  justificativa: string;
}

export interface MovimentacaoAjusteRegistrada {
  id: string;
  dataHora: string; // ISO 8601
}

export interface RepositorioEstoqueAjustesPort {
  /** Lê o lote com SELECT ... FOR UPDATE (ADR-008 / ADR-015). */
  bloquearLotePorId(loteId: string): Promise<LoteBloqueadoAjuste | null>;
  /** Grava o novo saldo físico do lote. */
  atualizarSaldo(loteId: string, novoSaldo: number): Promise<void>;
  /** Grava a movimentação de auditoria do ajuste. */
  registrarMovimentacao(
    dados: RegistrarMovimentacaoAjusteParams,
  ): Promise<MovimentacaoAjusteRegistrada>;
}
