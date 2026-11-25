import type { TipoRelatorioEstoque as FiltroTipoRelatorioEstoque } from "@farmaubs/shared";

export type { FiltroTipoRelatorioEstoque };

export interface CabecalhoInstitucionalEstoque {
  nomeUbs: string;
  cnes?: string;
  municipio: string;
  dataEmissao: string; // ISO 8601
}

export interface PeriodoRelatorioEstoque {
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
}

export interface LinhaRelatorioSaldosAtuais {
  medicamento: string;
  principioAtivo?: string;
  fabricante?: string;
  lote: string;
  validade: string | Date;
  saldo: number;
  status: string;
}

export interface LinhaRelatorioPerdasVencimento {
  data: string | Date;
  medicamento: string;
  lote: string;
  quantidade: number;
  motivo: string;
}

export interface LinhaRelatorioMovimentacoesPeriodo {
  dataHora: string | Date;
  tipo: string;
  medicamento: string;
  lote: string;
  quantidade: number;
  saldoResultante: number;
  responsavel: string;
}

export type LinhaRelatorioEstoque =
  | LinhaRelatorioSaldosAtuais
  | LinhaRelatorioPerdasVencimento
  | LinhaRelatorioMovimentacoesPeriodo;

export interface EntradaGeradorPlanilhaEstoque<
  T extends LinhaRelatorioEstoque = LinhaRelatorioEstoque,
> {
  tipoRelatorio: FiltroTipoRelatorioEstoque;
  cabecalho: CabecalhoInstitucionalEstoque;
  periodo?: PeriodoRelatorioEstoque;
  linhas: T[];
}

/**
 * Porta de domínio para geração de relatórios de estoque em planilha Excel (.xlsx).
 * Atende ao RF028 (exportação de dados e log de auditoria em planilha) e ao NF003 (padrão nacional de datas e números).
 */
export interface GeradorPlanilhaEstoquePort {
  /**
   * Gera uma planilha Excel (.xlsx) estruturada para o tipo de relatório solicitado.
   * Atende ao RF028 e ao NF003.
   *
   * @param entrada Dados do relatório contendo tipo, cabeçalho institucional, período e linhas.
   * @returns Buffer binário da planilha Excel gerada.
   */
  gerar(entrada: EntradaGeradorPlanilhaEstoque): Promise<Buffer>;
}

export const GERADOR_PLANILHA_ESTOQUE_PORT = Symbol(
  "GERADOR_PLANILHA_ESTOQUE_PORT",
);
