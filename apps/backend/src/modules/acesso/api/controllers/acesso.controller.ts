import {
  Controller,
  Get,
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
  ApiBearerAuth,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import type {
  RenovarSessaoResponse,
  SessaoUsuarioResponse,
} from "@farmaubs/shared";
import { LoginUseCase } from "../../application/use-cases/login.use-case";
import { RenewSessionUseCase } from "../../application/use-cases/renew-session.use-case";
import { SkipAuth } from "../../../../common/guards/skip-auth.decorator";
import { SkipTransaction } from "../../../../common/transaction/skip-transaction.decorator";
import {
  LoginDto,
  LoginResponseDto,
  ContaBloqueadaDto,
  ErroCredenciaisDto,
} from "../dto/login.dto";

@ApiTags("Acesso")
@Controller("acesso")
export class AcessoController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly renewSessionUseCase: RenewSessionUseCase,
  ) {}

  @Post("login")
  @SkipAuth()
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

  @Post("renovar")
  @HttpCode(HttpStatus.OK)
  @SkipTransaction()
  @ApiOperation({
    summary: "Renova a sessão ativa do usuário (sliding expiration)",
  })
  @ApiBearerAuth("access-token")
  @ApiResponse({
    status: 200,
    description: "Sessão renovada com sucesso.",
  })
  @ApiResponse({
    status: 401,
    description: "Não autorizado — sessão ausente, inválida ou expirada.",
  })
  async renovar(@Req() req: Request): Promise<RenovarSessaoResponse> {
    const sessao = (req as any).sessao ?? (req as any).session;
    return this.renewSessionUseCase.executar(sessao.id);
  }

  @Get("me")
  @HttpCode(HttpStatus.OK)
  @SkipTransaction()
  @ApiOperation({
    summary: "Retorna os dados da sessão do usuário autenticado",
  })
  @ApiBearerAuth("access-token")
  @ApiResponse({
    status: 200,
    description: "Dados da sessão autenticada.",
  })
  @ApiResponse({
    status: 401,
    description: "Não autorizado — sessão ausente, inválida ou expirada.",
  })
  me(@Req() req: Request): SessaoUsuarioResponse {
    const sessao = (req as any).sessao ?? (req as any).session;
    return {
      usuarioId: sessao.usuarioId,
      municipioId: sessao.municipioId,
      perfilId: sessao.perfilId,
      unidadeIds: sessao.unidadeIds ?? [],
      expiresAt:
        sessao.expiraEm instanceof Date
          ? sessao.expiraEm.toISOString()
          : new Date(sessao.expiraEm).toISOString(),
    };
  }
}
