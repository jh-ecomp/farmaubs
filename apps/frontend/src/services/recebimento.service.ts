import type {
  CriarEntradaEstoqueRequest,
  CriarFabricanteRequest,
  DetalhesRecebimentoCompleto,
  EntradaEstoqueEfetivadaResultado,
  FabricanteResponseDto,
  FiltroHistoricoRecebimento,
  HistoricoRecebimentoPaginado,
  ProdutoCatalogoResponseDto,
  ResultadoEstornoRecebimento,
} from "@farmaubs/shared";
import { inspectSessionExpiresHeader } from "./api";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

export class RecebimentoApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "RecebimentoApiError";
    this.status = status;
    this.data = data;
  }
}

const JSON_HEADERS: HeadersInit = {
  "Content-Type": "application/json",
};

/**
 * Constrói a string de query params para listagem e exportação do histórico de recebimentos.
 * @param filtros - Filtros de período, datas, busca textual, status e paginação.
 * @returns Query string precedida por '?' ou string vazia.
 */
function buildQueryHistorico(filtros: FiltroHistoricoRecebimento = {}): string {
  const params = new URLSearchParams();
  if (filtros.ubsId) params.set("ubsId", filtros.ubsId);
  if (filtros.periodo) params.set("periodo", filtros.periodo);
  if (filtros.dataInicio) params.set("dataInicio", filtros.dataInicio);
  if (filtros.dataFim) params.set("dataFim", filtros.dataFim);
  if (filtros.termoBusca) params.set("termoBusca", filtros.termoBusca);
  if (filtros.status) params.set("status", filtros.status);
  if (filtros.pagina) params.set("pagina", String(filtros.pagina));
  if (filtros.limite) params.set("limite", String(filtros.limite));

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const recebimentoService = {
  /**
   * Busca medicamentos ativos no catálogo padronizado pelo nome genérico ou princípio ativo.
   * @param termo - Texto de busca (mínimo de 2 caracteres).
   * @returns Lista de produtos padronizados correspondentes.
   * @throws {RecebimentoApiError} Em caso de falha de comunicação com o servidor.
   */
  async buscarProdutosCatalogo(
    termo: string,
  ): Promise<ProdutoCatalogoResponseDto[]> {
    const clean = termo.trim();
    if (clean.length < 2) {
      return [];
    }

    let res: Response;
    try {
      res = await fetch(
        `${API_BASE_URL}/catalogo/produtos/busca?termo=${encodeURIComponent(clean)}`,
        {
          credentials: "include",
          headers: JSON_HEADERS,
        },
      );
      res = inspectSessionExpiresHeader(res);
    } catch {
      throw new RecebimentoApiError(
        "Não foi possível consultar o catálogo de medicamentos.",
        0,
      );
    }

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      throw new RecebimentoApiError(
        erro.message || "Erro ao buscar medicamentos no catálogo.",
        res.status,
        erro,
      );
    }

    return await res.json();
  },

  /**
   * Lista os fabricantes e laboratórios farmacêuticos ativos para seleção no recebimento.
   * @returns Lista ordenada de fabricantes ativos.
   * @throws {RecebimentoApiError} Em caso de falha HTTP ou de rede.
   */
  async listarFabricantes(): Promise<FabricanteResponseDto[]> {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/catalogo/fabricantes`, {
        credentials: "include",
        headers: JSON_HEADERS,
      });
      res = inspectSessionExpiresHeader(res);
    } catch {
      throw new RecebimentoApiError(
        "Não foi possível carregar a lista de fabricantes.",
        0,
      );
    }

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      throw new RecebimentoApiError(
        erro.message || "Erro ao consultar fabricantes cadastrados.",
        res.status,
        erro,
      );
    }

    return await res.json();
  },

  /**
   * Cadastra rapidamente um novo fabricante/laboratório durante o fluxo de recebimento.
   * @param payload - Dados de razão social, nome fantasia e CNPJ opcional.
   * @returns Fabricante recém-criado para pré-seleção imediata.
   * @throws {RecebimentoApiError} Se já existir fabricante conflitante ou dados inválidos.
   */
  async cadastrarFabricante(
    payload: CriarFabricanteRequest,
  ): Promise<FabricanteResponseDto> {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/catalogo/fabricantes`, {
        method: "POST",
        credentials: "include",
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
      });
      res = inspectSessionExpiresHeader(res);
    } catch {
      throw new RecebimentoApiError(
        "Não foi possível conectar ao servidor para cadastrar o fabricante.",
        0,
      );
    }

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      const msg = Array.isArray(erro.message)
        ? erro.message.join("; ")
        : erro.message || "Não foi possível cadastrar o fabricante.";
      throw new RecebimentoApiError(msg, res.status, erro);
    }

    return await res.json();
  },

  /**
   * Efetiva a entrada física de uma guia/nota fiscal abastecendo os lotes da UBS.
   * @param payload - Cabeçalho do documento e lista de itens com lote, validade e fabricante.
   * @returns Resultado da entrada efetivada com saldos atualizados e avisos de validade curta.
   * @throws {RecebimentoApiError} Em caso de lote vencido, falha de rede ou erro interno.
   */
  async efetivarEntrada(
    payload: CriarEntradaEstoqueRequest,
  ): Promise<EntradaEstoqueEfetivadaResultado> {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/recebimento/entradas`, {
        method: "POST",
        credentials: "include",
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
      });
      res = inspectSessionExpiresHeader(res);
    } catch {
      throw new RecebimentoApiError(
        "Falha ao registrar entrada. Verifique sua conexão e tente novamente.",
        0,
      );
    }

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      const msg = Array.isArray(erro.message)
        ? erro.message.join("; ")
        : erro.message ||
          "Falha ao registrar entrada. Verifique sua conexão e tente novamente.";
      throw new RecebimentoApiError(msg, res.status, erro);
    }

    return await res.json();
  },

  /**
   * Consulta o histórico paginado de guias de recebimento da UBS com filtros de período e status.
   * @param filtros - Filtros de período, datas, termo de busca, status e paginação.
   * @returns Lista paginada de recebimentos resumidos.
   * @throws {RecebimentoApiError} Em caso de falha na consulta.
   */
  async listarHistorico(
    filtros: FiltroHistoricoRecebimento = {},
  ): Promise<HistoricoRecebimentoPaginado> {
    const qs = buildQueryHistorico(filtros);
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/recebimento/historico${qs}`, {
        credentials: "include",
        headers: JSON_HEADERS,
      });
      res = inspectSessionExpiresHeader(res);
    } catch {
      throw new RecebimentoApiError(
        "Não foi possível carregar o histórico de recebimentos.",
        0,
      );
    }

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      throw new RecebimentoApiError(
        erro.message || "Erro ao consultar histórico de recebimentos.",
        res.status,
        erro,
      );
    }

    return await res.json();
  },

  /**
   * Obtém os detalhes completos de uma guia de recebimento para emissão do Termo de Recebimento.
   * @param entradaId - UUID da entrada de estoque.
   * @returns Detalhes completos da guia e todos os seus itens e lotes.
   * @throws {RecebimentoApiError} Caso a guia não seja encontrada ou ocorra erro de rede.
   */
  async obterDetalhesEntrada(
    entradaId: string,
  ): Promise<DetalhesRecebimentoCompleto> {
    let res: Response;
    try {
      res = await fetch(
        `${API_BASE_URL}/recebimento/entradas/${encodeURIComponent(entradaId)}`,
        {
          credentials: "include",
          headers: JSON_HEADERS,
        },
      );
      res = inspectSessionExpiresHeader(res);
    } catch {
      throw new RecebimentoApiError(
        "Não foi possível carregar o comprovante de recebimento.",
        0,
      );
    }

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      throw new RecebimentoApiError(
        erro.message || "Erro ao carregar os detalhes do recebimento.",
        res.status,
        erro,
      );
    }

    return await res.json();
  },

  /**
   * Realiza o estorno integral de uma guia de recebimento mediante justificativa obrigatória.
   * @param entradaId - UUID da guia de recebimento a ser estornada.
   * @param motivo - Justificativa de auditoria (mínimo de 10 caracteres).
   * @returns Resumo do estorno processado com status ESTORNADO.
   * @throws {RecebimentoApiError} Se lotes já tiverem sido dispensados (400/409) ou falha de rede.
   */
  async estornarEntrada(
    entradaId: string,
    motivo: string,
  ): Promise<ResultadoEstornoRecebimento> {
    let res: Response;
    try {
      res = await fetch(
        `${API_BASE_URL}/recebimento/entradas/${encodeURIComponent(entradaId)}/estorno`,
        {
          method: "POST",
          credentials: "include",
          headers: JSON_HEADERS,
          body: JSON.stringify({ motivo }),
        },
      );
      res = inspectSessionExpiresHeader(res);
    } catch {
      throw new RecebimentoApiError(
        "Não foi possível conectar ao servidor para estornar o recebimento.",
        0,
      );
    }

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      const msg = Array.isArray(erro.message)
        ? erro.message.join("; ")
        : erro.message || "Não foi possível estornar este recebimento.";
      throw new RecebimentoApiError(msg, res.status, erro);
    }

    return await res.json();
  },

  /**
   * Exporta os recebimentos filtrados em formato de planilha (.xlsx).
   * @param filtros - Mesmos filtros ativos no painel de histórico.
   * @returns Blob binário da planilha e nome sugerido do arquivo.
   */
  async exportarHistoricoXlsx(
    filtros: FiltroHistoricoRecebimento = {},
  ): Promise<{ blob: Blob; nomeArquivo: string }> {
    const qs = buildQueryHistorico(filtros);
    const dataRef = filtros.dataFim || new Date().toISOString().slice(0, 10);
    const nomePadrao = `recebimentos-ubs-parnaiba-${dataRef}.xlsx`;

    try {
      let res = await fetch(
        `${API_BASE_URL}/recebimento/historico/exportar-xlsx${qs}`,
        {
          credentials: "include",
        },
      );
      res = inspectSessionExpiresHeader(res);

      if (res.ok) {
        const disposition = res.headers.get("Content-Disposition") || "";
        const matchFilename = /filename="?([^";]+)"?/i.exec(disposition);
        const blob = await res.blob();
        return {
          blob,
          nomeArquivo: matchFilename?.[1] || nomePadrao,
        };
      }
    } catch {
      // Fallback para geração local a partir da listagem caso rota binária não responda
    }

    const paginado = await this.listarHistorico({ ...filtros, limite: 500 });
    const cabecalho = [
      "Data/Hora",
      "Documento",
      "Tipo",
      "Fornecedor",
      "Itens",
      "Unidades",
      "Responsavel",
      "Status",
    ].join(";");
    const linhas = paginado.itens.map((item) =>
      [
        new Date(item.dataRecebimento).toLocaleString("pt-BR"),
        item.numeroDocumento,
        item.tipoDocumento,
        item.fornecedorOrigem,
        item.totalItens,
        item.totalUnidades,
        item.usuarioRecebedorNome,
        item.status,
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(";"),
    );
    const conteudo = "\uFEFF" + [cabecalho, ...linhas].join("\r\n");
    const blob = new Blob([conteudo], {
      type: "text/csv;charset=utf-8;",
    });
    const nomeFallbackCsv = nomePadrao.replace(/\.xlsx$/i, ".csv");

    return { blob, nomeArquivo: nomeFallbackCsv };
  },
};
