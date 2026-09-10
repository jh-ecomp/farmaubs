import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";
import type {
  LoginRequest,
  LoginResponse,
  ContaBloqueadaResponse,
  ErroCredenciaisResponse,
} from "@farmaubs/shared";

export class LoginDto implements LoginRequest {
  @ApiProperty({
    example: "usuario@farmaubs.com.br",
    description: "E-mail cadastrado do usuário",
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: "SenhaSegura123!",
    description: "Senha de acesso do usuário",
  })
  @IsString()
  @MinLength(1)
  senha: string;
}

export class LoginResponseDto implements LoginResponse {
  @ApiProperty({
    example: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    description: "ID único do usuário autenticado",
  })
  usuarioId: string;

  @ApiProperty({
    example: "/dashboard",
    description: "Rota de redirecionamento pós-login",
  })
  redirectUrl: string;
}

export class ContaBloqueadaDto implements ContaBloqueadaResponse {
  @ApiProperty({
    example: "Conta bloqueada. Tente novamente em 14 minuto(s).",
    description: "Mensagem explicativa do bloqueio",
  })
  message: string;

  @ApiProperty({
    example: 14,
    description: "Minutos restantes até o desbloqueio automático",
  })
  minutosRestantes: number;
}

export class ErroCredenciaisDto implements ErroCredenciaisResponse {
  @ApiProperty({
    example: "E-mail ou senha incorretos.",
    description: "Mensagem genérica de credenciais inválidas",
  })
  message: string;
}
