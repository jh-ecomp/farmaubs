import type { RastreabilidadeLoteDto } from "@farmaubs/shared";

export interface MovimentacaoLoteBruta {
  id: string;
  dataHora: string;
  tipoBanco: string;
  operacao: "+" | "-";
  quantidade: number;
  saldoAnterior: number;
  saldoResultante: number;
  documentoReferencia?: string;
  motivo?: string;
  justificativa?: string;
  usuarioResponsavel: { id: string; nome: string };
}

export interface RastreabilidadeLoteBruta {
  lote: Omit<RastreabilidadeLoteDto["lote"], "saldoInicial">;
  medicamento: RastreabilidadeLoteDto["medicamento"];
  movimentacoes: MovimentacaoLoteBruta[];
}

export interface RepositorioEstoqueRastreabilidadePort {
  buscarLinhaDoTempoLote(
    loteId: string,
    unidadeIds: string[],
  ): Promise<RastreabilidadeLoteBruta | null>;
}

export const REPOSITORIO_ESTOQUE_RASTREABILIDADE = Symbol(
  "REPOSITORIO_ESTOQUE_RASTREABILIDADE",
);

