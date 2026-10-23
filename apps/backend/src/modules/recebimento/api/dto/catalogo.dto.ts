import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import type {
  CriarFabricanteRequest,
  FabricanteResponseDto,
  ProdutoCatalogoResponseDto,
} from "@farmaubs/shared";

/**
 * [RF008]: DTO de consulta para busca textual de medicamentos no catálogo.
 */
export class BuscaProdutoCatalogoQueryDto {
  @ApiProperty({
    description: "Termo de busca (nome comercial, princípio ativo ou apresentação)",
    example: "Amoxicilina",
    minLength: 2,
    maxLength: 100,
  })
  @IsString({ message: "O termo de busca deve ser uma string." })
  @MinLength(2, {
    message: "O termo de busca deve conter pelo menos 2 caracteres.",
  })
  @MaxLength(100, {
    message: "O termo de busca não pode exceder 100 caracteres.",
  })
  termo: string;
}

/**
 * [RF008]: DTO de criação para cadastro rápido de laboratório/fabricante.
 */
export class CriarFabricanteDto implements CriarFabricanteRequest {
  @ApiProperty({
    description: "Razão social oficial do fabricante/laboratório",
    example: "Eurofarma Laboratórios S.A.",
    minLength: 3,
    maxLength: 180,
  })
  @IsString({ message: "A razão social é obrigatória." })
  @MinLength(3, {
    message: "A razão social deve ter no mínimo 3 caracteres.",
  })
  @MaxLength(180, {
    message: "A razão social deve ter no máximo 180 caracteres.",
  })
  razaoSocial: string;

  @ApiProperty({
    description: "Nome fantasia ou marca comercial do laboratório",
    example: "Eurofarma",
    minLength: 2,
    maxLength: 120,
  })
  @IsString({ message: "O nome fantasia é obrigatório." })
  @MinLength(2, {
    message: "O nome fantasia deve ter no mínimo 2 caracteres.",
  })
  @MaxLength(120, {
    message: "O nome fantasia deve ter no máximo 120 caracteres.",
  })
  nomeFantasia: string;

  @ApiPropertyOptional({
    description: "CNPJ do fabricante com exatamente 14 dígitos numéricos",
    example: "61190096000192",
  })
  @IsOptional()
  @IsString({ message: "O CNPJ deve ser uma string numérica." })
  @Matches(/^\d{14}$/, {
    message: "O CNPJ deve conter exatamente 14 dígitos numéricos.",
  })
  cnpj?: string | null;
}

/**
 * [RF008]: Swagger response DTO para produto do catálogo.
 */
export class ProdutoCatalogoSwaggerResponse implements ProdutoCatalogoResponseDto {
  @ApiProperty({ example: "0194e43e-a6fb-7389-9a74-94c039755ef0" })
  id: string;

  @ApiPropertyOptional({ example: "267890", description: "Código CATMAT (Comprasnet / Ministério da Saúde)" })
  codigoCatmat?: string | null;

  @ApiPropertyOptional({ example: "J01CA04", description: "Código ATC da OMS" })
  codigoAtc?: string | null;

  @ApiPropertyOptional({ example: "Amoxil" })
  nomeComercial?: string | null;

  @ApiProperty({ example: "Amoxicilina" })
  principioAtivo: string;

  @ApiPropertyOptional({ example: "500mg" })
  dosagem?: string | null;

  @ApiPropertyOptional({ example: "Cápsula" })
  formaFarmaceutica?: string | null;

  @ApiPropertyOptional({ example: "Cápsula 500mg" })
  apresentacao?: string | null;

  @ApiPropertyOptional({ example: "comprimido" })
  unidadeMedida?: string | null;

  @ApiProperty({ example: "ANTIBIOTICOS" })
  categoria: string;

  @ApiPropertyOptional({ example: "BASICO", description: "Componente da Assistência Farmacêutica (BASICO, ESTRATEGICO, ESPECIALIZADO)" })
  componente?: string | null;

  @ApiProperty({ example: true, description: "Indicador de controle especial antimicrobiano (RDC 20/2011)" })
  antimicrobiano: boolean;

  @ApiPropertyOptional({ example: false, description: "Indicador de controle especial (Portaria 344/1998)" })
  controlado?: boolean;

  @ApiProperty({ example: true })
  ativo: boolean;
}

/**
 * [RF008]: Swagger response DTO para fabricante.
 */
export class FabricanteSwaggerResponse implements FabricanteResponseDto {
  @ApiProperty({ example: "0194e43e-a6fb-7389-9a74-94c039755ef1" })
  id: string;

  @ApiProperty({ example: "Eurofarma Laboratórios S.A." })
  razaoSocial: string;

  @ApiProperty({ example: "Eurofarma" })
  nomeFantasia: string;

  @ApiPropertyOptional({ example: "61190096000192" })
  cnpj?: string | null;

  @ApiProperty({ example: true })
  ativo: boolean;
}
