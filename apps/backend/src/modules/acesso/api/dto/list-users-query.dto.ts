import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type, Transform } from "class-transformer";
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";
import type { ListagemUsuariosFiltros } from "@farmaubs/shared";

export class ListUsersQueryDto implements ListagemUsuariosFiltros {
  @ApiPropertyOptional({
    description: "Número da página (iniciando em 1)",
    example: 1,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "O parâmetro page deve ser um número inteiro" })
  @Min(1, { message: "O parâmetro page deve ser no mínimo 1" })
  page?: number = 1;

  @ApiPropertyOptional({
    description: "Quantidade de registros por página (máximo 100)",
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "O parâmetro limit deve ser um número inteiro" })
  @Min(1, { message: "O parâmetro limit deve ser no mínimo 1" })
  @Max(100, { message: "O parâmetro limit não pode exceder 100" })
  limit?: number = 10;

  @ApiPropertyOptional({
    description: "Busca parcial por nome completo ou e-mail (case-insensitive)",
    example: "carlos",
  })
  @IsOptional()
  @IsString({ message: "O parâmetro busca deve ser uma string" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  busca?: string;

  @ApiPropertyOptional({
    description: "Identificador (UUID) ou código do perfil de acesso",
    example: "ADMINISTRADOR",
  })
  @IsOptional()
  @IsString({ message: "O parâmetro perfilId deve ser uma string" })
  perfilId?: string;

  @ApiPropertyOptional({
    description: "Identificador (UUID) do município para restrição de escopo",
    example: "01919a77-3e15-7000-8000-000000000001",
  })
  @IsOptional()
  @IsUUID(undefined, {
    message: "O parâmetro municipioId deve ser um UUID válido",
  })
  municipioId?: string;

  @ApiPropertyOptional({
    description:
      "Filtro por status de ativação do usuário (ATIVO, INATIVO, ALL)",
    example: "ATIVO",
  })
  @IsOptional()
  @IsString({ message: "O parâmetro status deve ser uma string" })
  status?: string;
}

export type ListarUsuariosQueryDto = ListUsersQueryDto;
