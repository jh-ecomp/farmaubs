import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { IsEmail, IsString, MinLength } from "class-validator";
import { LoginUseCase } from "../../domain/use-cases/login.use-case";

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  senha: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly loginUseCase: LoginUseCase) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const resultado = await this.loginUseCase.executar(
      dto.email,
      dto.senha,
      req.ip,
      req.headers["user-agent"],
    );

    if (!resultado.ok) {
      if (resultado.motivo === "CONTA_BLOQUEADA") {
        return res.status(429).json({
          message: `Conta bloqueada. Tente novamente em ${resultado.minutosRestantes} minuto(s).`,
          minutosRestantes: resultado.minutosRestantes,
        });
      }
      return res.status(401).json({
        message: "E-mail ou senha incorretos.",
      });
    }

    return res.status(200).json({
      token: resultado.token,
      usuarioId: resultado.usuarioId,
      redirectUrl: `/dashboard`,
    });
  }
}
