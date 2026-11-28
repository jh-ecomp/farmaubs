import type {
  CriarEntradaEstoqueRequest,
  CriarFabricanteRequest,
  DetalhesRecebimentoCompleto,
  FabricanteResponseDto,
  FiltroHistoricoRecebimento,
  HistoricoRecebimentoPaginado,
  ProdutoCatalogoResponseDto,
} from "@farmaubs/shared";
import { fetchApi } from "./api";
import { sessionService } from "./session.service";
import { lerFabricante, lerFabricantes, lerProdutosCatalogo } from "../screens/conferencia-item";
import { lerEntrada, type ReciboEntrada } from "../screens/revisao-entrada";
import { lerDetalhe, lerHistorico } from "../screens/recebimento/historico-recebimento";

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

export const catalogoRecebimentoService = {
  /**
   * [RE-MOB-02]: GET /api/v1/catalogo/produtos/busca?termo=
   * @param apiBaseUrl - Origem da API.
   * @param termo - Texto com pelo menos 2 caracteres.
   */
  async buscarProdutos(apiBaseUrl: string, termo: string): Promise<ProdutoCatalogoResponseDto[]> {
    const params = new URLSearchParams({ termo: termo.trim() });
    const res = await fetchApi(`${apiBaseUrl}/api/v1/catalogo/produtos/busca?${params.toString()}`, {
      headers: await cabecalhoTenant(),
    });
    if (!res.ok) throw new Error(await mensagemErro(res, "Não foi possível buscar medicamentos."));
    const lista = lerProdutosCatalogo(await res.json());
    if (!lista) throw new Error("A API não devolveu o catálogo.");
    return lista;
  },

  /** [RE-MOB-02]: GET /api/v1/catalogo/fabricantes */
  async listarFabricantes(apiBaseUrl: string): Promise<FabricanteResponseDto[]> {
    const res = await fetchApi(`${apiBaseUrl}/api/v1/catalogo/fabricantes`, {
      headers: await cabecalhoTenant(),
    });
    if (!res.ok) throw new Error(await mensagemErro(res, "Não foi possível listar os laboratórios."));
    const lista = lerFabricantes(await res.json());
    if (!lista) throw new Error("A API não devolveu os laboratórios.");
    return lista;
  },

  /** [RE-MOB-02]: POST /api/v1/catalogo/fabricantes */
  async cadastrarFabricante(apiBaseUrl: string, pedido: CriarFabricanteRequest): Promise<FabricanteResponseDto> {
    const res = await fetchApi(`${apiBaseUrl}/api/v1/catalogo/fabricantes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await cabecalhoTenant()) },
      body: JSON.stringify(pedido),
    });
    if (!res.ok) throw new Error(await mensagemErro(res, "Não foi possível cadastrar o laboratório."));
    const criado = lerFabricante(await res.json());
    if (!criado) throw new Error("A API não devolveu o laboratório.");
    return criado;
  },

  /** [RE-MOB-03]: POST /api/v1/recebimento/entradas */
  async efetivarEntrada(apiBaseUrl: string, pedido: CriarEntradaEstoqueRequest): Promise<ReciboEntrada> {
    const res = await fetchApi(`${apiBaseUrl}/api/v1/recebimento/entradas`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await cabecalhoTenant()) },
      body: JSON.stringify(pedido),
    });
    if (!res.ok) throw new Error(await mensagemErro(res, "Não foi possível registrar a entrada."));
    const recibo = lerEntrada(await res.json());
    if (!recibo) throw new Error("A API não devolveu o registro da entrada.");
    return recibo;
  },

  /** [RE-MOB-04]: GET /api/v1/recebimento/historico */
  async listarHistorico(apiBaseUrl: string, filtro: FiltroHistoricoRecebimento): Promise<HistoricoRecebimentoPaginado> {
    const params = new URLSearchParams();
    if (filtro.periodo) params.set("periodo", filtro.periodo);
    if (filtro.termoBusca) params.set("termoBusca", filtro.termoBusca);
    if (filtro.pagina) params.set("pagina", String(filtro.pagina));
    if (filtro.limite) params.set("limite", String(filtro.limite));
    const res = await fetchApi(`${apiBaseUrl}/api/v1/recebimento/historico?${params.toString()}`, {
      headers: await cabecalhoTenant(),
    });
    if (!res.ok) throw new Error(await mensagemErro(res, "Não foi possível consultar o histórico."));
    const lista = lerHistorico(await res.json());
    if (!lista) throw new Error("A API não devolveu o histórico.");
    return lista;
  },

  /** [RE-MOB-04]: GET /api/v1/recebimento/entradas/:id */
  async obterRecebimento(apiBaseUrl: string, id: string): Promise<DetalhesRecebimentoCompleto> {
    const res = await fetchApi(`${apiBaseUrl}/api/v1/recebimento/entradas/${encodeURIComponent(id)}`, {
      headers: await cabecalhoTenant(),
    });
    if (!res.ok) throw new Error(await mensagemErro(res, "Não foi possível abrir o recebimento."));
    const detalhe = lerDetalhe(await res.json());
    if (!detalhe) throw new Error("A API não devolveu o detalhe do recebimento.");
    return detalhe;
  },
};
