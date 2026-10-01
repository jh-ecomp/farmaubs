export enum PerfilCodigo {
  ADMINISTRADOR = "ADMINISTRADOR",
  GERENTE = "GERENTE",
  GESTOR = "GERENTE",
  FARMACEUTICO_RESPONSAVEL = "FARMACEUTICO_RESPONSAVEL",
  FARMACEUTICO_RESIDENTE = "FARMACEUTICO_RESIDENTE",
}

export interface PerfilDto {
  id: string;
  codigo: PerfilCodigo;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
}
