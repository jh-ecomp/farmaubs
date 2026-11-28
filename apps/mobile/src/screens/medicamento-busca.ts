import {
  formatarDataIsoParaBr,
  type LoteDisponivelDto,
  type MedicamentoBuscaDto,
  type SugestaoFefoResultado,
} from "@farmaubs/shared";

export const DEBOUNCE_BUSCA_MEDICAMENTO_MS = 250;
export const MENSAGEM_INDICE_ESTREITO =
  "Atenção: Medicamento de Índice Terapêutico Estreito — oriente a posologia e confirme a dosagem com o paciente antes da entrega.";

/**
 * [DI-MOB-02]: A busca só sai depois de duas letras, como na web.
 * @param termo - Texto do campo.
 * @returns True quando o debounce pode consultar a API.
 */
export function termoDeveBuscar(termo: string): boolean {
  return termo.trim().length >= 2;
}

/**
 * [DI-MOB-02]: Quantidade acima do saldo do lote bloqueia o avanço.
 * @param quantidade - Unidades pedidas.
 * @param saldo - Saldo do lote selecionado.
 * @returns True quando a quantidade não cabe no lote.
 */
export function quantidadeExcedeSaldo(quantidade: number, saldo: number): boolean {
  return !Number.isFinite(quantidade) || quantidade < 1 || quantidade > saldo;
}

/**
 * [DI-MOB-02]: O mesmo aviso da tela web.
 * @param saldo - Máximo do lote.
 * @returns Frase exibida em vermelho.
 */
export function mensagemSaldoInsuficiente(saldo: number): string {
  return `Saldo insuficiente no lote selecionado (máximo disponível: ${saldo} un.).`;
}

/**
 * [DI-MOB-02]: Lote sem saldo ou vencido não recebe toque.
 * @param lote - Lote devolvido pela API.
 * @returns True quando a linha fica acinzentada.
 */
export function loteBloqueado(lote: Pick<LoteDisponivelDto, "saldoDisponivel" | "vencido">): boolean {
  return lote.vencido || lote.saldoDisponivel <= 0;
}

/**
 * [DI-MOB-02]: Texto do selo verde pedido na história.
 * @param lote - Lote marcado como sugestão FEFO.
 * @returns Frase do badge.
 */
export function textoBadgeFefo(lote: Pick<LoteDisponivelDto, "numeroLote" | "dataValidade" | "saldoDisponivel">): string {
  return `[Sugerido pelo Sistema (FEFO)] Lote: ${lote.numeroLote} | Vence: ${formatarDataIsoParaBr(lote.dataValidade)} | Saldo: ${lote.saldoDisponivel} un.`;
}

/**
 * [DI-MOB-02]: Lê o array de GET /dispensacao/medicamentos.
 * @param data - Corpo já interpretado.
 * @returns Medicamentos utilizáveis.
 */
export function lerListaMedicamentos(data: unknown): MedicamentoBuscaDto[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    const medicamento = lerMedicamento(item);
    return medicamento ? [medicamento] : [];
  });
}

/**
 * [DI-MOB-02]: Lê GET /dispensacao/medicamentos/:id/lotes-fefo.
 * @param data - Corpo já interpretado.
 * @returns Sugestão e lotes, ou null se o corpo não tiver o medicamento.
 */
export function lerSugestaoFefo(data: unknown): SugestaoFefoResultado | null {
  if (!data || typeof data !== "object") return null;
  const corpo = data as Partial<SugestaoFefoResultado>;
  const medicamento = lerMedicamento(corpo.medicamento);
  if (!medicamento) return null;
  const lotesDisponiveis = Array.isArray(corpo.lotesDisponiveis)
    ? corpo.lotesDisponiveis.flatMap((item) => {
        const lote = lerLote(item);
        return lote ? [lote] : [];
      })
    : [];
  const sugerido = lerLote(corpo.loteSugerido);
  return {
    medicamento,
    loteSugerido: sugerido,
    lotesDisponiveis,
  };
}

function lerMedicamento(item: unknown): MedicamentoBuscaDto | null {
  if (!item || typeof item !== "object") return null;
  const medicamento = item as Partial<MedicamentoBuscaDto>;
  if (typeof medicamento.id !== "string" || !medicamento.id) return null;
  if (typeof medicamento.principioAtivo !== "string" || !medicamento.principioAtivo) return null;
  if (typeof medicamento.apresentacao !== "string") return null;
  if (typeof medicamento.antimicrobiano !== "boolean") return null;
  if (typeof medicamento.saldoTotalUbs !== "number") return null;
  return {
    id: medicamento.id,
    principioAtivo: medicamento.principioAtivo,
    nomeComercial: typeof medicamento.nomeComercial === "string" ? medicamento.nomeComercial : undefined,
    apresentacao: medicamento.apresentacao,
    categoria: typeof medicamento.categoria === "string" ? medicamento.categoria : "",
    antimicrobiano: medicamento.antimicrobiano,
    indiceTerapeuticoEstreito:
      typeof medicamento.indiceTerapeuticoEstreito === "boolean" ? medicamento.indiceTerapeuticoEstreito : undefined,
    saldoTotalUbs: medicamento.saldoTotalUbs,
  };
}

function lerLote(item: unknown): LoteDisponivelDto | null {
  if (!item || typeof item !== "object") return null;
  const lote = item as Partial<LoteDisponivelDto>;
  if (typeof lote.id !== "string" || typeof lote.numeroLote !== "string") return null;
  if (typeof lote.dataValidade !== "string") return null;
  if (typeof lote.saldoDisponivel !== "number" || typeof lote.diasParaVencimento !== "number") return null;
  return {
    id: lote.id,
    numeroLote: lote.numeroLote,
    dataValidade: lote.dataValidade,
    saldoDisponivel: lote.saldoDisponivel,
    sugeridoFefo: lote.sugeridoFefo === true,
    diasParaVencimento: lote.diasParaVencimento,
    alertaValidadeCurta: lote.alertaValidadeCurta === true,
    vencido: lote.vencido === true,
  };
}
