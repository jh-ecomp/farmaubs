import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ConsultarSaldosQueryDto,
  ExportarRelatorioEstoqueQueryDto,
  RegistrarAjusteLoteInputDto,
} from "@farmaubs/shared";
import { estoqueService } from "../services/estoque.service";

export const ESTOQUE_QUERY_KEYS = {
  all: ["estoque"] as const,
  metricas: (unidadeId?: string) =>
    ["estoque", "metricas", unidadeId ?? "ativa"] as const,
  saldos: (filtros: ConsultarSaldosQueryDto) =>
    ["estoque", "saldos", filtros] as const,
  rastreabilidade: (loteId: string | null) =>
    ["estoque", "rastreabilidade", loteId ?? ""] as const,
};

/**
 * [ES-06 / RF018 / RF022 / RF023]: Hook TanStack Query para buscar os indicadores consolidados de estoque da UBS.
 * @param unidadeId - UUID opcional da unidade de saúde ativa.
 * @param enabled - Habilita ou desabilita a busca automática.
 * @returns Resultado da query com métricas de criticidade e estado de carregamento.
 */
export function useEstoqueMetricas(
  unidadeId?: string,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: ESTOQUE_QUERY_KEYS.metricas(unidadeId),
    queryFn: () => estoqueService.obterMetricas(unidadeId),
    enabled,
  });
}

/**
 * [ES-07 / ES-08 / RF005 / RF022]: Hook TanStack Query para listagem paginada e filtrada de saldos de estoque.
 * @param filtros - Filtros de busca textual, categoria, validade, status e paginação.
 * @param enabled - Habilita ou desabilita a busca automática.
 * @returns Resultado da query com itens paginados e lotes ordenados por FEFO.
 */
export function useEstoqueSaldos(
  filtros: ConsultarSaldosQueryDto = {},
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: ESTOQUE_QUERY_KEYS.saldos(filtros),
    queryFn: () => estoqueService.consultarSaldos(filtros),
    enabled,
  });
}

/**
 * [ES-09 / RF009 / RF011 / RF028]: Hook de mutação para registrar ajustes manuais (+) ou (-) em um lote.
 * Invalida automaticamente os caches de métricas, saldos e rastreabilidade após confirmação.
 * @returns Objeto de mutação do TanStack Query.
 */
export function useRegistrarAjusteEstoque() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      loteId,
      payload,
    }: {
      loteId: string;
      payload: RegistrarAjusteLoteInputDto;
    }) => estoqueService.registrarAjuste(loteId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["estoque", "metricas"] });
      queryClient.invalidateQueries({ queryKey: ["estoque", "saldos"] });
      queryClient.invalidateQueries({
        queryKey: ESTOQUE_QUERY_KEYS.rastreabilidade(variables.loteId),
      });
    },
  });
}

/**
 * [ES-09 / RF028]: Hook TanStack Query para consultar a ficha de rastreabilidade e linha do tempo de um lote.
 * @param loteId - UUID do lote consultado (ou null quando modal fechado).
 * @returns Resultado da query com histórico cronológico de movimentações do lote.
 */
export function useRastreabilidadeLote(loteId: string | null) {
  return useQuery({
    queryKey: ESTOQUE_QUERY_KEYS.rastreabilidade(loteId),
    queryFn: () => {
      if (!loteId) {
        throw new Error("Identificador do lote não informado.");
      }
      return estoqueService.consultarRastreabilidadeLote(loteId);
    },
    enabled: Boolean(loteId),
  });
}

/**
 * [ES-10 / RF020 / RF028]: Hook de mutação para gerar e baixar a planilha Excel (.xlsx) de relatórios de estoque.
 * @returns Objeto de mutação que retorna o blob e aciona o download no navegador.
 */
export function useExportarRelatorioEstoqueXlsx() {
  return useMutation({
    mutationFn: (filtros: ExportarRelatorioEstoqueQueryDto) =>
      estoqueService.exportarRelatorioXlsx(filtros),
  });
}
