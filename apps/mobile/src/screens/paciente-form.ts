import {
  calcularIdade,
  limparNaoNumericos,
  normalizarDataParaIso,
  validarCNS,
  validarCPF,
  type ItemHistoricoConsumoDto,
  type PacienteDto,
} from "@farmaubs/shared";

export const MENSAGEM_CPF_INVALIDO = "CPF inválido";
export const MENSAGEM_CNS_INVALIDO = "CNS inválido";
export const DEBOUNCE_BUSCA_MS = 300;
export const DIAS_ALERTA_RETIRADA = 25;

export type PacienteEncontrado = Pick<
  PacienteDto,
  "id" | "cns" | "cpf" | "nomeCompleto" | "dataNascimento"
>;

export type RetiradaRecente = {
  dispensacaoId: string;
  medicamentoNome: string;
  dataDispensacao: string;
  quantidadeDispensada: number;
  diasDesdeUltimaRetirada: number;
  possivelUsoIrracional: boolean;
};

/**
 * [DI-MOB-01]: O aviso âmbar usa o texto da história.
 * @param dias - Dias desde a última retirada desse medicamento.
 * @returns Frase exibida no cartão.
 */
export function mensagemAlertaRetirada(dias: number): string {
  return `⚠️ Retirada recente há ${dias} dias. Tratamento padrão de 30 dias em curso.`;
}

/**
 * [DI-MOB-01]: Busca só com CPF completo e dígitos verificadores válidos.
 * @param digitos - CPF só com números.
 * @returns True quando a consulta pode sair.
 */
export function cpfDeveSerBuscado(digitos: string): boolean {
  return digitos.length === 11 && validarCPF(digitos);
}

/**
 * [DI-MOB-01]: Busca só com CNS de 15 dígitos aceito por validarCNS.
 * @param digitos - CNS só com números.
 * @returns True quando a consulta pode sair.
 */
export function cnsDeveSerBuscado(digitos: string): boolean {
  return digitos.length === 15 && validarCNS(digitos);
}

/**
 * [DI-MOB-01]: O erro "CPF inválido" aparece ao sair do campo, não a cada tecla.
 * @param digitos - CPF só com números.
 * @returns A frase da história, ou null se ainda está incompleto ou é válido.
 */
export function erroCpfAoSair(digitos: string): string | null {
  if (digitos.length !== 11) return null;
  return validarCPF(digitos) ? null : MENSAGEM_CPF_INVALIDO;
}

/**
 * [DI-MOB-01]: CNS completo que validarCNS recusa.
 * @param digitos - CNS só com números.
 * @returns "CNS inválido", ou null.
 */
export function erroCnsAoSair(digitos: string): string | null {
  if (digitos.length !== 15) return null;
  return validarCNS(digitos) ? null : MENSAGEM_CNS_INVALIDO;
}

/**
 * [DI-MOB-01]: Os quatro campos obrigatórios, com as funções puras do shared.
 * @param cns - CNS mascarado ou só dígitos.
 * @param cpf - CPF mascarado ou só dígitos.
 * @param nome - Nome completo.
 * @param data - Data em DD/MM/AAAA.
 * @returns True quando o botão Avançar pode habilitar.
 */
export function pacientePronto(cns: string, cpf: string, nome: string, data: string): boolean {
  const iso = normalizarDataParaIso(data);
  return (
    validarCNS(limparNaoNumericos(cns)) &&
    validarCPF(limparNaoNumericos(cpf)) &&
    nome.trim().length >= 3 &&
    iso !== "" &&
    calcularIdade(iso) !== null
  );
}

/** [DI-MOB-01]: O cartão fica âmbar quando a retirada tem menos de 25 dias. */
export function retiradaRecente(item: Pick<RetiradaRecente, "diasDesdeUltimaRetirada" | "possivelUsoIrracional">): boolean {
  return item.possivelUsoIrracional || item.diasDesdeUltimaRetirada < DIAS_ALERTA_RETIRADA;
}

function lerPaciente(item: unknown): PacienteEncontrado | null {
  if (!item || typeof item !== "object") return null;
  const paciente = item as Partial<PacienteDto>;
  if (typeof paciente.id !== "string" || !paciente.id) return null;
  if (typeof paciente.cns !== "string" || typeof paciente.cpf !== "string") return null;
  if (typeof paciente.nomeCompleto !== "string" || typeof paciente.dataNascimento !== "string") return null;
  return {
    id: paciente.id,
    cns: paciente.cns,
    cpf: paciente.cpf,
    nomeCompleto: paciente.nomeCompleto,
    dataNascimento: paciente.dataNascimento,
  };
}

/**
 * [DI-MOB-01]: Lê a lista de GET /dispensacao/pacientes.
 * @param data - Corpo já interpretado.
 * @returns Pacientes utilizáveis. Lista vazia se o corpo não for um array.
 */
export function lerListaPacientes(data: unknown): PacienteEncontrado[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    const paciente = lerPaciente(item);
    return paciente ? [paciente] : [];
  });
}

/**
 * [DI-MOB-01]: Lê itensConsumo de GET /dispensacao/pacientes/:id/historico.
 * @param data - Corpo já interpretado.
 * @returns Retiradas dos últimos 90 dias que a API devolveu.
 */
export function lerHistorico(data: unknown): RetiradaRecente[] {
  if (!data || typeof data !== "object" || !("itensConsumo" in data)) return [];
  const itens = (data as { itensConsumo?: unknown }).itensConsumo;
  if (!Array.isArray(itens)) return [];
  return itens.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const linha = item as Partial<ItemHistoricoConsumoDto>;
    if (typeof linha.dispensacaoId !== "string" || typeof linha.medicamentoNome !== "string") return [];
    if (typeof linha.diasDesdeUltimaRetirada !== "number") return [];
    return [
      {
        dispensacaoId: linha.dispensacaoId,
        medicamentoNome: linha.medicamentoNome,
        dataDispensacao: typeof linha.dataDispensacao === "string" ? linha.dataDispensacao : String(linha.dataDispensacao ?? ""),
        quantidadeDispensada: typeof linha.quantidadeDispensada === "number" ? linha.quantidadeDispensada : 0,
        diasDesdeUltimaRetirada: linha.diasDesdeUltimaRetirada,
        possivelUsoIrracional: linha.possivelUsoIrracional === true,
      },
    ];
  });
}
