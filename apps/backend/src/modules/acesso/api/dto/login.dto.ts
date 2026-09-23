import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";
import type {
  LoginRequest,
  LoginResponse,
  UsuarioAutenticado,
  SessaoLoginInfo,
  ContaBloqueadaResponse,
  ErroCredenciaisResponse,
  PerfilCodigo,
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

export class UsuarioAutenticadoDto implements UsuarioAutenticado {
  @ApiProperty({ example: "01919a77-3e15-7000-8000-000000000020" })
  id: string;

  @ApiProperty({ example: "Carlos Eduardo da Silva" })
  nomeCompleto: string;

  @ApiProperty({ example: "carlos.silva@ubs.gov.br" })
  email: string;

  @ApiProperty({
    example: "ADMINISTRADOR",
    enum: [
      "ADMINISTRADOR",
      "GESTOR",
      "FARMACEUTICO_RESPONSAVEL",
      "FARMACEUTICO_RESIDENTE",
    ],
  })
  perfilCodigo: PerfilCodigo;

  @ApiProperty({ example: "01919a77-3e15-7000-8000-000000000001" })
  municipioId: string;

  @ApiProperty({
    example: ["01919a77-3e15-7000-8000-000000000010"],
    type: [String],
  })
  unidadeIds: string[];

  @ApiProperty({ example: false })
  deveTrocarSenha: boolean;
}

export class SessaoLoginInfoDto implements SessaoLoginInfo {
  @ApiProperty({ example: "2026-09-19T18:15:00.000Z" })
  expiresAt: string;

  @ApiProperty({ example: 3600 })
  ttlSeconds: number;

  @ApiProperty({ example: 300 })
  warningSeconds: number;
}

export class LoginResponseDto implements LoginResponse {
  @ApiProperty({ type: UsuarioAutenticadoDto })
  usuario: UsuarioAutenticadoDto;

  @ApiProperty({ type: SessaoLoginInfoDto })
  sessao: SessaoLoginInfoDto;

  @ApiProperty({
    example: "/dashboard",
    description:
      "Rota de redirecionamento pós-login (/trocar-senha se deveTrocarSenha for true)",
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
