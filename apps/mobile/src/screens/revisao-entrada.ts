import type {
  CabecalhoRecebimentoDto,
  CriarEntradaEstoqueRequest,
  ItemRecebimentoFormDto,
} from "@farmaubs/shared";

export interface ReciboEntrada {
  id: string;
  numeroDocumento: string;
  fornecedorOrigem: string;
  avisos: string[];
}

export const MENSAGEM_VALIDADE_CURTA_CONFIRMACAO =
  "⚠️ Constatado lote com validade inferior a 6 meses. Confirma o recebimento sob compromisso de giro prioritário?";

export interface TotaisCarga {
  medicamentos: number;
  unidades: number;
}

/** [RE-MOB-03]: medicamentos distintos pelo produto e soma das unidades. */
export function totaisDaCarga(itens: ItemRecebimentoFormDto[]): TotaisCarga {
  return {
    medicamentos: new Set(itens.map((item) => item.produtoId)).size,
    unidades: itens.reduce((soma, item) => soma + item.quantidadeRecebida, 0),
  };
}

export function temValidadeCurta(itens: ItemRecebimentoFormDto[]): boolean {
  return itens.some((item) => item.validadeCurta);
}

/** Quantidade menor que 1 não altera a linha. A exclusão é outra ação. */
export function alterarQuantidade(
  itens: ItemRecebimentoFormDto[],
  idProvisorio: string,
  quantidade: number,
): ItemRecebimentoFormDto[] {
  const qtd = Math.floor(quantidade);
  if (!Number.isInteger(qtd) || qtd < 1) return itens;
  return itens.map((item) =>
    item.idProvisorio === idProvisorio ? { ...item, quantidadeRecebida: qtd } : item,
  );
}

export function montarEntrada(
  cabecalho: CabecalhoRecebimentoDto,
  itens: ItemRecebimentoFormDto[],
): CriarEntradaEstoqueRequest {
  const observacoes = cabecalho.observacoes?.trim();
  // shortcut: sem ubsId a API usa a primeira UBS do login, quando o backend aceitar UUID v7
  return {
    numeroDocumento: cabecalho.numeroDocumento.trim(),
    tipoDocumento: cabecalho.tipoDocumento,
    fornecedorOrigem: cabecalho.fornecedorOrigem,
    dataRecebimento: cabecalho.dataRecebimento,
    ...(observacoes ? { observacoes } : {}),
    itens: itens.map((item) => ({
      produtoId: item.produtoId,
      fabricanteId: item.fabricanteId,
      numeroLote: item.numeroLote,
      dataValidade: item.dataValidade,
      quantidadeRecebida: item.quantidadeRecebida,
    })),
  };
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor : null;
}

/** [RE-MOB-03]: o backend devolve o id do registro e o número da guia, não um protocolo #REC-. */
export function lerEntrada(data: unknown): ReciboEntrada | null {
  if (!data || typeof data !== "object") return null;
  const corpo = data as {
    id?: unknown;
    numeroDocumento?: unknown;
    fornecedorOrigem?: unknown;
    itens?: unknown;
    avisos?: unknown;
  };
  const id = texto(corpo.id);
  const numeroDocumento = texto(corpo.numeroDocumento);
  if (!id || !numeroDocumento || !Array.isArray(corpo.itens)) return null;
  const avisos = Array.isArray(corpo.avisos)
    ? corpo.avisos.flatMap((aviso) => {
        if (!aviso || typeof aviso !== "object" || !("mensagem" in aviso)) return [];
        const mensagem = texto((aviso as { mensagem?: unknown }).mensagem);
        return mensagem ? [mensagem] : [];
      })
    : [];
  return {
    id,
    numeroDocumento,
    fornecedorOrigem: texto(corpo.fornecedorOrigem) ?? "",
    avisos,
  };
}
