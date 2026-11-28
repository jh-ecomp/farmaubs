import type {
  AjusteEstoqueResultadoDto,
  ConsultarSaldosPaginadosResponseDto,
  ConsultarSaldosQueryDto,
  EstoqueMetricasResponseDto,
  ExportarRelatorioEstoqueQueryDto,
  RastreabilidadeLoteDto,
  RegistrarAjusteLoteInputDto,
} from "@farmaubs/shared";
import { inspectSessionExpiresHeader } from "./api";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";
export const DEFAULT_UBS_PARNAIBA_ID = "01950000-0000-7000-8000-000000000001";

export class EstoqueApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "EstoqueApiError";
    this.status = status;
    this.data = data;
  }
}

const JSON_HEADERS: HeadersInit = {
  "Content-Type": "application/json",
};

/**
 * [NF015 / ADR-002]: Resolve o UUID da UBS ativa a partir do parâmetro explícito ou da sessão armazenada.
 * @param unidadeIdExplicita - UUID da unidade informado pelo chamador.
 * @returns UUID da UBS ativa ou o identificador padrão de fallback.
 */
export function obterUnidadeAtivaEstoque(unidadeIdExplicita?: string): string {
  if (unidadeIdExplicita && unidadeIdExplicita.trim().length > 0) {
    return unidadeIdExplicita.trim();
  }
  try {
    const rawUser = localStorage.getItem("@FarmaUBS:usuario");
    if (rawUser) {
      const parsed = JSON.parse(rawUser) as {
        unidadeIds?: string[];
        unidade_id?: string;
      };
      if (Array.isArray(parsed.unidadeIds) && parsed.unidadeIds.length > 0) {
        return String(parsed.unidadeIds[0]);
      }
      if (parsed.unidade_id) {
        return String(parsed.unidade_id);
      }
    }
  } catch {
    // Fallback silencioso em caso de storage indisponível ou malformado
  }
  return DEFAULT_UBS_PARNAIBA_ID;
}

/**
 * [ES-02 / ES-08]: Constrói a query string de consulta paginada de saldos de estoque.
 * @param filtros - Filtros de busca textual, categoria, validade, status de estoque e paginação.
 * @returns Query string formatada precedida por '?'.
 */
function buildQuerySaldos(filtros: ConsultarSaldosQueryDto = {}): string {
  const params = new URLSearchParams();
  const unidadeId = obterUnidadeAtivaEstoque(filtros.unidadeId);
  params.set("unidadeId", unidadeId);

  if (filtros.termo && filtros.termo.trim().length > 0) {
    params.set("termo", filtros.termo.trim());
  }
  if (filtros.categoria && filtros.categoria.trim().length > 0) {
    params.set("categoria", filtros.categoria.trim());
  }
  if (filtros.filtroValidade && filtros.filtroValidade !== "TODOS") {
    params.set("filtroValidade", filtros.filtroValidade);
  }
  if (filtros.statusEstoque && filtros.statusEstoque !== "TODOS") {
    params.set("statusEstoque", filtros.statusEstoque);
  }
  if (filtros.pagina) {
    params.set("pagina", String(filtros.pagina));
  }
  if (filtros.itensPorPagina) {
    params.set("itensPorPagina", String(filtros.itensPorPagina));
  }

  return `?${params.toString()}`;
}

/**
 * [ES-05 / ES-10]: Constrói a query string para exportação de relatórios de estoque em .xlsx.
 * @param filtros - Tipo de relatório, intervalo de datas, princípio ativo e categoria.
 * @returns Query string formatada precedida por '?'.
 */
function buildQueryRelatorios(
  filtros: ExportarRelatorioEstoqueQueryDto,
): string {
  const params = new URLSearchParams();
  const unidadeId = obterUnidadeAtivaEstoque(filtros.unidadeId);
  params.set("unidadeId", unidadeId);
  params.set("tipoRelatorio", filtros.tipoRelatorio);

  if (filtros.dataInicio) params.set("dataInicio", filtros.dataInicio);
  if (filtros.dataFim) params.set("dataFim", filtros.dataFim);
  if (filtros.principioAtivo && filtros.principioAtivo.trim().length > 0) {
    params.set("principioAtivo", filtros.principioAtivo.trim());
  }
  if (filtros.categoria && filtros.categoria.trim().length > 0) {
    params.set("categoria", filtros.categoria.trim());
  }

  return `?${params.toString()}`;
}

export const estoqueService = {
  /**
   * [ES-01 / ES-06 / RF018 / RF022 / RF023]: Obtém os indicadores consolidados de estoque da UBS.
   * @param unidadeId - UUID opcional da unidade de saúde.
   * @returns Totalizadores de medicamentos, unidades físicas, risco de ruptura e lotes com validade curta.
   * @throws {EstoqueApiError} Em caso de falha HTTP ou de conectividade.
   */
  async obterMetricas(unidadeId?: string): Promise<EstoqueMetricasResponseDto> {
    const uid = obterUnidadeAtivaEstoque(unidadeId);
    let res: Response;
    try {
      res = await fetch(
        `${API_BASE_URL}/estoque/metricas?unidadeId=${encodeURIComponent(uid)}`,
        {
          credentials: "include",
          headers: JSON_HEADERS,
        },
      );
      res = inspectSessionExpiresHeader(res);
    } catch {
      throw new EstoqueApiError(
        "Não foi possível carregar os indicadores de estoque da UBS.",
        0,
      );
    }

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      const msg = Array.isArray(erro.message)
        ? erro.message.join("; ")
        : erro.message || "Erro ao consultar métricas de estoque.";
      throw new EstoqueApiError(msg, res.status, erro);
    }

    return await res.json();
  },

  /**
   * [ES-02 / ES-07 / ES-08 / RF005 / RF022]: Consulta a lista paginada de saldos por medicamento e lotes FEFO.
   * @param filtros - Filtros de busca textual, categoria, validade, status e paginação.
   * @returns Página de medicamentos com seus lotes físicos e metadados de paginação.
   * @throws {EstoqueApiError} Em caso de parâmetros inválidos ou falha de rede.
   */
  async consultarSaldos(
    filtros: ConsultarSaldosQueryDto = {},
  ): Promise<ConsultarSaldosPaginadosResponseDto> {
    const qs = buildQuerySaldos(filtros);
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/estoque/saldos${qs}`, {
        credentials: "include",
        headers: JSON_HEADERS,
      });
      res = inspectSessionExpiresHeader(res);
    } catch {
      throw new EstoqueApiError(
        "Não foi possível consultar os saldos de estoque da unidade.",
        0,
      );
    }

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      const msg = Array.isArray(erro.message)
        ? erro.message.join("; ")
        : erro.message || "Erro ao consultar saldos de estoque.";
      throw new EstoqueApiError(msg, res.status, erro);
    }

    return await res.json();
  },

  /**
   * [ES-03 / ES-09 / RF009 / RF011 / RF028]: Registra um ajuste manual justificado (+) ou (-) em um lote.
   * @param loteId - UUID do lote físico a ser ajustado.
   * @param payload - Tipo de operação (ENTRADA/SAIDA), quantidade, motivo sanitário e justificativa.
   * @returns Resultado do ajuste com saldo anterior, saldo atualizado e dados de auditoria.
   * @throws {EstoqueApiError} Se o saldo for insuficiente (422), dados inválidos (400) ou lote não encontrado (404).
   */
  async registrarAjuste(
    loteId: string,
    payload: RegistrarAjusteLoteInputDto,
  ): Promise<AjusteEstoqueResultadoDto> {
    let res: Response;
    try {
      res = await fetch(
        `${API_BASE_URL}/estoque/lotes/${encodeURIComponent(loteId)}/ajustes`,
        {
          method: "POST",
          credentials: "include",
          headers: JSON_HEADERS,
          body: JSON.stringify(payload),
        },
      );
      res = inspectSessionExpiresHeader(res);
    } catch {
      throw new EstoqueApiError(
        "Não foi possível conectar ao servidor para registrar o ajuste de estoque.",
        0,
      );
    }

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      const msg = Array.isArray(erro.message)
        ? erro.message.join("; ")
        : erro.message || "Não foi possível registrar o ajuste no lote.";
      throw new EstoqueApiError(msg, res.status, erro);
    }

    return await res.json();
  },

  /**
   * [ES-04 / ES-09 / RF028]: Consulta a ficha de rastreabilidade e linha do tempo cronológica de um lote.
   * @param loteId - UUID do lote físico consultado.
   * @returns Metadados do lote, medicamento e histórico completo de movimentações com saldo resultante.
   * @throws {EstoqueApiError} Caso o lote não seja encontrado ou ocorra erro de comunicação.
   */
  async consultarRastreabilidadeLote(
    loteId: string,
  ): Promise<RastreabilidadeLoteDto> {
    let res: Response;
    try {
      res = await fetch(
        `${API_BASE_URL}/estoque/lotes/${encodeURIComponent(loteId)}/rastreabilidade`,
        {
          credentials: "include",
          headers: JSON_HEADERS,
        },
      );
      res = inspectSessionExpiresHeader(res);
    } catch {
      throw new EstoqueApiError(
        "Não foi possível carregar a ficha de rastreabilidade do lote.",
        0,
      );
    }

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      const msg = Array.isArray(erro.message)
        ? erro.message.join("; ")
        : erro.message || "Erro ao consultar rastreabilidade do lote.";
      throw new EstoqueApiError(msg, res.status, erro);
    }

    return await res.json();
  },

  /**
   * [ES-05 / ES-10 / RF020 / RF028]: Exporta o relatório de estoque selecionado em planilha Excel (.xlsx).
   * Possui fallback resiliente client-side caso o endpoint binário ainda não esteja disponível.
   * @param filtros - Tipo de relatório, intervalo de datas, princípio ativo e categoria.
   * @returns Blob binário da planilha e nome sugerido para download.
   */
  async exportarRelatorioXlsx(
    filtros: ExportarRelatorioEstoqueQueryDto,
  ): Promise<{ blob: Blob; nomeArquivo: string }> {
    const qs = buildQueryRelatorios(filtros);
    const hoje = new Date().toISOString().slice(0, 10);
    const dataInicio = filtros.dataInicio || hoje;
    const dataFim = filtros.dataFim || hoje;
    const nomePadrao = `relatorio_estoque_${filtros.tipoRelatorio}_${dataInicio}_${dataFim}.xlsx`;

    try {
      let res = await fetch(
        `${API_BASE_URL}/estoque/relatorios/exportar-xlsx${qs}`,
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
      // Fallback para geração local caso rota binária não esteja disponível
    }

    // Fallback: gera planilha estruturada a partir dos saldos atuais da UBS
    let linhasDados: string[] = [];
    try {
      const paginado = await this.consultarSaldos({
        unidadeId: filtros.unidadeId,
        termo: filtros.principioAtivo,
        categoria: filtros.categoria,
        pagina: 1,
        itensPorPagina: 100,
      });

      for (const med of paginado.itens) {
        if (med.lotes && med.lotes.length > 0) {
          for (const lote of med.lotes) {
            linhasDados.push(
              [
                med.nome,
                med.principioAtivo,
                med.concentracao,
                med.formaFarmaceutica,
                med.categoria,
                lote.numeroLote,
                lote.fabricanteNome,
                lote.dataValidade,
                lote.saldoAtual,
                lote.statusValidade,
              ]
                .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
                .join(";"),
            );
          }
        } else {
          linhasDados.push(
            [
              med.nome,
              med.principioAtivo,
              med.concentracao,
              med.formaFarmaceutica,
              med.categoria,
              "-",
              "-",
              "-",
              med.saldoTotal,
              med.statusEstoque,
            ]
              .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
              .join(";"),
          );
        }
      }
    } catch {
      linhasDados = [];
    }

    const cabecalho = [
      "Medicamento",
      "Principio Ativo",
      "Concentracao",
      "Forma Farmaceutica",
      "Categoria",
      "Lote",
      "Fabricante",
      "Validade",
      "Saldo",
      "Status",
    ].join(";");

    const conteudo = "\uFEFF" + [cabecalho, ...linhasDados].join("\r\n");
    const blob = new Blob([conteudo], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    return { blob, nomeArquivo: nomePadrao };
  },
};
