import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString } from "class-validator";
import type { EditarUsuarioComando } from "@farmaubs/shared";

export class EditarUsuarioDto implements EditarUsuarioComando {
  @ApiPropertyOptional({
    description: "Nome completo atualizado do usuário",
    example: "Carlos Eduardo da Silva",
  })
  @IsString()
  @IsOptional()
  nomeCompleto?: string;

  @ApiPropertyOptional({
    description: "E-mail corporativo ou institucional atualizado do usuário",
    example: "carlos.silva@ubs.gov.br",
  })
  @IsEmail()
  @IsOptional()
  email?: string;
}

export type EditUserDto = EditarUsuarioDto;
