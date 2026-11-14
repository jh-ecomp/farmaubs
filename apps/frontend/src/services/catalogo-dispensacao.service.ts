import type {
  MedicamentoBuscaDto,
  SugestaoFefoResultado,
} from "@farmaubs/shared";
import { inspectSessionExpiresHeader } from "./api";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

export class CatalogoDispensacaoApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "CatalogoDispensacaoApiError";
    this.status = status;
    this.data = data;
  }
}

const JSON_HEADERS: HeadersInit = {
  "Content-Type": "application/json",
};

export const catalogoDispensacaoService = {
  /**
   * [RF010 / NF010 / NF012]: Realiza busca textual de medicamentos no catálogo da UBS ativa por princípio ativo, nome comercial ou apresentação.
   * @param termo - Fragmento textual digitado pelo farmacêutico.
   * @param ubsId - UUID opcional da UBS de atendimento.
   * @returns Lista de medicamentos correspondentes com saldo consolidado na UBS.
   * @throws {CatalogoDispensacaoApiError} Em caso de falha de comunicação ou erro HTTP.
   */
  async buscarMedicamentos(
    termo: string,
    ubsId?: string,
  ): Promise<MedicamentoBuscaDto[]> {
    const params = new URLSearchParams();
    if (termo.trim()) {
      params.set("termo", termo.trim());
    }
    if (ubsId) {
      params.set("ubsId", ubsId);
    }

    const queryString = params.toString() ? `?${params.toString()}` : "";
    let res: Response;
    try {
      res = await fetch(
        `${API_BASE_URL}/dispensacao/medicamentos${queryString}`,
        {
          credentials: "include",
          headers: JSON_HEADERS,
        },
      );
      res = inspectSessionExpiresHeader(res);
    } catch {
      throw new CatalogoDispensacaoApiError(
        "Não foi possível consultar o catálogo de medicamentos.",
        0,
      );
    }

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      throw new CatalogoDispensacaoApiError(
        erro.message || "Erro ao buscar medicamentos.",
        res.status,
        erro,
      );
    }

    return await res.json();
  },

  /**
   * [RF010]: Consulta os lotes disponíveis na UBS para o medicamento selecionado, ordenados por FEFO (First-Expired, First-Out).
   * @param medicamentoId - UUID do medicamento selecionado.
   * @param ubsId - UUID opcional da UBS de atendimento.
   * @returns Lote sugerido por FEFO e lista completa de lotes disponíveis na UBS.
   * @throws {CatalogoDispensacaoApiError} Caso o medicamento não seja encontrado ou ocorra falha HTTP.
   */
  async obterLotesFefo(
    medicamentoId: string,
    ubsId?: string,
  ): Promise<SugestaoFefoResultado> {
    const query = ubsId ? `?ubsId=${encodeURIComponent(ubsId)}` : "";
    let res: Response;
    try {
      res = await fetch(
        `${API_BASE_URL}/dispensacao/medicamentos/${encodeURIComponent(medicamentoId)}/lotes-fefo${query}`,
        {
          credentials: "include",
          headers: JSON_HEADERS,
        },
      );
      res = inspectSessionExpiresHeader(res);
    } catch {
      throw new CatalogoDispensacaoApiError(
        "Não foi possível consultar os lotes FEFO do medicamento.",
        0,
      );
    }

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      throw new CatalogoDispensacaoApiError(
        erro.message || "Erro ao carregar lotes do medicamento.",
        res.status,
        erro,
      );
    }

    return await res.json();
  },
};
