import type { CadastrarPacienteRequest } from "@farmaubs/shared";
import { fetchApi } from "./api";
import { sessionService } from "./session.service";
import { lerHistorico, lerListaPacientes, type PacienteEncontrado, type RetiradaRecente } from "../screens/paciente-form";

/**
 * [DI-MOB-01]: A história pede X-Tenant-Id além do Bearer que o fetchApi já envia.
 * @returns Headers da UBS ativa, ou vazio se ainda não há unidade.
 */
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

export const pacienteService = {
  /**
   * [DI-MOB-01]: GET /api/v1/dispensacao/pacientes?termo=
   * @param apiBaseUrl - Origem da API, sem barra no fim.
   * @param termo - CPF ou CNS só com dígitos.
   * @returns Pacientes do município da sessão.
   */
  async buscar(apiBaseUrl: string, termo: string): Promise<PacienteEncontrado[]> {
    const res = await fetchApi(
      `${apiBaseUrl}/api/v1/dispensacao/pacientes?termo=${encodeURIComponent(termo)}`,
      { headers: await cabecalhoTenant() },
    );
    if (!res.ok) throw new Error(await mensagemErro(res, "Não foi possível buscar o paciente."));
    return lerListaPacientes(await res.json());
  },

  /**
   * [DI-MOB-01]: GET /api/v1/dispensacao/pacientes/:id/historico
   * @param apiBaseUrl - Origem da API.
   * @param pacienteId - UUID do paciente encontrado.
   * @returns Retiradas dos últimos 90 dias.
   */
  async historico(apiBaseUrl: string, pacienteId: string): Promise<RetiradaRecente[]> {
    const res = await fetchApi(
      `${apiBaseUrl}/api/v1/dispensacao/pacientes/${encodeURIComponent(pacienteId)}/historico`,
      { headers: await cabecalhoTenant() },
    );
    if (!res.ok) throw new Error(await mensagemErro(res, "Não foi possível carregar o histórico."));
    return lerHistorico(await res.json());
  },

  /**
   * [DI-MOB-01]: Paciente novo segue pelo formulário. O POST usa o contrato do shared.
   * @param apiBaseUrl - Origem da API.
   * @param dados - CNS, CPF, nome e data ISO.
   * @returns Paciente gravado.
   */
  async cadastrar(apiBaseUrl: string, dados: CadastrarPacienteRequest): Promise<PacienteEncontrado> {
    const res = await fetchApi(`${apiBaseUrl}/api/v1/dispensacao/pacientes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await cabecalhoTenant()) },
      body: JSON.stringify(dados),
    });
    if (!res.ok) throw new Error(await mensagemErro(res, "Não foi possível cadastrar o paciente."));
    const lista = lerListaPacientes([await res.json()]);
    if (!lista[0]) throw new Error("Não foi possível cadastrar o paciente.");
    return lista[0];
  },
};
