import type {
  CadastrarPacienteRequest,
  PacienteDto,
} from "@farmaubs/shared";

export interface ItemHistoricoRegistro {
  dispensacaoId: string;
  dataDispensacao: Date;
  medicamentoId: string;
  medicamentoNome: string;
  quantidadeDispensada: number;
  posologia?: string;
}

export interface PacienteRepositoryPort {
  buscarPorId(id: string): Promise<PacienteDto | null>;
  buscarPorCpfOuCns(cpf: string, cns: string): Promise<PacienteDto | null>;
  buscarPorTermo(termo: string, limite?: number): Promise<PacienteDto[]>;
  salvar(dados: CadastrarPacienteRequest & { municipioId: string }): Promise<PacienteDto>;
  buscarHistorico90Dias(pacienteId: string): Promise<ItemHistoricoRegistro[]>;
}

export const PACIENTE_REPOSITORY_PORT = Symbol("PACIENTE_REPOSITORY_PORT");

