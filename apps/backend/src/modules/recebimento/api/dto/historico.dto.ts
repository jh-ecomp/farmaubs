import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import type {
  FiltroHistoricoRecebimento,
  PeriodoPredefinido,
  SolicitacaoEstornoRecebimento,
} from "@farmaubs/shared";

export class ListarHistoricoRecebimentoQueryDto
  implements FiltroHistoricoRecebimento
{
  @ApiPropertyOptional({
    description: "UUID da UBS de filtro. Se omitido, usa as UBS vinculadas ao operador.",
    example: "0194e43e-a6fb-7389-9a74-94c039755ef5",
  })
  @IsOptional()
  @IsUUID("4")
  ubsId?: string;

  @ApiPropertyOptional({
    description: "Filtro predefinido de período",
    enum: ["HOJE", "ONTEM", "ULTIMOS_7_DIAS", "ULTIMOS_30_DIAS", "CUSTOMIZADO"],
    example: "ULTIMOS_7_DIAS",
  })
  @IsOptional()
  @IsEnum(["HOJE", "ONTEM", "ULTIMOS_7_DIAS", "ULTIMOS_30_DIAS", "CUSTOMIZADO"])
  periodo?: PeriodoPredefinido;

  @ApiPropertyOptional({
    description: "Data inicial no formato YYYY-MM-DD para período CUSTOMIZADO",
    example: "2026-10-01",
  })
  @IsOptional()
  @IsString()
  dataInicio?: string;

  @ApiPropertyOptional({
    description: "Data final no formato YYYY-MM-DD para período CUSTOMIZADO",
    example: "2026-10-21",
  })
  @IsOptional()
  @IsString()
  dataFim?: string;

  @ApiPropertyOptional({
    description: "Busca textual por número de nota fiscal, guia CAF, fornecedor ou lote",
    example: "CAF Central",
  })
  @IsOptional()
  @IsString()
  termoBusca?: string;

  @ApiPropertyOptional({
    description: "Status do documento de recebimento",
    enum: ["TODOS", "CONCLUIDO", "ESTORNADO"],
    example: "TODOS",
  })
  @IsOptional()
  @IsEnum(["TODOS", "CONCLUIDO", "ESTORNADO"])
  status?: "TODOS" | "CONCLUIDO" | "ESTORNADO";

  @ApiPropertyOptional({
    description: "Número da página (iniciando em 1)",
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number = 1;

  @ApiPropertyOptional({
    description: "Quantidade de itens por página",
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number = 20;
}

export class EstornarRecebimentoBodyDto
  implements SolicitacaoEstornoRecebimento
{
  @ApiProperty({
    description: "Justificativa obrigatória para o cancelamento/estorno da carga (RF028 / ADR-017)",
    example: "Lote registrado incorretamente com digitação trocada da quantidade de caixas.",
    minLength: 10,
    maxLength: 500,
  })
  @IsString({ message: "A justificativa de estorno é obrigatória." })
  @MinLength(10, {
    message: "A justificativa de estorno deve ter ao menos 10 caracteres.",
  })
  @MaxLength(500, {
    message: "A justificativa de estorno não pode exceder 500 caracteres.",
  })
  motivo: string;
}
