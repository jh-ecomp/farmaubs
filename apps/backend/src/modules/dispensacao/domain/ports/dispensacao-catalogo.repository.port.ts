import type { LoteEntradaFefo, MedicamentoBuscaDto } from "@farmaubs/shared";

export interface DispensacaoCatalogoRepositoryPort {
  buscarPorTermoEUnidade(
    termo: string,
    unidadeId?: string | null,
  ): Promise<MedicamentoBuscaDto[]>;
  buscarMedicamentoPorId(
    medicamentoId: string,
    unidadeId?: string | null,
  ): Promise<MedicamentoBuscaDto | null>;
  listarLotesPorMedicamentoEUnidade(
    medicamentoId: string,
    unidadeId?: string | null,
  ): Promise<LoteEntradaFefo[]>;
}

export const DISPENSACAO_CATALOGO_REPOSITORY_PORT = Symbol(
  "DISPENSACAO_CATALOGO_REPOSITORY_PORT",
);

