export interface MedicamentoBuscaDto {
  id: string;
  principioAtivo: string;
  nomeComercial?: string;
  apresentacao: string;
  categoria: string;
  antimicrobiano: boolean;
  requerDataReceita?: boolean;
  saldoTotalUbs: number;
}

export interface LoteDisponivelDto {
  id: string;
  numeroLote: string;
  dataValidade: string; // YYYY-MM-DD
  saldoDisponivel: number;
  sugeridoFefo: boolean;
  diasParaVencimento: number;
  alertaValidadeCurta: boolean;
  vencido: boolean;
}

export interface SugestaoFefoResultado {
  medicamento: MedicamentoBuscaDto;
  loteSugerido: LoteDisponivelDto | null;
  lotesDisponiveis: LoteDisponivelDto[];
}
