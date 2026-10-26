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
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  type AuthenticatedUserPayload,
  PerfilCodigo,
} from "@farmaubs/shared";
import { CurrentUser, Roles } from "../../../../common/decorators";
import { ListarDispensacoesUseCase } from "../../application/use-cases/listar-dispensacoes.use-case";
import { ExportarDispensacoesXlsxUseCase } from "../../application/use-cases/exportar-dispensacoes-xlsx.use-case";
import { EstornarDispensacaoUseCase } from "../../application/use-cases/estornar-dispensacao.use-case";
import {
  DadosDispensacaoInvalidosException,
  DispensacaoJaEstornadaException,
  DispensacaoNaoEncontradaException,
  IntervaloDatasInvalidoException,
  MotivoEstornoInvalidoException,
} from "../../domain/errors/dispensacao.errors";
import {
  DispensacoesPaginadasResponseDto,
  EstornarDispensacaoDto,
  EstornarDispensacaoResponseDto,
  ListarDispensacoesQueryDto,
} from "../dto/historico-dispensacao.dto";

@ApiTags("Dispensação")
@Controller("dispensacoes")
export class HistoricoDispensacaoController {
  constructor(
    private readonly listarDispensacoesUseCase: ListarDispensacoesUseCase,
    private readonly exportarDispensacoesXlsxUseCase: ExportarDispensacoesXlsxUseCase,
    private readonly estornarDispensacaoUseCase: EstornarDispensacaoUseCase,
  ) {}

  /**
   * Lista o histórico paginado de dispensações da UBS com filtro padrão de ontem e hoje (D-1 e D0) (RF012).
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(
    PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    PerfilCodigo.FARMACEUTICO_RESIDENTE,
    PerfilCodigo.GERENTE,
    PerfilCodigo.ADMINISTRADOR,
  )
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Listagem paginada de dispensas com filtro padrão ontem/hoje e busca combinada (RF012)",
    description:
      "Retorna as dispensações da UBS ativa. Quando dataInicio e dataFim são omitidos, aplica automaticamente o intervalo D-1 (ontem) e D0 (hoje).",
  })
  @ApiOkResponse({
    description: "Histórico paginado de dispensações retornado com sucesso.",
    type: DispensacoesPaginadasResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Intervalo de datas inválido (dataFim < dataInicio ou período superior a 365 dias).",
  })
  @ApiUnauthorizedResponse({
    description: "Não autorizado — token de autenticação ausente ou inválido.",
  })
  @ApiForbiddenResponse({
    description: "Acesso negado — perfil do usuário não autorizado.",
  })
  async listar(
    @Query() query: ListarDispensacoesQueryDto,
    @CurrentUser() user?: AuthenticatedUserPayload,
  ): Promise<DispensacoesPaginadasResponseDto> {
    const unidadeId = this.resolverEValidarUbs(user, query?.ubsId);

    try {
      return await this.listarDispensacoesUseCase.execute(query, unidadeId);
    } catch (error) {
      if (error instanceof IntervaloDatasInvalidoException) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * Exporta o histórico filtrado de dispensações em planilha Excel (.xlsx) (RF012).
   */
  @Get("exportar-xlsx")
  @HttpCode(HttpStatus.OK)
  @Roles(
    PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    PerfilCodigo.FARMACEUTICO_RESIDENTE,
    PerfilCodigo.GERENTE,
    PerfilCodigo.ADMINISTRADOR,
  )
  @ApiBearerAuth("access-token")
  @ApiProduces(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  )
  @ApiOperation({
    summary: "Download de planilha Excel (.xlsx) das dispensas filtradas (RF012)",
    description:
      "Gera e transmite arquivo .xlsx contendo as 12 colunas obrigatórias de auditoria para o período e filtros informados.",
  })
  @ApiOkResponse({
    description: "Planilha Excel (.xlsx) gerada com sucesso.",
    schema: { type: "string", format: "binary" },
  })
  @ApiBadRequestResponse({
    description: "Intervalo de datas inválido.",
  })
  @ApiUnauthorizedResponse({
    description: "Não autorizado — token de autenticação ausente ou inválido.",
  })
  @ApiForbiddenResponse({
    description: "Acesso negado — perfil do usuário não autorizado.",
  })
  async exportarXlsx(
    @Query() query: ListarDispensacoesQueryDto,
    @CurrentUser() user?: AuthenticatedUserPayload,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<Buffer> {
    const unidadeId = this.resolverEValidarUbs(user, query?.ubsId);

    try {
      const resultado = await this.exportarDispensacoesXlsxUseCase.execute(
        query,
        unidadeId,
      );
      if (res?.setHeader) {
        res.setHeader("Content-Type", resultado.contentType);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${resultado.nomeArquivo}"`,
        );
      }
      return resultado.buffer;
    } catch (error) {
      if (error instanceof IntervaloDatasInvalidoException) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * Estorna uma dispensação concluída restituindo os saldos aos lotes físicos (RF028, ADR-015).
   */
  @Post(":id/estorno")
  @HttpCode(HttpStatus.OK)
  @Roles(
    PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    PerfilCodigo.FARMACEUTICO_RESIDENTE,
    PerfilCodigo.ADMINISTRADOR,
  )
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Estorna um atendimento e devolve os itens ao estoque (RF028, ADR-015)",
    description:
      "Reverte atomicamente uma dispensação concluída mediante justificativa obrigatória (>= 10 caracteres), incrementando o saldo dos lotes envolvidos.",
  })
  @ApiOkResponse({
    description: "Dispensação estornada e saldos restituídos com sucesso.",
    type: EstornarDispensacaoResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Motivo do estorno ausente ou com menos de 10 caracteres.",
  })
  @ApiNotFoundResponse({
    description: "Dispensação não encontrada na UBS atual.",
  })
  @ApiConflictResponse({
    description: "A dispensação já foi estornada anteriormente.",
  })
  @ApiUnauthorizedResponse({
    description: "Não autorizado — token de autenticação ausente ou inválido.",
  })
  @ApiForbiddenResponse({
    description: "Acesso negado — perfil do usuário não autorizado para estornar dispensas.",
  })
  async estornar(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: EstornarDispensacaoDto,
    @CurrentUser() user?: AuthenticatedUserPayload,
  ): Promise<EstornarDispensacaoResponseDto> {
    const sessao = user as
      | (AuthenticatedUserPayload & {
          id?: string;
          userId?: string;
        })
      | undefined;

    const estornadoPorId = sessao?.id ?? sessao?.userId ?? "";
    const unidadeId = this.resolverEValidarUbs(user, dto?.ubsId);

    try {
      return await this.estornarDispensacaoUseCase.execute(id, dto, {
        unidadeId,
        estornadoPorId,
      });
    } catch (error) {
      if (
        error instanceof MotivoEstornoInvalidoException ||
        error instanceof DadosDispensacaoInvalidosException
      ) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof DispensacaoNaoEncontradaException) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof DispensacaoJaEstornadaException) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  private resolverEValidarUbs(
    user?: AuthenticatedUserPayload,
    ubsIdSolicitada?: string,
  ): string | null {
    const sessao = user as
      | (AuthenticatedUserPayload & {
          unidadeId?: string | null;
          ubsId?: string | null;
          unidadeIds?: string[];
        })
      | undefined;

    const unidadeId =
      ubsIdSolicitada ??
      sessao?.unidadeIds?.[0] ??
      sessao?.unidadeId ??
      sessao?.ubsId ??
      null;

    if (
      ubsIdSolicitada &&
      sessao?.perfilCodigo !== PerfilCodigo.ADMINISTRADOR &&
      Array.isArray(sessao?.unidadeIds) &&
      sessao.unidadeIds.length > 0 &&
      !sessao.unidadeIds.includes(ubsIdSolicitada)
    ) {
      throw new ForbiddenException(
        "Acesso negado: a unidade informada não pertence às unidades atribuídas ao usuário.",
      );
    }

    return unidadeId;
  }
}

