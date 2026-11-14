import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import {
  PerfilCodigo,
  type AjusteEstoqueResultadoDto,
  type AuthenticatedUserPayload,
} from "@farmaubs/shared";
import { CurrentUser, Roles } from "../../../../common/decorators";
import { RegistrarAjusteEstoqueUseCase } from "../../application/use-cases/registrar-ajuste-estoque.use-case";
import {
  DadosAjusteInvalidosException,
  JustificativaInvalidaException,
  LoteNaoEncontradoException,
  MotivoIncompativelException,
  SaldoInsuficienteException,
} from "../../domain/errors/ajuste-estoque.errors";
import { RegistrarAjusteEstoqueDto } from "../dto/registrar-ajuste-estoque.dto";

@ApiTags("Estoque")
@Controller("estoque")
export class EstoqueAjustesController {
  constructor(
    private readonly registrarAjusteUseCase: RegistrarAjusteEstoqueUseCase,
  ) {}

  /**
   * [RF009 / RF011 / RF028 / NF009]: Registra ajuste manual de entrada ou saída em um lote.
   * @param loteId - UUID do lote a ajustar.
   * @param dto - Tipo, quantidade, motivo e justificativa.
   * @param user - Sessão autenticada (id, nome e UBSs do escopo).
   * @returns AjusteEstoqueResultadoDto com saldos anterior e atualizado.
   * @throws {UnprocessableEntityException} Saída maior que o saldo do lote (422).
   * @throws {NotFoundException} Lote inexistente ou fora das UBSs do usuário (404).
   * @throws {BadRequestException} Dados, motivo ou justificativa inválidos (400).
   */
  @Post("lotes/:loteId/ajustes")
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    PerfilCodigo.FARMACEUTICO_RESIDENTE,
  )
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Ajuste manual de estoque em um lote",
    description:
      "Ajuste de entrada (+) ou saída (-) com motivo, justificativa e auditoria. Restrito a farmacêuticos (NF009).",
  })
  @ApiCreatedResponse({ description: "Ajuste registrado com sucesso." })
  @ApiBadRequestResponse({ description: "Dados do ajuste inválidos." })
  @ApiUnauthorizedResponse({ description: "Sessão ausente ou inválida." })
  @ApiForbiddenResponse({ description: "Perfil sem permissão." })
  @ApiNotFoundResponse({ description: "Lote não encontrado para o usuário." })
  @ApiUnprocessableEntityResponse({
    description: "Saldo insuficiente no lote.",
  })
  async registrar(
    @Param("loteId", new ParseUUIDPipe()) loteId: string,
    @Body() dto: RegistrarAjusteEstoqueDto,
    @CurrentUser() user?: AuthenticatedUserPayload,
  ): Promise<AjusteEstoqueResultadoDto> {
    const sessao = user as unknown as
      | {
          id?: string;
          userId?: string;
          nomeCompleto?: string;
          unidadeIds?: string[];
        }
      | undefined;

    try {
      return await this.registrarAjusteUseCase.execute(loteId, dto, {
        usuarioId: sessao?.id ?? sessao?.userId ?? "",
        usuarioNome: sessao?.nomeCompleto ?? "",
        unidadeIds: sessao?.unidadeIds ?? [],
      });
    } catch (error) {
      throw this.mapearErro(error);
    }
  }

  /** Converte erros de domínio em exceções HTTP; erros desconhecidos seguem sem alteração. */
  private mapearErro(error: unknown): unknown {
    if (error instanceof SaldoInsuficienteException) {
      return new UnprocessableEntityException(error.message);
    }
    if (error instanceof LoteNaoEncontradoException) {
      return new NotFoundException(error.message);
    }
    if (
      error instanceof DadosAjusteInvalidosException ||
      error instanceof MotivoIncompativelException ||
      error instanceof JustificativaInvalidaException
    ) {
      return new BadRequestException(error.message);
    }
    return error;
  }
}
