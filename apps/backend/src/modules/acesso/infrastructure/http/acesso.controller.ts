import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { LoginUseCase } from "../../domain/use-cases/login.use-case";
import {
  LoginDto,
  LoginResponseDto,
  ContaBloqueadaDto,
  ErroCredenciaisDto,
} from "./dto/login.dto";

@ApiTags("Acesso")
@Controller("acesso")
export class AcessoController {
  constructor(private readonly loginUseCase: LoginUseCase) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Realiza o login de acesso do usuário" })
  @ApiHeader({
    name: "Authorization",
    description:
      "Bearer token de sessão retornado para autenticação nas próximas requisições (presente apenas em respostas 200)",
    required: false,
    schema: { type: "string", example: "Bearer 4f2a89c1..." },
  })
  @ApiResponse({
    status: 200,
    description:
      "Login efetuado com sucesso. O token de autenticação é retornado no cabeçalho Authorization.",
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "E-mail ou senha incorretos.",
    type: ErroCredenciaisDto,
  })
  @ApiResponse({
    status: 429,
    description: "Conta temporariamente bloqueada por muitas tentativas.",
    type: ContaBloqueadaDto,
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto | ContaBloqueadaDto | ErroCredenciaisDto> {
    const resultado = await this.loginUseCase.executar(
      dto.email,
      dto.senha,
      req.ip,
      req.headers["user-agent"],
    );

    if (!resultado.ok) {
      if (resultado.motivo === "CONTA_BLOQUEADA") {
        res.status(HttpStatus.TOO_MANY_REQUESTS);
        return {
          message: `Conta bloqueada. Tente novamente em ${resultado.minutosRestantes} minuto(s).`,
          minutosRestantes: resultado.minutosRestantes,
        };
      }
      res.status(HttpStatus.UNAUTHORIZED);
      return { message: "E-mail ou senha incorretos." };
    }

    res.setHeader("Authorization", `Bearer ${resultado.token}`);

    return {
      usuarioId: resultado.usuarioId,
      redirectUrl: "/dashboard",
    };
  }
}
