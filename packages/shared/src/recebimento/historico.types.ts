/**
 * [RF008 / RF028 / RF024]: Contratos de tipos para Histórico de Recebimentos, Comprovante e Estorno.
 */

export type PeriodoPredefinido =
  | "HOJE"
  | "ONTEM"
  | "ULTIMOS_7_DIAS"
  | "ULTIMOS_30_DIAS"
  | "CUSTOMIZADO";

export interface FiltroHistoricoRecebimento {
  ubsId?: string;
  periodo?: PeriodoPredefinido;
  dataInicio?: string; // YYYY-MM-DD
  dataFim?: string; // YYYY-MM-DD
  termoBusca?: string;
  status?: "TODOS" | "CONCLUIDO" | "ESTORNADO";
  pagina?: number;
  limite?: number;
}

export interface ItemResumoHistoricoRecebimento {
  id: string;
  numeroDocumento: string;
  tipoDocumento: string;
  fornecedorOrigem: string;
  dataRecebimento: Date | string;
  usuarioRecebedorNome: string;
  totalItens: number;
  totalUnidades: number;
  status: "CONCLUIDO" | "ESTORNADO";
  podeEstornar: boolean;
  motivoEstorno?: string | null;
  dataEstorno?: Date | string | null;
}

export interface HistoricoRecebimentoPaginado {
  itens: ItemResumoHistoricoRecebimento[];
  total: number;
  pagina: number;
  totalPaginas: number;
}

export interface ItemDetalheRecebimento {
  id: string;
  produtoId: string;
  produtoNome: string;
  formaFarmaceutica: string;
  concentracao: string;
  fabricanteId: string;
  fabricanteNome: string;
  loteId: string;
  numeroLote: string;
  dataValidade: string;
  quantidadeRecebida: number;
  saldoAtualLote: number;
  observacoes?: string | null;
}

export interface DetalhesRecebimentoCompleto {
  id: string;
  ubsId: string;
  ubsNome?: string;
  numeroDocumento: string;
  tipoDocumento: string;
  fornecedorOrigem: string;
  dataRecebimento: Date | string;
  usuarioRecebedorId: string;
  usuarioRecebedorNome: string;
  status: "CONCLUIDO" | "ESTORNADO";
  motivoEstorno?: string | null;
  dataEstorno?: Date | string | null;
  usuarioEstornoNome?: string | null;
  observacoes?: string | null;
  itens: ItemDetalheRecebimento[];
  totalItens: number;
  totalUnidades: number;
  podeEstornar: boolean;
}

export interface SolicitacaoEstornoRecebimento {
  motivo: string;
}

export interface ResultadoEstornoRecebimento {
  id: string;
  numeroDocumento: string;
  status: "ESTORNADO";
  dataEstorno: Date | string;
  usuarioEstornoId: string;
  motivoEstorno: string;
  totalItensEstornados: number;
  totalUnidadesEstornadas: number;
}
