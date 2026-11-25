import { MOTIVOS_AJUSTE_SAIDA } from "./ajustes.types";

export const MOTIVOS_PERDA_RELATORIO = MOTIVOS_AJUSTE_SAIDA;

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

export type MotivoPerdaRelatorio = (typeof MOTIVOS_PERDA_RELATORIO)[number];
