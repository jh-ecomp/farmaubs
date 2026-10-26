export interface ListarDispensacoesQuery {
  ubsId?: string;
  pagina?: number;
  limite?: number;
  dataInicio?: string; // YYYY-MM-DD (Default: ontem)
  dataFim?: string; // YYYY-MM-DD (Default: hoje)
  pacienteTermo?: string;
  medicamentoTermo?: string;
  categoria?: string;
  status?: "concluida" | "estornada";
}

export interface DispensacaoItemListaDto {
  id: string;
  numeroAtendimento: string;
  dataAtendimento: string | Date;
  status: "concluida" | "estornada";
  pacienteNome: string;
  pacienteCpf: string;
  pacienteCns: string;
  dispensadorNome: string;
  totalItens: number;
  medicamentosResumo: string; // Ex: "Dipirona 500mg (20), Paracetamol (10)"
}

export interface DispensacoesPaginadasResultado {
  itens: DispensacaoItemListaDto[];
  totalItens: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
  dataInicioEfetiva: string;
  dataFimEfetiva: string;
}

export interface EstornarDispensacaoRequest {
  ubsId?: string;
  motivoEstorno: string;
}

export interface LinhaExportacaoDispensacaoDto {
  dataHoraAtendimento: string;
  pacienteNome: string;
  pacienteCpfFormatado: string;
  pacienteCns: string;
  medicamentoApresentacao: string;
  categoria: string;
  numeroLote: string;
  dataValidadeLote: string;
  quantidadeDispensada: number;
  posologia: string;
  dispensadorNome: string;
  statusAtendimento: "concluida" | "estornada";
}

export interface EstornarDispensacaoResultado {
  id: string;
  status: "estornada";
  estornadoEm: string | Date;
  motivoEstorno: string;
  itensDevolvidos: {
    loteId: string;
    numeroLote: string;
    quantidadeRestituida: number;
    novoSaldoLote: number;
  }[];
}

