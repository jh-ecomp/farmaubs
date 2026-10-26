import type {
  DispensacaoEfetivadaResultado,
  PacienteDispensacaoRequest,
} from "@farmaubs/shared";

export interface LoteBloqueadoDispensacao {
  id: string;
  numeroLote: string;
  unidadeId: string;
  medicamentoId: string;
  medicamentoNome: string;
  antimicrobiano: boolean;
  saldoAtual: number;
  dataValidade: string;
}

export interface ItemPersistirDispensacao {
  medicamentoId: string;
  medicamentoNome: string;
  loteId: string;
  numeroLote: string;
  quantidadeDispensada: number;
  posologia?: string;
  saldoAnteriorLote?: number;
  saldoRestanteLote: number;
}

export interface RegistrarDispensacaoAtomicaParams {
  municipioId: string;
  unidadeId: string;
  dispensadorId: string;
  dispensadorNome?: string;
  paciente: {
    id: string;
    nomeCompleto: string;
    cpf: string;
    cns: string;
  };
  receitaEmissaoEm?: string;
  itens: ItemPersistirDispensacao[];
}

export interface DispensacaoRepositoryPort {
  obterOuCriarPaciente(
    paciente: PacienteDispensacaoRequest,
    municipioId: string,
  ): Promise<{
    id: string;
    nomeCompleto: string;
    cpf: string;
    cns: string;
  }>;
  bloquearLoteParaUpdate(loteId: string): Promise<LoteBloqueadoDispensacao | null>;
  decrementarSaldoLote(loteId: string, quantidade: number): Promise<number>;
  registrarDispensacaoAtomica(
    dados: RegistrarDispensacaoAtomicaParams,
  ): Promise<DispensacaoEfetivadaResultado>;
}

export const DISPENSACAO_REPOSITORY_PORT = Symbol("DISPENSACAO_REPOSITORY_PORT");

