import { ForbiddenException } from "@nestjs/common";
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
  PerfilCodigo,
  type AuthenticatedUserPayload,
  type TipoRelatorioEstoque,
} from "@farmaubs/shared";

const REGEX_DATA_YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * [RF020 / RF028 / NF003 / NF015]: Query params do endpoint GET /api/v1/estoque/relatorios/exportar-xlsx.
 */
export class ExportarRelatorioEstoqueQueryDto {
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
      "Filtro opcional por princípio ativo (busca parcial case-insensitive).",
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

  @ApiPropertyOptional({
    format: "uuid",
    description:
      "UBS consultada. Com RLS, o ubsId deve vir do usuário autenticado. Se informado na query, deve ser igual ao da sessão.",
  })
  @IsOptional()
  @IsUUID()
  unidadeId?: string;
}

/**
 * Valida o campo unidadeId da query contra a sessão do usuário autenticado (NF015 / ADR-016).
 * Com RLS, o ubsId padrão vem da sessão. Se o campo for informado na query,
 * valida que pertence às unidades da sessão (ou é administrador), rejeitando com 403 caso contrário.
 *
 * @param user - Usuário autenticado da requisição.
 * @param unidadeIdQuery - Parâmetro opcional unidadeId enviado na query.
 * @returns UUID da UBS a ser consultada.
 * @throws {ForbiddenException} Se a UBS informada na query não pertencer à sessão do usuário (HTTP 403).
 */
export function validarEObterUbsIdRelatorio(
  user?: AuthenticatedUserPayload,
  unidadeIdQuery?: string,
): string {
  const unidadesPermitidas = user?.unidadeIds ?? [];

  if (unidadeIdQuery) {
    const isAdmin = user?.perfilCodigo === PerfilCodigo.ADMINISTRADOR;
    if (!isAdmin && !unidadesPermitidas.includes(unidadeIdQuery)) {
      throw new ForbiddenException(
        "Acesso negado: a unidade informada não pertence às unidades atribuídas ao usuário.",
      );
    }
    return unidadeIdQuery;
  }

  const ubsPadrao = unidadesPermitidas[0];
  if (!ubsPadrao) {
    throw new ForbiddenException(
      "Acesso negado: nenhuma unidade de saúde vinculada à sessão do usuário.",
    );
  }
  return ubsPadrao;
}
