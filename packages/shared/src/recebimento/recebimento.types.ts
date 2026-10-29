/**
 * [RF008 / RF024 / RF028]: Contratos de dados para efetivação de recebimento de cargas e estoque.
 */

export enum TipoDocumentoEntradaEnum {
  GUIA_CAF = "GUIA_CAF",
  NOTA_FISCAL = "NOTA_FISCAL",
  REMESSA_DLOG = "REMESSA_DLOG",
  COMPRA_PREGAO = "COMPRA_PREGAO",
  DOACAO = "DOACAO",
}

export interface ItemRecebimentoEntrada {
  produtoId: string;
  fabricanteId: string;
  numeroLote: string;
  dataValidade: string; // YYYY-MM-DD
  quantidadeRecebida: number;
  observacoes?: string | null;
}

export interface CriarEntradaEstoqueRequest {
  ubsId?: string;
  numeroDocumento: string;
  tipoDocumento: string;
  fornecedorOrigem: string;
  dataRecebimento?: string | null;
  observacoes?: string | null;
  itens: ItemRecebimentoEntrada[];
}

export interface AvisoRecebimentoDto {
  tipo: "VALIDADE_CURTA" | "ALERTA_GERAL";
  lote: string;
  mensagem: string;
}

export interface ItemRecebimentoResultadoDto {
  itemId: string;
  produtoId: string;
  produtoNome: string;
  fabricanteId: string;
  fabricanteNome: string;
  loteId: string;
  numeroLote: string;
  dataValidade: string;
  quantidadeRecebida: number;
  saldoFinalLote: number;
}

export interface EntradaEstoqueEfetivadaResultado {
  id: string;
  numeroDocumento: string;
  tipoDocumento: string;
  fornecedorOrigem: string;
  dataRecebimento: Date | string;
  usuarioRecebedorId: string;
  usuarioRecebedorNome?: string;
  itens: ItemRecebimentoResultadoDto[];
  avisos: AvisoRecebimentoDto[];
}
