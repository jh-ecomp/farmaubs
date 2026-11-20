import { fetchApi } from "./api";
import { sessionService } from "./session.service";
import { lerListaMedicamentos, lerSugestaoFefo } from "../screens/medicamento-busca";
import type { MedicamentoBuscaDto, SugestaoFefoResultado } from "@farmaubs/shared";

async function cabecalhoTenant(): Promise<Record<string, string>> {
  const unidadeId = await sessionService.obterUnidadeAtiva();
  return unidadeId ? { "X-Tenant-Id": unidadeId } : {};
}

async function mensagemErro(res: Response, padrao: string): Promise<string> {
  try {
    const data: unknown = await res.json();
    if (data && typeof data === "object" && "message" in data) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === "string" && message) return message;
    }
  } catch {
    // corpo vazio
  }
  return padrao;
}

export const medicamentoService = {
  /**
   * [DI-MOB-02]: GET /api/v1/dispensacao/medicamentos?termo=
   * A API real filtra por termo, não pelo nome busca da história.
   */
  async buscar(apiBaseUrl: string, termo: string, ubsId: string | null): Promise<MedicamentoBuscaDto[]> {
    const params = new URLSearchParams({ termo: termo.trim() });
    if (ubsId) params.set("ubsId", ubsId);
    const res = await fetchApi(
      `${apiBaseUrl}/api/v1/dispensacao/medicamentos?${params.toString()}`,
      { headers: await cabecalhoTenant() },
    );
    if (!res.ok) throw new Error(await mensagemErro(res, "Não foi possível buscar medicamentos."));
    return lerListaMedicamentos(await res.json());
  },

  /**
   * [DI-MOB-02]: GET /api/v1/dispensacao/medicamentos/:id/lotes-fefo
   */
  async lotes(apiBaseUrl: string, medicamentoId: string, ubsId: string | null): Promise<SugestaoFefoResultado | null> {
    const query = ubsId ? `?ubsId=${encodeURIComponent(ubsId)}` : "";
    const res = await fetchApi(
      `${apiBaseUrl}/api/v1/dispensacao/medicamentos/${encodeURIComponent(medicamentoId)}/lotes-fefo${query}`,
      { headers: await cabecalhoTenant() },
    );
    if (!res.ok) throw new Error(await mensagemErro(res, "Não foi possível carregar os lotes."));
    return lerSugestaoFefo(await res.json());
  },
};
