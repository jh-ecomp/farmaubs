import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AuthenticatedUserPayload, PerfilCodigo } from "@farmaubs/shared";
import { CurrentUser } from "../../../../common/decorators/current-user.decorator";
import { Roles } from "../../../../common/decorators/roles.decorator";
import { EfetivarRecebimentoUseCase } from "../../application/use-cases/efetivar-recebimento.use-case";
import {
  CriarEntradaEstoqueDto,
  EntradaEstoqueEfetivadaSwaggerResponse,
} from "../dto/recebimento.dto";
import {
  DocumentoEntradaDuplicadoException,
  FabricanteNaoEncontradoException,
  ItemRecebimentoInvalidoException,
  ProdutoNaoEncontradoException,
  UbsNaoInformadaException,
  ValidadeVencidaException,
} from "../../domain/errors/recebimento.errors";

/**
 * [RF008 / RF024 / RF028 / ADR-008]: Controller REST para registro e efetivação de recebimento físico de cargas de medicamentos.
 */
@ApiTags("Recebimento de Medicamentos e Cargas")
@Controller("recebimento")
export class RecebimentoController {
  constructor(
    private readonly efetivarRecebimentoUseCase: EfetivarRecebimentoUseCase,
  ) {}

  @Post("entradas")
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth("access-token")
  @Roles(
    PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    PerfilCodigo.FARMACEUTICO_RESIDENTE,
    PerfilCodigo.ADMINISTRADOR,
    PerfilCodigo.GERENTE,
  )
  @ApiOperation({
    summary: "Efetiva o recebimento de carga com conferência física (RF008 / RF028)",
    description:
      "Registra nota fiscal/guia de remessa, realiza upsert atômico de lotes com lock pessimista, valida validade (bloqueia vencidos, emite warning se <180d) e registra movimentações de estoque no livro-razão.",
  })
  @ApiCreatedResponse({
    description: "Carga recebida e estoque atualizado com sucesso.",
    type: EntradaEstoqueEfetivadaSwaggerResponse,
  })
  @ApiBadRequestResponse({
    description:
      "Lote vencido (< 0 dias), quantidade inválida ou dados incompletos.",
  })
  @ApiConflictResponse({
    description:
      "Documento/guia já registrado anteriormente para esta unidade de saúde.",
  })
  @ApiNotFoundResponse({
    description: "Medicamento ou Fabricante não encontrado no catálogo.",
  })
  @ApiForbiddenResponse({
    description: "Usuário não possui vínculo ou permissão com a UBS informada.",
  })
  @ApiUnauthorizedResponse({
    description: "Token de autenticação ausente ou inválido.",
  })
  async efetivarEntrada(
    @Body() dto: CriarEntradaEstoqueDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ): Promise<EntradaEstoqueEfetivadaSwaggerResponse> {
    const ubsDestino = dto.ubsId || user.unidadeIds?.[0];

    if (!ubsDestino) {
      throw new BadRequestException(
        "Nenhuma unidade de saúde (UBS) informada ou vinculada ao usuário autenticado.",
      );
    }

    if (user.unidadeIds?.length > 0 && !user.unidadeIds.includes(ubsDestino)) {
      throw new ForbiddenException(
        "Acesso negado: a unidade informada não pertence às unidades atribuídas ao usuário.",
      );
    }

    try {
      return await this.efetivarRecebimentoUseCase.execute(dto, {
        municipioId: user.municipioId,
        ubsId: ubsDestino,
        usuarioId: user.id,
        usuarioNome: user.nomeCompleto,
      });
    } catch (error) {
      if (error instanceof ValidadeVencidaException) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof ItemRecebimentoInvalidoException) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof DocumentoEntradaDuplicadoException) {
        throw new ConflictException(error.message);
      }
      if (error instanceof ProdutoNaoEncontradoException) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof FabricanteNaoEncontradoException) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof UbsNaoInformadaException) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
