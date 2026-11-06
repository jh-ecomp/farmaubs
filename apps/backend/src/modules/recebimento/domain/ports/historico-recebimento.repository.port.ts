import type {
  DetalhesRecebimentoCompleto,
  FiltroHistoricoRecebimento,
  HistoricoRecebimentoPaginado,
  ResultadoEstornoRecebimento,
} from "@farmaubs/shared";

export const HISTORICO_RECEBIMENTO_REPOSITORY_PORT = Symbol(
  "HISTORICO_RECEBIMENTO_REPOSITORY_PORT",
);

export interface ExecutarEstornoParams {
  documentoId: string;
  motivo: string;
  usuarioId: string;
  municipioId: string;
}

/**
 * [RF008 / RF028 / ADR-017]: Porta de repositório para histórico, emissão de comprovantes e estorno atômico de recebimento.
 */
export interface HistoricoRecebimentoRepositoryPort {
  /**
   * Consulta paginada do histórico de documentos de entrada na UBS.
   * @param filtro - Parâmetros de busca, período e status.
   * @param municipioId - Tenant ativo (RLS).
   * @param ubsIdsPermitidas - Lista de UBS acessíveis pelo operador.
   */
  listarHistorico(
    filtro: FiltroHistoricoRecebimento,
    municipioId: string,
    ubsIdsPermitidas: string[],
  ): Promise<HistoricoRecebimentoPaginado>;

  /**
   * Obtém detalhes completos de uma entrada e seus itens físicos.
   * @param id - UUID do documento de entrada.
   * @param municipioId - Tenant ativo.
   */
  obterDetalhesPorId(
    id: string,
    municipioId: string,
  ): Promise<DetalhesRecebimentoCompleto | null>;

  /**
   * Executa a reversão atômica do recebimento (estorno físico e contábil):
   * 1. Lock pessimista `FOR UPDATE` dos lotes associados.
   * 2. Verifica se o saldo atual de cada lote é suficiente (saldo >= qtd_recebida).
   * 3. Subtrai o saldo dos lotes.
   * 4. Altera o status do documento para ESTORNADO e grava motivo/data.
   * 5. Registra lançamentos compensatórios de `ESTORNO_RECEBIMENTO` em `movimentacoes_estoque`.
   * @throws {DocumentoJaEstornadoException} Se o documento já foi estornado.
   * @throws {SaldoInsuficienteEstornoException} Se algum lote já foi parcialmente dispensado.
   */
  executarEstornoAtomico(
    params: ExecutarEstornoParams,
  ): Promise<ResultadoEstornoRecebimento>;
}
