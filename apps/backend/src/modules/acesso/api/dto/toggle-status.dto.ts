import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty } from "class-validator";
import type { AlterarStatusUsuarioComando } from "@farmaubs/shared";

export class AlterarStatusUsuarioDto implements AlterarStatusUsuarioComando {
  @ApiProperty({
    description: "Novo status do usuário: true para ativo, false para inativo",
    example: false,
  })
  @IsBoolean()
  @IsNotEmpty()
  ativo!: boolean;
}

export type ToggleUserStatusDto = AlterarStatusUsuarioDto;
