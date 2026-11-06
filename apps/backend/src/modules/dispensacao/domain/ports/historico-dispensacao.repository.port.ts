import type {
  DispensacaoItemListaDto,
  EstornarDispensacaoResultado,
  LinhaExportacaoDispensacaoDto,
} from "@farmaubs/shared";

export interface FiltrosHistoricoResolvidos {
  unidadeId?: string | null;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
  pacienteTermo?: string;
  medicamentoTermo?: string;
  categoria?: string;
  status?: "concluida" | "estornada";
  pagina: number;
  limite: number;
}

export interface DispensacaoParaEstornoInfo {
  id: string;
  unidadeId: string;
  status: "concluida" | "estornada";
  itens: {
    loteId: string;
    numeroLote: string;
    quantidadeDispensada: number;
  }[];
}

export interface HistoricoDispensacaoRepositoryPort {
  listarFiltrado(filtros: FiltrosHistoricoResolvidos): Promise<{
    itens: DispensacaoItemListaDto[];
    totalItens: number;
  }>;
  buscarParaExportacao(
    filtros: Omit<FiltrosHistoricoResolvidos, "pagina" | "limite">,
  ): Promise<LinhaExportacaoDispensacaoDto[]>;
  buscarDispensacaoParaEstorno(
    dispensacaoId: string,
    unidadeId?: string | null,
  ): Promise<DispensacaoParaEstornoInfo | null>;
  executarEstornoAtomico(params: {
    dispensacaoId: string;
    estornadoPorId: string;
    motivoEstorno: string;
    itens: {
      loteId: string;
      numeroLote: string;
      quantidadeDispensada: number;
    }[];
  }): Promise<EstornarDispensacaoResultado>;
}

export const HISTORICO_DISPENSACAO_REPOSITORY_PORT = Symbol(
  "HISTORICO_DISPENSACAO_REPOSITORY_PORT",
);

