import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { PerfilCodigo } from "@farmaubs/shared";
import type {
  AuthenticatedUserPayload,
  DetalhesRecebimentoCompleto,
  HistoricoRecebimentoPaginado,
  ResultadoEstornoRecebimento,
} from "@farmaubs/shared";
import { CurrentUser } from "../../../../common/decorators/current-user.decorator";
import { Roles } from "../../../../common/decorators/roles.decorator";
import { SkipTransaction } from "../../../../common/transaction/skip-transaction.decorator";
import { ListarHistoricoRecebimentoUseCase } from "../../application/use-cases/listar-historico-recebimento.use-case";
import { ObterDetalhesRecebimentoUseCase } from "../../application/use-cases/obter-detalhes-recebimento.use-case";
import { EstornarRecebimentoUseCase } from "../../application/use-cases/estornar-recebimento.use-case";
import {
  EstornarRecebimentoBodyDto,
  ListarHistoricoRecebimentoQueryDto,
} from "../dto/historico.dto";
import {
  DocumentoEntradaInvalidoException,
  DocumentoJaEstornadoException,
  DocumentoNaoEncontradoException,
  SaldoInsuficienteEstornoException,
  UbsAcessoNegadoException,
} from "../../domain/errors/recebimento.errors";

/**
 * [RF008 / RF028 / ADR-017]: Controller REST para consulta de histórico, detalhes de recebimento e estorno de cargas.
 */
@ApiTags("Histórico de Recebimentos e Estornos")
@Controller("recebimento")
export class HistoricoRecebimentoController {
  constructor(
    private readonly listarHistoricoUseCase: ListarHistoricoRecebimentoUseCase,
    private readonly obterDetalhesUseCase: ObterDetalhesRecebimentoUseCase,
    private readonly estornarRecebimentoUseCase: EstornarRecebimentoUseCase,
  ) {}

  @Get("historico")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("access-token")
  @Roles(
    PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    PerfilCodigo.FARMACEUTICO_RESIDENTE,
    PerfilCodigo.ADMINISTRADOR,
    PerfilCodigo.GERENTE,
  )
  @ApiOperation({
    summary: "Consulta paginada do histórico de recebimentos na UBS (RF008 / RF028)",
    description:
      "Lista documentos de recebimento com filtros por UBS, período (HOJE, ONTEM, últimos 7/30 dias, customizado), status e busca textual.",
  })
  @ApiOkResponse({
    description: "Histórico de recebimentos retornado com sucesso.",
  })
  @ApiUnauthorizedResponse({
    description: "Token de autenticação ausente ou inválido.",
  })
  async listarHistorico(
    @Query() query: ListarHistoricoRecebimentoQueryDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ): Promise<HistoricoRecebimentoPaginado> {
    try {
      return await this.listarHistoricoUseCase.execute(query, {
        municipioId: user.municipioId,
        unidadeIdsUsuario: user.unidadeIds ?? [],
      });
    } catch (error) {
      if (error instanceof UbsAcessoNegadoException) {
        throw new ForbiddenException(error.message);
      }
      throw error;
    }
  }

  @Get("entradas/:id")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("access-token")
  @Roles(
    PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    PerfilCodigo.FARMACEUTICO_RESIDENTE,
    PerfilCodigo.ADMINISTRADOR,
    PerfilCodigo.GERENTE,
  )
  @ApiOperation({
    summary: "Obtém detalhes completos de uma entrada para conferência ou termo SUS",
    description:
      "Retorna cabeçalho do documento, relação detalhada de medicamentos, lotes, fabricantes, validades e se está elegível a estorno.",
  })
  @ApiParam({ name: "id", description: "UUID do documento de entrada" })
  @ApiOkResponse({
    description: "Detalhes do documento de entrada retornados com sucesso.",
  })
  @ApiNotFoundResponse({
    description: "Documento de entrada não encontrado para o município ativo.",
  })
  async obterDetalhes(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUserPayload,
  ): Promise<DetalhesRecebimentoCompleto> {
    try {
      return await this.obterDetalhesUseCase.execute(id, {
        municipioId: user.municipioId,
        unidadeIdsUsuario: user.unidadeIds ?? [],
      });
    } catch (error) {
      if (error instanceof DocumentoNaoEncontradoException) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof UbsAcessoNegadoException) {
        throw new ForbiddenException(error.message);
      }
      throw error;
    }
  }

  @Post("entradas/:id/estorno")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("access-token")
  @Roles(
    PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    PerfilCodigo.ADMINISTRADOR,
    PerfilCodigo.GERENTE,
  )
  @ApiOperation({
    summary: "Executa o estorno atômico de uma carga recebida (RF028 / ADR-017)",
    description:
      "Subtrai os saldos dos lotes, altera status para ESTORNADO e grava lançamentos compensatórios no livro-razão (movimentacoes_estoque). Bloqueia estorno se o saldo atual do lote for menor que a quantidade recebida.",
  })
  @ApiParam({ name: "id", description: "UUID do documento de entrada a estornar" })
  @ApiOkResponse({
    description: "Recebimento estornado com sucesso e livro-razão atualizado.",
  })
  @ApiBadRequestResponse({
    description: "Justificativa curta ou saldo de lote insuficiente por dispensação prévia.",
  })
  @ApiConflictResponse({
    description: "Documento já se encontra estornado no sistema.",
  })
  @ApiNotFoundResponse({
    description: "Documento de entrada não encontrado.",
  })
  async estornarRecebimento(
    @Param("id") id: string,
    @Body() dto: EstornarRecebimentoBodyDto,
    @CurrentUser() user: AuthenticatedUserPayload,
  ): Promise<ResultadoEstornoRecebimento> {
    try {
      return await this.estornarRecebimentoUseCase.execute(id, dto.motivo, {
        municipioId: user.municipioId,
        usuarioId: user.id,
        unidadeIdsUsuario: user.unidadeIds ?? [],
      });
    } catch (error) {
      if (error instanceof DocumentoNaoEncontradoException) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof DocumentoJaEstornadoException) {
        throw new ConflictException(error.message);
      }
      if (error instanceof SaldoInsuficienteEstornoException) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof DocumentoEntradaInvalidoException) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof UbsAcessoNegadoException) {
        throw new ForbiddenException(error.message);
      }
      throw error;
    }
  }
}
