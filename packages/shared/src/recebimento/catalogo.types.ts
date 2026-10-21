/**
 * [RF008]: Tipos e contratos de dados para o catálogo de medicamentos e fabricantes.
 */

export interface ProdutoCatalogoResponseDto {
  id: string;
  nomeComercial?: string | null;
  principioAtivo: string;
  dosagem?: string | null;
  formaFarmaceutica?: string | null;
  apresentacao?: string | null;
  unidadeMedida?: string | null;
  categoria: string;
  antimicrobiano: boolean;
  ativo: boolean;
}

export interface FabricanteResponseDto {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj?: string | null;
  ativo: boolean;
}

export interface CriarFabricanteRequest {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj?: string | null;
}
