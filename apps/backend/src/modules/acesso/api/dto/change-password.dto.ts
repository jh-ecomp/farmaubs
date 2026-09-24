import { IsString, MinLength, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import type { TrocarSenhaComando } from "@farmaubs/shared";

const SENHA_COMPLEXA_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,}$/;

export class ChangePasswordDto implements TrocarSenhaComando {
  @ApiProperty({ example: "NovaSenha@2026" })
  @IsString()
  @MinLength(8, { message: "A nova senha deve ter no mínimo 8 caracteres." })
  @Matches(SENHA_COMPLEXA_REGEX, {
    message:
      "A nova senha deve conter letras maiúsculas, minúsculas, números e caracteres especiais.",
  })
  novaSenha: string;

  @ApiProperty({ example: "NovaSenha@2026" })
  @IsString()
  confirmacaoSenha: string;
}
