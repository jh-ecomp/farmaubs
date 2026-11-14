/** Status semântico de validade de um lote (RF022). */
export const STATUS_VALIDADE_LOTE = [
  "REGULAR",
  "CURTA_90D",
  "MES_CORRENTE",
  "VENCIDO",
] as const;
export type StatusValidadeLote = (typeof STATUS_VALIDADE_LOTE)[number];

/** Situação do saldo consolidado de um medicamento na UBS. */
export const STATUS_ESTOQUE = ["REGULAR", "BAIXO_ESTOQUE", "ZERADO"] as const;
export type StatusEstoque = (typeof STATUS_ESTOQUE)[number];

/** Filtros aceitos pela consulta de saldos. */
export const FILTROS_VALIDADE_SALDOS = [
  "TODOS",
  "MES_CORRENTE",
  "VALIDADE_90D",
  "VENCIDOS",
] as const;
export type FiltroValidadeSaldos = (typeof FILTROS_VALIDADE_SALDOS)[number];

export const FILTROS_STATUS_ESTOQUE = ["TODOS", ...STATUS_ESTOQUE] as const;
export type FiltroStatusEstoque = (typeof FILTROS_STATUS_ESTOQUE)[number];

export interface LoteEstoqueDto {
  id: string;
  numeroLote: string;
  fabricanteId: string;
  fabricanteNome: string;
  dataValidade: string; // AAAA-MM-DD
  saldoAtual: number;
  statusValidade: StatusValidadeLote;
}

export interface MedicamentoSaldoItemDto {
  produtoId: string;
  nome: string;
  principioAtivo: string;
  formaFarmaceutica: string;
  concentracao: string;
  unidadeMedida: string;
  categoria: string;
  saldoTotal: number;
  statusEstoque: StatusEstoque;
  lotes: LoteEstoqueDto[];
}

export interface ConsultarSaldosPaginadosResponseDto {
  itens: MedicamentoSaldoItemDto[];
  total: number;
  pagina: number;
  itensPorPagina: number;
  totalPaginas: number;
}
