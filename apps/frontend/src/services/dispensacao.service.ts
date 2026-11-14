import type {
  DispensacaoEfetivadaResultado,
  DispensacoesPaginadasResultado,
  EfetivarDispensacaoRequest,
  EstornarDispensacaoRequest,
  EstornarDispensacaoResultado,
  ListarDispensacoesQuery,
} from "@farmaubs/shared";
import { inspectSessionExpiresHeader } from "./api";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

export class DispensacaoApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "DispensacaoApiError";
    this.status = status;
    this.data = data;
  }
}

const JSON_HEADERS: HeadersInit = {
  "Content-Type": "application/json",
};

/**
 * [RF012]: Constrói a string de query params para listagem e exportação do histórico de dispensas.
 * @param filtros - Filtros de período, paciente, medicamento, categoria, status e paginação.
 * @returns Query string precedida por '?' ou string vazia.
 */
function buildQueryDispensacoes(filtros: ListarDispensacoesQuery = {}): string {
  const params = new URLSearchParams();
  if (filtros.ubsId) params.set("ubsId", filtros.ubsId);
  if (filtros.pagina) params.set("pagina", String(filtros.pagina));
  if (filtros.limite) params.set("limite", String(filtros.limite));
  if (filtros.dataInicio) params.set("dataInicio", filtros.dataInicio);
  if (filtros.dataFim) params.set("dataFim", filtros.dataFim);
  if (filtros.pacienteTermo) params.set("pacienteTermo", filtros.pacienteTermo);
  if (filtros.medicamentoTermo) {
    params.set("medicamentoTermo", filtros.medicamentoTermo);
  }
  if (filtros.categoria) params.set("categoria", filtros.categoria);
  if (filtros.status) params.set("status", filtros.status);

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const dispensacaoService = {
  /**
   * [RF010 / ADR-015 / NF012]: Efetiva a dispensação de medicamentos realizando baixa transacional nos lotes da UBS.
   * @param payload - Dados do paciente, itens do carrinho e data de emissão da receita (se antimicrobiano).
   * @returns Recibo e resumo da dispensação efetivada com saldos remanescentes.
   * @throws {DispensacaoApiError} Em caso de saldo insuficiente, receita vencida ou falha de conexão.
   */
  async efetivarDispensacao(
    payload: EfetivarDispensacaoRequest,
  ): Promise<DispensacaoEfetivadaResultado> {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/dispensacoes`, {
        method: "POST",
        credentials: "include",
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
      });
      res = inspectSessionExpiresHeader(res);
    } catch {
      throw new DispensacaoApiError(
        "Não foi possível conectar ao servidor para finalizar o atendimento.",
        0,
      );
    }

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      const mensagem = Array.isArray(erro.message)
        ? erro.message.join("; ")
        : erro.message || "Não foi possível efetivar a dispensação.";
      throw new DispensacaoApiError(mensagem, res.status, erro);
    }

    return await res.json();
  },

  /**
   * [RF012]: Lista o histórico paginado de dispensações da UBS com filtro padrão D-1/D0 (Ontem e Hoje).
   * @param filtros - Parâmetros de filtro temporal, textual e de paginação.
   * @returns Lista paginada de atendimentos e datas efetivas aplicadas.
   * @throws {DispensacaoApiError} Caso o intervalo de datas seja inválido ou ocorra falha HTTP.
   */
  async listarDispensacoes(
    filtros: ListarDispensacoesQuery = {},
  ): Promise<DispensacoesPaginadasResultado> {
    const queryString = buildQueryDispensacoes(filtros);
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/dispensacoes${queryString}`, {
        credentials: "include",
        headers: JSON_HEADERS,
      });
      res = inspectSessionExpiresHeader(res);
    } catch {
      throw new DispensacaoApiError(
        "Não foi possível carregar o histórico de dispensações.",
        0,
      );
    }

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      throw new DispensacaoApiError(
        erro.message || "Erro ao consultar histórico de dispensas.",
        res.status,
        erro,
      );
    }

    return await res.json();
  },

  /**
   * [RF012 / NF010]: Solicita a exportação em arquivo binário Excel (.xlsx) das dispensações filtradas.
   * @param filtros - Mesmos filtros ativos na tabela de histórico.
   * @returns Objeto contendo o Blob binário da planilha e o nome sugerido do arquivo.
   * @throws {DispensacaoApiError} Em caso de falha na geração ou download do arquivo.
   */
  async exportarDispensacoesXlsx(
    filtros: ListarDispensacoesQuery = {},
  ): Promise<{ blob: Blob; nomeArquivo: string }> {
    const queryString = buildQueryDispensacoes(filtros);
    let res: Response;
    try {
      res = await fetch(
        `${API_BASE_URL}/dispensacoes/exportar-xlsx${queryString}`,
        {
          credentials: "include",
        },
      );
      res = inspectSessionExpiresHeader(res);
    } catch {
      throw new DispensacaoApiError(
        "Não foi possível conectar ao servidor para exportar a planilha.",
        0,
      );
    }

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      throw new DispensacaoApiError(
        erro.message || "Erro ao exportar planilha Excel (.xlsx).",
        res.status,
        erro,
      );
    }

    const disposition = res.headers.get("Content-Disposition") || "";
    const matchFilename = /filename="?([^";]+)"?/i.exec(disposition);
    const inicio = filtros.dataInicio || "ontem";
    const fim = filtros.dataFim || "hoje";
    const nomeArquivo =
      matchFilename?.[1] || `dispensacoes-${inicio}-a-${fim}.xlsx`;

    const blob = await res.blob();
    return { blob, nomeArquivo };
  },

  /**
   * [RF028 / ADR-015]: Estorna um atendimento concluído mediante justificativa obrigatória (>= 10 caracteres), restituindo os lotes ao estoque.
   * @param dispensacaoId - UUID do atendimento a ser estornado.
   * @param payload - Objeto contendo motivoEstorno e ubsId opcional.
   * @returns Resumo do estorno e saldos recompostos.
   * @throws {DispensacaoApiError} Se a justificativa for curta (400) ou o atendimento já estiver estornado (409).
   */
  async estornarDispensacao(
    dispensacaoId: string,
    payload: EstornarDispensacaoRequest,
  ): Promise<EstornarDispensacaoResultado> {
    let res: Response;
    try {
      res = await fetch(
        `${API_BASE_URL}/dispensacoes/${encodeURIComponent(dispensacaoId)}/estorno`,
        {
          method: "POST",
          credentials: "include",
          headers: JSON_HEADERS,
          body: JSON.stringify(payload),
        },
      );
      res = inspectSessionExpiresHeader(res);
    } catch {
      throw new DispensacaoApiError(
        "Não foi possível conectar ao servidor para estornar o atendimento.",
        0,
      );
    }

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      throw new DispensacaoApiError(
        erro.message || "Erro ao realizar o estorno da dispensação.",
        res.status,
        erro,
      );
    }

    return await res.json();
  },
};
