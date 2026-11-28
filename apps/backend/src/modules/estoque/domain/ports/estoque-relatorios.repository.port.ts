import type { TipoRelatorioEstoque } from "@farmaubs/shared";
import type {
  LinhaRelatorioEstoque,
  LinhaRelatorioMovimentacoesPeriodo,
  LinhaRelatorioPerdasVencimento,
  LinhaRelatorioSaldosAtuais,
} from "./gerador-planilha-estoque.port";

export const REPOSITORIO_ESTOQUE_RELATORIOS_PORT = Symbol(
  "REPOSITORIO_ESTOQUE_RELATORIOS_PORT",
);

export interface CabecalhoUbsRelatorio {
  nomeUbs: string;
  cnes?: string;
  municipio: string;
}

export interface FiltrosConsultaRelatorioEstoque {
  ubsId: string;
  dataInicio?: string; // YYYY-MM-DD
  dataFim?: string; // YYYY-MM-DD
  principioAtivo?: string;
  produtoId?: string;
  categoria?: string;
}

/**
 * [RF020 / RF028]: Porta do repositório para consulta de dados de relatórios de estoque.
 */
export interface RepositorioEstoqueRelatoriosPort {
  /**
   * Consulta os saldos atuais por lote para a UBS informada.
   */
  consultarSaldosAtuais(
    filtros: FiltrosConsultaRelatorioEstoque,
  ): Promise<LinhaRelatorioSaldosAtuais[]>;

  /**
   * Consulta perdas de estoque (baixas por vencimento ou avaria física) no período para a UBS.
   */
  consultarPerdasVencimento(
    filtros: FiltrosConsultaRelatorioEstoque,
  ): Promise<LinhaRelatorioPerdasVencimento[]>;

  /**
   * Extrato cronológico de movimentações no período para a UBS.
   */
  consultarMovimentacoesPeriodo(
    filtros: FiltrosConsultaRelatorioEstoque,
  ): Promise<LinhaRelatorioMovimentacoesPeriodo[]>;

  /**
   * Ponto de entrada unificado que despacha para a consulta do tipo informado.
   */
  consultarDadosParaRelatorio(
    tipo: TipoRelatorioEstoque,
    filtros: FiltrosConsultaRelatorioEstoque,
  ): Promise<LinhaRelatorioEstoque[]>;

  /**
   * Obtém os dados institucionais da UBS para o cabeçalho do relatório.
   */
  obterCabecalhoUbs(ubsId: string): Promise<CabecalhoUbsRelatorio | null>;
}
