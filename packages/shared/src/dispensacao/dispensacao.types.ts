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

