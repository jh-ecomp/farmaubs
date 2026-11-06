import type {
  AvisoRecebimentoDto,
  CriarEntradaEstoqueRequest,
  EntradaEstoqueEfetivadaResultado,
} from "@farmaubs/shared";

export const RECEBIMENTO_REPOSITORY_PORT = Symbol("RECEBIMENTO_REPOSITORY_PORT");

export interface ContextoOperacionalRecebimento {
  municipioId: string;
  ubsId: string;
  usuarioId: string;
  usuarioNome?: string;
}

export interface ItemRecebimentoResolvido {
  produtoId: string;
  produtoNome: string;
  fabricanteId: string;
  fabricanteNome: string;
  numeroLote: string;
  dataValidade: string;
  quantidadeRecebida: number;
  observacoes?: string | null;
}

export interface RegistrarEntradaAtomicaParams {
  contexto: ContextoOperacionalRecebimento;
  documento: {
    numeroDocumento: string;
    tipoDocumento: string;
    fornecedorOrigem: string;
    dataRecebimento?: Date;
    observacoes?: string | null;
  };
  itens: ItemRecebimentoResolvido[];
  avisos: AvisoRecebimentoDto[];
}

/**
 * [RF008 / RF028]: Porta do repositório transacional de recebimento e controle de estoque.
 */
export interface RecebimentoRepositoryPort {
  /**
   * Executa a transação atômica completa de entrada: cabeçalho, upsert com lock pessimista em lotes,
   * criação dos itens de conferência e lançamento no livro-razão (movimentacoes_estoque).
   * @param params - Parâmetros resolvidos e auditados da entrada.
   * @returns Resultado com itens cadastrados e saldos atualizados.
   */
  registrarEntradaAtomica(
    params: RegistrarEntradaAtomicaParams,
  ): Promise<EntradaEstoqueEfetivadaResultado>;

  /**
   * Busca documento de entrada por número na UBS ativa para validação de unicidade ou duplicidade.
   */
  buscarDocumentoPorNumero(
    numeroDocumento: string,
    ubsId: string,
  ): Promise<{ id: string; numeroDocumento: string; status: string } | null>;
}
