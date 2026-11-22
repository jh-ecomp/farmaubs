import type {
  DispensacaoEfetivadaResultado,
  DispensacoesPaginadasResultado,
  EfetivarDispensacaoRequest,
  ListarDispensacoesQuery,
} from "@farmaubs/shared";
import { lerResultado } from "../screens/fechamento";
import { lerPagina } from "../screens/historico-dispensacao";
import { fetchApi } from "./api";
import { sessionService } from "./session.service";

export class FalhaDispensacao extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "FalhaDispensacao";
    this.status = status;
  }
}

async function cabecalhoTenant(): Promise<Record<string, string>> {
  const unidadeId = await sessionService.obterUnidadeAtiva();
  return unidadeId ? { "X-Tenant-Id": unidadeId } : {};
}

async function mensagemErro(res: Response, padrao: string): Promise<string> {
  try {
    const data: unknown = await res.json();
    if (!data || typeof data !== "object" || !("message" in data)) return padrao;
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
    if (Array.isArray(message) && message.every((item) => typeof item === "string") && message.length > 0) {
      return message.join(" ");
    }
  } catch {
    // corpo vazio
  }
  return padrao;
}

export const dispensacaoService = {
  /**
   * [DI-MOB-04]: POST /api/v1/dispensacoes. O Bearer sai pelo fetchApi.
   * @param apiBaseUrl - Origem da API, sem barra no fim.
   * @param pedido - Paciente, itens e, se houver antibiótico, a data da receita.
   * @returns Comprovante gravado. Lança FalhaDispensacao quando a API recusa.
   */
  async efetivar(apiBaseUrl: string, pedido: EfetivarDispensacaoRequest): Promise<DispensacaoEfetivadaResultado> {
    const res = await fetchApi(`${apiBaseUrl}/api/v1/dispensacoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await cabecalhoTenant()) },
      body: JSON.stringify(pedido),
    });
    if (!res.ok) {
      throw new FalhaDispensacao(res.status, await mensagemErro(res, "Não foi possível efetivar a dispensação."));
    }
    const resultado = lerResultado(await res.json());
    if (!resultado) throw new FalhaDispensacao(res.status, "A API não devolveu o comprovante.");
    return resultado;
  },

  /**
   * [DI-MOB-05]: GET /api/v1/dispensacoes com dataInicio, dataFim e a página.
   * @param apiBaseUrl - Origem da API.
   * @param filtros - Período, UBS, texto e paginação.
   * @returns Página já lida. Lança FalhaDispensacao se o corpo não for uma lista.
   */
  async listar(apiBaseUrl: string, filtros: ListarDispensacoesQuery): Promise<DispensacoesPaginadasResultado> {
    const params = new URLSearchParams();
    if (filtros.ubsId) params.set("ubsId", filtros.ubsId);
    if (filtros.pagina) params.set("pagina", String(filtros.pagina));
    if (filtros.limite) params.set("limite", String(filtros.limite));
    if (filtros.dataInicio) params.set("dataInicio", filtros.dataInicio);
    if (filtros.dataFim) params.set("dataFim", filtros.dataFim);
    if (filtros.pacienteTermo) params.set("pacienteTermo", filtros.pacienteTermo);
    if (filtros.medicamentoTermo) params.set("medicamentoTermo", filtros.medicamentoTermo);
    const qs = params.toString();
    const res = await fetchApi(`${apiBaseUrl}/api/v1/dispensacoes${qs ? `?${qs}` : ""}`, {
      headers: await cabecalhoTenant(),
    });
    if (!res.ok) {
      throw new FalhaDispensacao(res.status, await mensagemErro(res, "Não foi possível carregar o histórico."));
    }
    const pagina = lerPagina(await res.json());
    if (!pagina) throw new FalhaDispensacao(res.status, "A API não devolveu o histórico.");
    return pagina;
  },
};
