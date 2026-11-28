import {
  calcularTotaisCarrinho,
  validarReceitaAntimicrobiano,
  type LoteDisponivelDto,
  type MedicamentoBuscaDto,
  type ValidacaoReceitaAntimicrobianoResultado,
} from "@farmaubs/shared";

export const MENSAGEM_CARD_ANTIMICROBIANO =
  "Receita contém antimicrobianos. Validade legal da prescrição: 10 dias corridos.";
export const MENSAGEM_DATA_FUTURA =
  "❌ Data de emissão inválida: a receita médica não pode ter data futura.";

export type ItemCarrinho = {
  medicamento: MedicamentoBuscaDto;
  lote: LoteDisponivelDto;
  quantidade: number;
  posologia: string;
};

export type NovoItemCarrinho = {
  medicamento: MedicamentoBuscaDto;
  lote: LoteDisponivelDto;
  quantidade: number;
  posologia?: string;
};

/**
 * [DI-MOB-03]: O aviso vermelho usa o texto da história.
 * @param dias - Dias corridos desde a emissão.
 * @returns Frase do bloqueio sanitário.
 */
export function mensagemReceitaVencida(dias: number): string {
  return `❌ Receita médica vencida há ${dias} dias. Dispensação bloqueada pela legislação sanitária.`;
}

/** Data local do calendário, sem o deslocamento do UTC. */
export function isoDaDataLocal(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

export function contemAntimicrobiano(itens: ItemCarrinho[]): boolean {
  return itens.some((item) => item.medicamento.antimicrobiano || item.medicamento.requerDataReceita === true);
}

/**
 * [DI-MOB-03]: Inclui o item ou soma a quantidade se o mesmo lote já está no atendimento.
 * A soma não passa do saldo do lote.
 */
export function incluirNoCarrinho(itens: ItemCarrinho[], novo: NovoItemCarrinho): ItemCarrinho[] {
  const pedido = Math.max(1, novo.quantidade);
  const indice = itens.findIndex(
    (item) => item.medicamento.id === novo.medicamento.id && item.lote.id === novo.lote.id,
  );
  if (indice >= 0) {
    const copia = itens.slice();
    const atual = copia[indice];
    copia[indice] = {
      ...atual,
      quantidade: Math.min(atual.lote.saldoDisponivel, atual.quantidade + pedido),
      posologia: novo.posologia?.trim() ? novo.posologia.trim() : atual.posologia,
    };
    return copia;
  }
  return [
    ...itens,
    {
      medicamento: novo.medicamento,
      lote: novo.lote,
      quantidade: Math.min(novo.lote.saldoDisponivel, pedido),
      posologia: novo.posologia?.trim() ?? "",
    },
  ];
}

export function alterarQuantidade(itens: ItemCarrinho[], medicamentoId: string, loteId: string, quantidade: number): ItemCarrinho[] {
  return itens.map((item) => {
    if (item.medicamento.id !== medicamentoId || item.lote.id !== loteId) return item;
    const limitada = Math.max(1, Math.min(item.lote.saldoDisponivel, quantidade || 1));
    return { ...item, quantidade: limitada };
  });
}

export function alterarPosologia(itens: ItemCarrinho[], medicamentoId: string, loteId: string, posologia: string): ItemCarrinho[] {
  return itens.map((item) =>
    item.medicamento.id === medicamentoId && item.lote.id === loteId ? { ...item, posologia } : item,
  );
}

export function removerItem(itens: ItemCarrinho[], medicamentoId: string, loteId: string): ItemCarrinho[] {
  return itens.filter((item) => item.medicamento.id !== medicamentoId || item.lote.id !== loteId);
}

export function validarReceitaDoCarrinho(
  itens: ItemCarrinho[],
  dataIso: string,
  hoje: Date = new Date(),
): ValidacaoReceitaAntimicrobianoResultado {
  return validarReceitaAntimicrobiano(dataIso, contemAntimicrobiano(itens), hoje);
}

/**
 * [DI-MOB-03]: O avanço só libera com itens e receita válida quando há antimicrobiano.
 */
export function podeRevisarAtendimento(itens: ItemCarrinho[], dataIso: string, hoje: Date = new Date()): boolean {
  if (itens.length === 0) return false;
  if (itens.some((item) => item.quantidade < 1 || item.quantidade > item.lote.saldoDisponivel)) return false;
  return validarReceitaDoCarrinho(itens, dataIso, hoje).valida;
}

export function totaisDoCarrinho(itens: ItemCarrinho[]) {
  return calcularTotaisCarrinho(itens.map((item) => ({ quantidade: item.quantidade })));
}
