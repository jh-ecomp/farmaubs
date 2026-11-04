import type { LoteDisponivelDto } from "./catalogo.types";

export interface LoteEntradaFefo {
  id: string;
  numeroLote: string;
  dataValidade: string; // YYYY-MM-DD
  saldoDisponivel: number;
  criadoEm?: string | Date;
}

/**
 * Ordena os lotes com saldo positivo por validade crescente (FEFO) e desempata por data de criação,
 * bloqueando lotes vencidos da sugestão automática (RF010).
 * @param lotes Lista bruta de lotes da UBS.
 * @param dataReferencia Data base para apuração de validade (padrão: hoje).
 * @returns Lista ordenada de LoteDisponivelDto com flags clínicas e sugeridoFefo preenchidas.
 */
export function ordenarLotesPorFEFO(
  lotes: LoteEntradaFefo[],
  dataReferencia: Date = new Date(),
): LoteDisponivelDto[] {
  const hojeStr = dataReferencia.toISOString().slice(0, 10);
  const hojeUtc = new Date(`${hojeStr}T00:00:00Z`);

  const comSaldo = lotes
    .filter((l) => l.saldoDisponivel > 0)
    .slice()
    .sort((a, b) => {
      const cmpValidade = a.dataValidade.localeCompare(b.dataValidade);
      if (cmpValidade !== 0) return cmpValidade;
      const tA = a.criadoEm ? new Date(a.criadoEm).getTime() : 0;
      const tB = b.criadoEm ? new Date(b.criadoEm).getTime() : 0;
      return tA - tB;
    });

  let jaSugeriu = false;

  return comSaldo.map((lote) => {
    const validadeStr = String(lote.dataValidade).slice(0, 10);
    const validadeUtc = new Date(`${validadeStr}T00:00:00Z`);
    const diasParaVencimento = Math.round(
      (validadeUtc.getTime() - hojeUtc.getTime()) / (1000 * 60 * 60 * 24),
    );
    const vencido = validadeStr < hojeStr;
    const alertaValidadeCurta = !vencido && diasParaVencimento <= 30;
    const sugeridoFefo = !vencido && !jaSugeriu;
    if (sugeridoFefo) {
      jaSugeriu = true;
    }

    return {
      id: lote.id,
      numeroLote: lote.numeroLote,
      dataValidade: validadeStr,
      saldoDisponivel: lote.saldoDisponivel,
      sugeridoFefo,
      diasParaVencimento,
      alertaValidadeCurta,
      vencido,
    };
  });
}

/**
 * Seleciona o lote prioritário sugerido pelo algoritmo FEFO dentre os lotes ordenados.
 * @param lotesDisponiveis Lista de lotes já processados por ordenarLotesPorFEFO.
 * @returns O lote sugerido (não vencido de menor validade) ou null caso não haja lote apto.
 */
export function selecionarLoteSugeridoFEFO(
  lotesDisponiveis: LoteDisponivelDto[],
): LoteDisponivelDto | null {
  return (
    lotesDisponiveis.find((lote) => lote.sugeridoFefo && !lote.vencido) ?? null
  );
}

export type CriticidadeValidadeLote = "NORMAL" | "ALERTA" | "CRITICO" | "VENCIDO";

/**
 * [RF010]: Classifica visualmente a criticidade de vencimento de um lote com base nos dias restantes.
 * @param diasParaVencimento - Dias até a data de validade do lote.
 * @returns Nível de criticidade ('VENCIDO', 'CRITICO', 'ALERTA' ou 'NORMAL').
 */
export function obterCriticidadeValidade(
  diasParaVencimento: number,
): CriticidadeValidadeLote {
  if (diasParaVencimento < 0) return "VENCIDO";
  if (diasParaVencimento <= 15) return "CRITICO";
  if (diasParaVencimento <= 30) return "ALERTA";
  return "NORMAL";
}

const TERMOS_INDICE_TERAPEUTICO_ESTREITO = [
  "digoxina",
  "litio",
  "lítio",
  "carbonato de litio",
  "carbonato de lítio",
  "varfarina",
  "carbamazepina",
  "fenitoina",
  "fenitoína",
  "valproato",
  "acido valproico",
  "ácido valproico",
  "levotiroxina",
  "teofilina",
];

/**
 * [RF010]: Identifica se um medicamento possui Índice Terapêutico Estreito (ex.: Digoxina, Lítio, Varfarina, Carbamazepina).
 * @param medicamento - Objeto de medicamento ou texto do princípio ativo / nome comercial.
 * @returns Verdadeiro se requerer alerta clínico de Índice Terapêutico Estreito.
 */
export function ehMedicamentoIndiceTerapeuticoEstreito(
  medicamento: {
    principioAtivo?: string;
    nomeComercial?: string;
    indiceTerapeuticoEstreito?: boolean;
  },
): boolean {
  if (typeof medicamento.indiceTerapeuticoEstreito === "boolean") {
    return medicamento.indiceTerapeuticoEstreito;
  }
  const texto = `${medicamento.principioAtivo ?? ""} ${medicamento.nomeComercial ?? ""}`
    .toLowerCase()
    .trim();
  return TERMOS_INDICE_TERAPEUTICO_ESTREITO.some((termo) =>
    texto.includes(termo),
  );
}

