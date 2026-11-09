export const TIPOS_MOVIMENTACAO_ESTOQUE = [
  "ENTRADA_RECEBIMENTO",
  "SAIDA_DISPENSACAO",
  "AJUSTE_ENTRADA",
  "AJUSTE_SAIDA",
  "ESTORNO_ENTRADA",
  "ESTORNO_DISPENSACAO",
] as const;

export type TipoMovimentacaoEstoque = (typeof TIPOS_MOVIMENTACAO_ESTOQUE)[number];

export interface MovimentacaoLoteItemDto {
  id: string;
  dataHora: string;
  tipoMovimentacao: TipoMovimentacaoEstoque;
  operacao: "+" | "-";
  quantidade: number;
  saldoResultante: number;
  documentoReferencia?: string;
  motivo?: string;
  justificativa?: string;
  usuarioResponsavel: { id: string; nome: string };
}

export interface RastreabilidadeLoteDto {
  lote: {
    id: string;
    numeroLote: string;
    dataValidade: string;
    dataCadastro: string;
    saldoAtual: number;
    saldoInicial: number;
    fabricanteNome: string;
  };
  medicamento: {
    id: string;
    nome: string;
    principioAtivo: string;
    apresentacao: string;
    codigoCatmat?: string;
    codigoAtc?: string;
    formaFarmaceutica?: string;
    concentracao?: string;
  };
  movimentacoes: MovimentacaoLoteItemDto[];
}

