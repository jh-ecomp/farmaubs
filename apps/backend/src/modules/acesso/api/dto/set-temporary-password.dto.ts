import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import type { RedefinirSenhaProvisoriaComando } from "@farmaubs/shared";

export class RedefinirSenhaProvisoriaDto implements RedefinirSenhaProvisoriaComando {
  @ApiPropertyOptional({
    description:
      "Senha provisória atribuída ao usuário (mínimo 8 caracteres, maiúscula, minúscula, número e caractere especial). Se omitida, uma senha forte é gerada automaticamente.",
    example: "Provisoria#2026",
    format: "password",
  })
  @IsString()
  @IsOptional()
  senhaProvisoria?: string;
}

export type SetTemporaryPasswordDto = RedefinirSenhaProvisoriaDto;
