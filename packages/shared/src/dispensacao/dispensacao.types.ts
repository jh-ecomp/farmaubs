export interface ItemDispensacaoRequest {
  medicamentoId: string;
  loteId: string;
  quantidadeDispensada: number;
  posologia?: string;
}

export interface PacienteDispensacaoRequest {
  id?: string;
  cns: string;
  cpf: string;
  nomeCompleto: string;
  dataNascimento: string; // YYYY-MM-DD
}

export interface EfetivarDispensacaoRequest {
  ubsId?: string;
  paciente: PacienteDispensacaoRequest;
  receitaEmissaoEm?: string; // Obrigatório se houver antimicrobiano (YYYY-MM-DD)
  itens: ItemDispensacaoRequest[];
}

export interface ItemDispensadoResultadoDto {
  itemId: string;
  medicamentoId: string;
  medicamentoNome: string;
  loteId: string;
  numeroLote: string;
  quantidadeDispensada: number;
  saldoRestanteLote: number;
}

export interface DispensacaoEfetivadaResultado {
  id: string;
  numeroAtendimento: string;
  dataAtendimento: string | Date;
  status: "concluida" | "estornada";
  paciente: {
    id: string;
    nomeCompleto: string;
    cpf: string;
    cns: string;
  };
  dispensador: {
    id: string;
    nomeCompleto: string;
  };
  itens: ItemDispensadoResultadoDto[];
}

export interface TotaisCarrinhoDispensacao {
  totalItens: number;
  totalUnidades: number;
}

/**
 * [RF010]: Calcula o total de medicamentos distintos e a soma de unidades físicas no carrinho.
 * @param itens - Lista de itens do carrinho de dispensação.
 * @returns Objeto com totalItens e totalUnidades.
 */
export function calcularTotaisCarrinho(
  itens: Array<{ quantidadeDispensada?: number; quantidade?: number }>,
): TotaisCarrinhoDispensacao {
  const totalItens = itens.length;
  const totalUnidades = itens.reduce((acc, item) => {
    const qtd = item.quantidadeDispensada ?? item.quantidade ?? 0;
    return acc + (Number.isFinite(qtd) && qtd > 0 ? qtd : 0);
  }, 0);
  return { totalItens, totalUnidades };
}

