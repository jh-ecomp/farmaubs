import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  PerfilCodigo,
  type AuthenticatedUserPayload,
  type RastreabilidadeLoteDto,
} from "@farmaubs/shared";
import { CurrentUser, Roles } from "../../../../common/decorators";
import { ConsultarRastreabilidadeLoteUseCase } from "../../application/use-cases/consultar-rastreabilidade-lote.use-case";
import { LoteNaoEncontradoException } from "../../domain/errors/ajuste-estoque.errors";

@ApiTags("Estoque")
@Controller("estoque")
export class EstoqueRastreabilidadeController {
  constructor(private readonly useCase: ConsultarRastreabilidadeLoteUseCase) {}

  /**
   * [RF028 / NF007 / NF009 / NF015]: Linha do tempo cronológica das movimentações de um lote.
   * @param loteId - UUID do lote (validado por `ParseUUIDPipe`; inválido gera 400).
   * @param user - Usuário autenticado; de sua sessão vêm as UBSs permitidas.
   * @returns DTO de rastreabilidade com metadados, medicamento e movimentações.
   * @throws {NotFoundException} Lote inexistente ou fora das UBSs do usuário (404).
   */
  @Get("lotes/:loteId/rastreabilidade")
  @Roles(
    PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    PerfilCodigo.FARMACEUTICO_RESIDENTE,
    PerfilCodigo.GERENTE,
  )
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Rastreabilidade e linha do tempo de movimentações do lote",
    description: "Histórico imutável do livro-razão com saldo resultante por evento (RF028).",
  })
  @ApiOkResponse({ description: "Linha do tempo do lote." })
  @ApiBadRequestResponse({ description: "loteId não é um UUID válido." })
  @ApiUnauthorizedResponse({ description: "Sessão ausente ou inválida." })
  @ApiForbiddenResponse({ description: "Perfil sem permissão." })
  @ApiNotFoundResponse({ description: "Lote não encontrado para o usuário." })
  async consultar(
    @Param("loteId", new ParseUUIDPipe()) loteId: string,
    @CurrentUser() user?: AuthenticatedUserPayload,
  ): Promise<RastreabilidadeLoteDto> {
    const sessao = user as unknown as { unidadeIds?: string[] } | undefined;
    try {
      return await this.useCase.execute(loteId, sessao?.unidadeIds ?? []);
    } catch (error) {
      if (error instanceof LoteNaoEncontradoException) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}

