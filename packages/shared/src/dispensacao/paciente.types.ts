export interface CadastrarPacienteRequest {
  cns: string;
  cpf: string;
  nomeCompleto: string;
  dataNascimento: string; // YYYY-MM-DD
}

export interface PacienteDto {
  id: string;
  municipioId: string;
  cns: string;
  cpf: string;
  nomeCompleto: string;
  dataNascimento: string;
  ativo: boolean;
  criadoEm: string | Date;
}

export interface ItemHistoricoConsumoDto {
  dispensacaoId: string;
  dataDispensacao: string | Date;
  medicamentoId: string;
  medicamentoNome: string;
  quantidadeDispensada: number;
  posologia?: string;
  diasDesdeUltimaRetirada: number;
  possivelUsoIrracional: boolean;
}

export interface HistoricoPacienteResultado {
  paciente: PacienteDto;
  itensConsumo: ItemHistoricoConsumoDto[];
}

