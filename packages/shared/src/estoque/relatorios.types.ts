/** Motivos de saída contabilizados no relatório de perdas de estoque (RF011 / RF020). */
export const MOTIVOS_PERDA_RELATORIO = [
  "VENCIMENTO",
  "AVARIA_FISICA",
  "EXTRAVIO",
  "RECOLHIMENTO_SANITARIO",
] as const;

export type MotivoPerdaRelatorio = (typeof MOTIVOS_PERDA_RELATORIO)[number];

/** Tipos de relatório de estoque exportáveis em planilha (RF020 / RF028). */
export const FILTROS_TIPO_RELATORIO_ESTOQUE = [
  "SALDOS_ATUAIS",
  "PERDAS_VENCIMENTO",
  "MOVIMENTACOES_PERIODO",
] as const;
export type TipoRelatorioEstoque =
  (typeof FILTROS_TIPO_RELATORIO_ESTOQUE)[number];

/** Período padrão quando dataInicio/dataFim são omitidos (dias corridos). */
export const PERIODO_PADRAO_RELATORIO_DIAS = 30;

/** Intervalo máximo permitido entre dataInicio e dataFim (dias). */
export const PERIODO_MAXIMO_RELATORIO_DIAS = 365;

/** Contrato de parâmetros de consulta para exportação de relatórios de estoque em XLSX (ES-05 / ES-10). */
export interface ExportarRelatorioEstoqueQueryDto {
  unidadeId: string;
  tipoRelatorio: TipoRelatorioEstoque;
  dataInicio?: string;
  dataFim?: string;
  principioAtivo?: string;
  produtoId?: string;
  categoria?: string;
}
