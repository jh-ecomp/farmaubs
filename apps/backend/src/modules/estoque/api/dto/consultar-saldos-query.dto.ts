import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import {
  FILTROS_STATUS_ESTOQUE,
  FILTROS_VALIDADE_SALDOS,
  type FiltroStatusEstoque,
  type FiltroValidadeSaldos,
} from "@farmaubs/shared";

export class ConsultarSaldosQueryDto {
  @ApiProperty({
    format: "uuid",
    description: "UBS consultada (deve estar no escopo do usuário).",
  })
  @IsUUID()
  unidadeId!: string;

  @ApiPropertyOptional({
    description:
      "Busca parcial, sem acentos e sem diferenciar maiúsculas, em nome, princípio ativo, apresentação ou número do lote.",
    example: "amoxicilina",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  termo?: string;

  @ApiPropertyOptional({ description: "Categoria clínica do medicamento.", example: "ANTIBIOTICO" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  categoria?: string;

  @ApiPropertyOptional({ enum: FILTROS_VALIDADE_SALDOS, default: "TODOS" })
  @IsOptional()
  @IsIn(FILTROS_VALIDADE_SALDOS)
  filtroValidade?: FiltroValidadeSaldos;

  @ApiPropertyOptional({ enum: FILTROS_STATUS_ESTOQUE, default: "TODOS" })
  @IsOptional()
  @IsIn(FILTROS_STATUS_ESTOQUE)
  statusEstoque?: FiltroStatusEstoque;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  itensPorPagina?: number;
}
