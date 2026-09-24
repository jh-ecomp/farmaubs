import {
  Controller,
  Get,
  Post,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
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
  TrocarSenhaResultado,
} from "@farmaubs/shared";
import { LoginUseCase } from "../../application/use-cases/login.use-case";
import { RenewSessionUseCase } from "../../application/use-cases/renew-session.use-case";
import { LogoutUseCase } from "../../application/use-cases/logout.use-case";
import { ChangePasswordUseCase } from "../../application/use-cases/change-password.use-case";
import { SkipAuth } from "../../../../common/guards/skip-auth.decorator";
import { SkipTransaction } from "../../../../common/transaction/skip-transaction.decorator";
import {
  LoginDto,
  LoginResponseDto,
  ContaBloqueadaDto,
  ErroCredenciaisDto,
} from "../dto/login.dto";
import { ChangePasswordDto } from "../dto/change-password.dto";
import { PermitirSenhaProvisoriaRoute } from "../guards/must-change-password.guard";
import {
  ConfirmacaoSenhaDivergenteException,
  NovaSenhaNaoPodeSerIgualProvisoriaException,
  SenhaFracaException,
} from "../../domain/errors/password.errors";

@ApiTags("Acesso")
@Controller("acesso")
export class AcessoController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly renewSessionUseCase: RenewSessionUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
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
      usuario: resultado.usuario,
      sessao: {
        expiresAt: resultado.sessao.expiresAt.toISOString(),
        ttlSeconds: resultado.sessao.ttlSeconds,
        warningSeconds: resultado.sessao.warningSeconds,
      },
      redirectUrl: resultado.redirectUrl,
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
  @PermitirSenhaProvisoriaRoute()
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
      perfilCodigo: sessao.perfilCodigo,
      unidadeIds: sessao.unidadeIds ?? [],
      nomeCompleto: sessao.nomeCompleto,
      email: sessao.email,
      deveTrocarSenha: sessao.deveTrocarSenha,
      expiresAt:
        sessao.expiraEm instanceof Date
          ? sessao.expiraEm.toISOString()
          : new Date(sessao.expiraEm).toISOString(),
    };
  }

  /**
   * [RF004 / Logout]: Encerra a sessão ativa do usuário invalidando o token no servidor.
   * Permite sessões provisórias para permitir abandono/saída graciosa do fluxo (AC-23 Regra 3).
   * @param req - Objeto de requisição HTTP contendo o cabeçalho Authorization Bearer.
   * @returns Resposta HTTP 204 No Content sem corpo.
   * @throws {UnauthorizedException} Caso o cabeçalho Authorization seja ausente ou inválido.
   */
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @SkipAuth()
  @SkipTransaction()
  @PermitirSenhaProvisoriaRoute()
  @ApiOperation({
    summary: "Encerra a sessão ativa do usuário (logout com revogação no servidor)",
  })
  @ApiBearerAuth("access-token")
  @ApiResponse({
    status: 204,
    description: "Sessão revogada com sucesso (ou já inexistente — idempotência).",
  })
  @ApiResponse({
    status: 401,
    description: "Não autorizado — cabeçalho Authorization ausente ou formato inválido.",
  })
  async logout(@Req() req: Request): Promise<void> {
    const authHeader = req.headers["authorization"];
    if (
      !authHeader ||
      typeof authHeader !== "string" ||
      !authHeader.startsWith("Bearer ")
    ) {
      throw new UnauthorizedException("Token de autenticação ausente ou inválido");
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      throw new UnauthorizedException("Token de autenticação ausente ou inválido");
    }

    await this.logoutUseCase.executar(token);
  }

  @Post("trocar-senha")
  @HttpCode(HttpStatus.OK)
  @PermitirSenhaProvisoriaRoute()
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Troca a senha provisória por uma senha definitiva",
    description:
      "Obrigatório quando deve_trocar_senha === true. " +
      "A nova senha não pode ser igual à provisória (NF011).",
  })
  @ApiResponse({ status: 200, description: "Senha alterada com sucesso." })
  @ApiResponse({
    status: 400,
    description: "Senha inválida, fraca ou igual à provisória.",
  })
  @ApiResponse({ status: 401, description: "Não autenticado." })
  async trocarSenha(
    @Req() req: Request,
    @Body() dto: ChangePasswordDto,
  ): Promise<TrocarSenhaResultado> {
    const sessao = (req as any).sessao ?? (req as any).session;
    try {
      return await this.changePasswordUseCase.executar({
        usuarioId: sessao.usuarioId,
        novaSenha: dto.novaSenha,
        confirmacaoSenha: dto.confirmacaoSenha,
      });
    } catch (error) {
      if (
        error instanceof ConfirmacaoSenhaDivergenteException ||
        error instanceof NovaSenhaNaoPodeSerIgualProvisoriaException ||
        error instanceof SenhaFracaException
      ) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}

