import { obterIntervaloOntemHoje, type DispensacaoItemListaDto, type DispensacoesPaginadasResultado, type ListarDispensacoesQuery } from "@farmaubs/shared";

export const DEBOUNCE_HISTORICO_MS = 300;
export const LIMITE_HISTORICO = 20;

export type PeriodoHistorico = "ONTEM_E_HOJE" | "HOJE" | "ULTIMOS_7_DIAS" | "ESTE_MES";

export const CHIPS_HISTORICO: { id: PeriodoHistorico; rotulo: string }[] = [
  { id: "ONTEM_E_HOJE", rotulo: "Ontem e Hoje" },
  { id: "HOJE", rotulo: "Hoje" },
  { id: "ULTIMOS_7_DIAS", rotulo: "Últimos 7 dias" },
  { id: "ESTE_MES", rotulo: "Este Mês" },
];

/**
 * [DI-MOB-05]: Intervalo dos chips. Usa o mesmo "hoje" UTC de obterIntervaloOntemHoje.
 */
export function intervaloDoPeriodo(
  periodo: PeriodoHistorico,
  hoje: Date = new Date(),
): { dataInicio: string; dataFim: string } {
  const padrao = obterIntervaloOntemHoje(hoje);
  if (periodo === "HOJE") return { dataInicio: padrao.dataFim, dataFim: padrao.dataFim };
  if (periodo === "ONTEM_E_HOJE") return padrao;
  const fim = new Date(`${padrao.dataFim}T00:00:00Z`);
  if (periodo === "ULTIMOS_7_DIAS") {
    fim.setUTCDate(fim.getUTCDate() - 6);
    return { dataInicio: fim.toISOString().slice(0, 10), dataFim: padrao.dataFim };
  }
  return { dataInicio: `${padrao.dataFim.slice(0, 8)}01`, dataFim: padrao.dataFim };
}

/**
 * [DI-MOB-05]: A API separa paciente e medicamento com E. Uma caixa só dispara as duas buscas.
 */
export function consultasDaBusca(base: ListarDispensacoesQuery, termo: string): ListarDispensacoesQuery[] {
  const texto = termo.trim();
  if (!texto) return [base];
  return [
    { ...base, pacienteTermo: texto, pagina: 1 },
    { ...base, medicamentoTermo: texto, pagina: 1 },
  ];
}

export function juntarItens(paginas: DispensacoesPaginadasResultado[]): DispensacaoItemListaDto[] {
  const vistos = new Set<string>();
  return paginas.flatMap((pagina) => pagina.itens).filter((item) => {
    if (vistos.has(item.id)) return false;
    vistos.add(item.id);
    return true;
  });
}

export function ultimosDigitosCpf(cpf: string): string {
  const digitos = cpf.replace(/\D/g, "");
  return digitos.slice(-4);
}

export function rotuloStatus(status: DispensacaoItemListaDto["status"]): string {
  return status === "estornada" ? "Estornada" : "Concluída";
}

function lerItem(item: unknown): DispensacaoItemListaDto | null {
  if (!item || typeof item !== "object") return null;
  const linha = item as Partial<DispensacaoItemListaDto>;
  if (typeof linha.id !== "string" || typeof linha.numeroAtendimento !== "string") return null;
  if (typeof linha.pacienteNome !== "string") return null;
  const quando = linha.dataAtendimento;
  return {
    id: linha.id,
    numeroAtendimento: linha.numeroAtendimento,
    dataAtendimento: quando instanceof Date || typeof quando === "string" ? quando : "",
    status: linha.status === "estornada" ? "estornada" : "concluida",
    pacienteNome: linha.pacienteNome,
    pacienteCpf: typeof linha.pacienteCpf === "string" ? linha.pacienteCpf : "",
    pacienteCns: typeof linha.pacienteCns === "string" ? linha.pacienteCns : "",
    dispensadorNome: typeof linha.dispensadorNome === "string" ? linha.dispensadorNome : "",
    totalItens: typeof linha.totalItens === "number" ? linha.totalItens : 0,
    medicamentosResumo: typeof linha.medicamentosResumo === "string" ? linha.medicamentosResumo : "",
  };
}

/**
 * [DI-MOB-05]: Lê o corpo de GET /dispensacoes.
 */
export function lerPagina(data: unknown): DispensacoesPaginadasResultado | null {
  if (!data || typeof data !== "object" || !("itens" in data)) return null;
  const corpo = data as Partial<DispensacoesPaginadasResultado>;
  if (!Array.isArray(corpo.itens)) return null;
  const itens = corpo.itens.flatMap((item) => {
    const linha = lerItem(item);
    return linha ? [linha] : [];
  });
  if (itens.length !== corpo.itens.length) return null;
  return {
    itens,
    totalItens: typeof corpo.totalItens === "number" ? corpo.totalItens : itens.length,
    pagina: typeof corpo.pagina === "number" ? corpo.pagina : 1,
    limite: typeof corpo.limite === "number" ? corpo.limite : itens.length,
    totalPaginas: typeof corpo.totalPaginas === "number" ? corpo.totalPaginas : 1,
    dataInicioEfetiva: typeof corpo.dataInicioEfetiva === "string" ? corpo.dataInicioEfetiva : "",
    dataFimEfetiva: typeof corpo.dataFimEfetiva === "string" ? corpo.dataFimEfetiva : "",
  };
}
