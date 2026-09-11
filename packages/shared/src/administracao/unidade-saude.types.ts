export interface UnidadeSaudeDto {
  id: string;
  municipioId: string;
  nome: string;
  endereco: string;
  responsavelTecnico?: string | null;
  cafLeadTimeDays: number;
}
