import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";
import {
  FILTROS_TIPO_RELATORIO_ESTOQUE,
  type ExportarRelatorioEstoqueQueryDto as ExportarRelatorioEstoqueQueryContract,
  type TipoRelatorioEstoque,
} from "@farmaubs/shared";

const REGEX_DATA_YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * [RF020 / RF028 / NF003 / NF015]: Query params do endpoint GET /api/v1/estoque/relatorios/exportar-xlsx.
 * O escopo de acesso da `unidadeId` é validado declarativamente pelo `TenantScopeGuard` (`checkUbs: true`) e pelo RLS.
 */
export class ExportarRelatorioEstoqueQueryDto
  implements ExportarRelatorioEstoqueQueryContract
{
  @ApiProperty({
    format: "uuid",
    description: "UBS consultada (deve pertencer ao escopo do usuário).",
  })
  @IsUUID()
  unidadeId!: string;

  @ApiProperty({
    enum: FILTROS_TIPO_RELATORIO_ESTOQUE,
    description: "Tipo de relatório de estoque a ser exportado em planilha.",
    example: "SALDOS_ATUAIS",
  })
  @IsIn(FILTROS_TIPO_RELATORIO_ESTOQUE)
  tipoRelatorio!: TipoRelatorioEstoque;

  @ApiPropertyOptional({
    description: "Data inicial no formato YYYY-MM-DD (ISO).",
    example: "2026-10-01",
  })
  @IsOptional()
  @Matches(REGEX_DATA_YMD, {
    message: "dataInicio deve estar no formato YYYY-MM-DD.",
  })
  dataInicio?: string;

  @ApiPropertyOptional({
    description: "Data final no formato YYYY-MM-DD (ISO).",
    example: "2026-10-31",
  })
  @IsOptional()
  @Matches(REGEX_DATA_YMD, {
    message: "dataFim deve estar no formato YYYY-MM-DD.",
  })
  dataFim?: string;

  @ApiPropertyOptional({
    description:
      "Filtro opcional por princípio ativo (busca parcial sem acentos e case-insensitive).",
    example: "Amoxicilina",
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  principioAtivo?: string;

  @ApiPropertyOptional({
    format: "uuid",
    description: "Filtro opcional por ID do medicamento/produto.",
  })
  @IsOptional()
  @IsUUID()
  produtoId?: string;

  @ApiPropertyOptional({
    description: "Categoria clínica do medicamento.",
    example: "ANTIBIOTICO",
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  categoria?: string;
}
