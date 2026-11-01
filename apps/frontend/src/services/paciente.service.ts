import type {
  CadastrarPacienteRequest,
  HistoricoPacienteResultado,
  PacienteDto,
} from "@farmaubs/shared";
import { inspectSessionExpiresHeader } from "./api";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

export class PacienteApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "PacienteApiError";
    this.status = status;
    this.data = data;
  }
}

const JSON_HEADERS: HeadersInit = {
  "Content-Type": "application/json",
};

export const pacienteService = {
  /**
   * [RF010 / NF010 / NF012]: Busca pacientes do município por CPF, CNS ou nome com envio automático de cookie HttpOnly.
   * @param termo - Termo de busca (CPF, CNS ou fragmento de nome).
   * @returns Lista de pacientes encontrados.
   * @throws {PacienteApiError} Em caso de falha de rede ou erro HTTP.
   */
  async buscarPacientes(termo: string): Promise<PacienteDto[]> {
    const termoLimpo = termo.trim();
    if (!termoLimpo) return [];

    const query = `?termo=${encodeURIComponent(termoLimpo)}`;
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/dispensacao/pacientes${query}`, {
        credentials: "include",
        headers: JSON_HEADERS,
      });
      res = inspectSessionExpiresHeader(res);
    } catch {
      throw new PacienteApiError(
        "Não foi possível conectar ao servidor para buscar pacientes.",
        0,
      );
    }

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      throw new PacienteApiError(
        erro.message || "Erro ao buscar pacientes.",
        res.status,
        erro,
      );
    }

    return await res.json();
  },

  /**
   * [RF010 / NF017]: Cadastra um novo paciente validando os 4 campos obrigatórios no município da sessão.
   * @param dados - Payload de cadastro (CNS, CPF, nomeCompleto e dataNascimento).
   * @returns Registro do paciente cadastrado.
   * @throws {PacienteApiError} Em caso de validação inválida (400) ou conflito de CPF/CNS (409).
   */
  async cadastrarPaciente(
    dados: CadastrarPacienteRequest,
  ): Promise<PacienteDto> {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/dispensacao/pacientes`, {
        method: "POST",
        credentials: "include",
        headers: JSON_HEADERS,
        body: JSON.stringify(dados),
      });
      res = inspectSessionExpiresHeader(res);
    } catch {
      throw new PacienteApiError(
        "Não foi possível conectar ao servidor para cadastrar o paciente.",
        0,
      );
    }

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      throw new PacienteApiError(
        erro.message || "Erro ao cadastrar paciente.",
        res.status,
        erro,
      );
    }

    return await res.json();
  },

  /**
   * [RF012]: Consulta o histórico de consumo do paciente nos últimos 90 dias com indicação de possível uso irracional (< 25 dias).
   * @param pacienteId - UUID do paciente selecionado.
   * @returns Dados cadastrais e lista de retiradas recentes.
   * @throws {PacienteApiError} Caso o paciente não seja encontrado ou ocorra erro na requisição.
   */
  async consultarHistorico(
    pacienteId: string,
  ): Promise<HistoricoPacienteResultado> {
    let res: Response;
    try {
      res = await fetch(
        `${API_BASE_URL}/dispensacao/pacientes/${encodeURIComponent(pacienteId)}/historico`,
        {
          credentials: "include",
          headers: JSON_HEADERS,
        },
      );
      res = inspectSessionExpiresHeader(res);
    } catch {
      throw new PacienteApiError(
        "Não foi possível carregar o histórico de retiradas do paciente.",
        0,
      );
    }

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      throw new PacienteApiError(
        erro.message || "Erro ao consultar histórico do paciente.",
        res.status,
        erro,
      );
    }

    return await res.json();
  },
};
