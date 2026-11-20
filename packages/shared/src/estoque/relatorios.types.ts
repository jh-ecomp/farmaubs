/** Tipos de relatórios de estoque suportados para exportação em planilha Excel (.xlsx) (ES-05 / ES-10, RF020, RF028). */
export const TIPOS_RELATORIO_ESTOQUE = [
  "SALDOS_ATUAIS",
  "PERDAS_VENCIMENTO",
  "MOVIMENTACOES_PERIODO",
] as const;

export type TipoRelatorioEstoque = (typeof TIPOS_RELATORIO_ESTOQUE)[number];

/** Parâmetros de consulta para exportação de relatórios de estoque em .xlsx (ES-05 / ES-10). */
export interface ExportarRelatorioEstoqueQueryDto {
  unidadeId?: string;
  tipoRelatorio: TipoRelatorioEstoque;
  dataInicio?: string;
  dataFim?: string;
  principioAtivo?: string;
  categoria?: string;
}
