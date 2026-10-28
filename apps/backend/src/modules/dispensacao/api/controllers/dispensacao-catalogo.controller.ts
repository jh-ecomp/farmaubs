import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { type AuthenticatedUserPayload, PerfilCodigo } from "@farmaubs/shared";
import { CurrentUser, Roles } from "../../../../common/decorators";
import { BuscarMedicamentosDispensacaoUseCase } from "../../application/use-cases/buscar-medicamentos-dispensacao.use-case";
import { ObterSugestaoLotesFefoUseCase } from "../../application/use-cases/obter-sugestao-lotes-fefo.use-case";
import { MedicamentoNaoEncontradoException } from "../../domain/errors/dispensacao-catalogo.errors";
import {
  BuscarMedicamentosQueryDto,
  MedicamentoBuscaResponseDto,
  SugestaoFefoResponseDto,
} from "../dto/dispensacao-catalogo.dto";

@ApiTags("Dispensação")
@Controller("dispensacao/medicamentos")
export class DispensacaoCatalogoController {
  constructor(
    private readonly buscarMedicamentosUseCase: BuscarMedicamentosDispensacaoUseCase,
    private readonly obterSugestaoLotesFefoUseCase: ObterSugestaoLotesFefoUseCase,
  ) {}

  /**
   * Pesquisa textual rápida de medicamentos ativos no catálogo com saldo na UBS atual (RF010, NF010).
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
    summary:
      "Busca textual de medicamentos no catálogo para dispensação (RF010)",
    description:
      "Pesquisa medicamentos ativos por nome comercial, princípio ativo ou apresentação, retornando o saldo consolidado na UBS ativa da sessão (NF010).",
  })
  @ApiOkResponse({
    description: "Lista de medicamentos retornada com sucesso.",
    type: [MedicamentoBuscaResponseDto],
  })
  @ApiUnauthorizedResponse({
    description: "Não autorizado — token de autenticação ausente ou inválido.",
  })
  @ApiForbiddenResponse({
    description: "Acesso negado — perfil do usuário não autorizado.",
  })
  async buscarMedicamentos(
    @Query() query: BuscarMedicamentosQueryDto,
    @CurrentUser() user?: AuthenticatedUserPayload,
  ): Promise<MedicamentoBuscaResponseDto[]> {
    const unidadeId = this.resolverEValidarUbs(user, query?.ubsId);
    return this.buscarMedicamentosUseCase.execute(query.termo, unidadeId);
  }

  /**
   * Consulta os lotes estocados na UBS para um medicamento aplicando o algoritmo FEFO (RF010).
   */
  @Get(":id/lotes-fefo")
  @HttpCode(HttpStatus.OK)
  @Roles(
    PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    PerfilCodigo.FARMACEUTICO_RESIDENTE,
    PerfilCodigo.GERENTE,
    PerfilCodigo.ADMINISTRADOR,
  )
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary:
      "Consulta lotes estocados na UBS com ordenação e sugestão FEFO (RF010)",
    description:
      "Retorna o lote prioritário sugerido por FEFO (vencimento mais próximo não expirado) e a lista de lotes alternativos da UBS com alertas de validade curta.",
  })
  @ApiOkResponse({
    description: "Sugestão FEFO e lotes disponíveis retornados com sucesso.",
    type: SugestaoFefoResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Medicamento não encontrado no catálogo ativo.",
  })
  @ApiUnauthorizedResponse({
    description: "Não autorizado — token de autenticação ausente ou inválido.",
  })
  @ApiForbiddenResponse({
    description: "Acesso negado — perfil do usuário não autorizado.",
  })
  async obterLotesFefo(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user?: AuthenticatedUserPayload,
    @Query("ubsId") ubsId?: string,
  ): Promise<SugestaoFefoResponseDto> {
    const unidadeId = this.resolverEValidarUbs(user, ubsId);
    try {
      return await this.obterSugestaoLotesFefoUseCase.execute(id, unidadeId);
    } catch (error) {
      if (error instanceof MedicamentoNaoEncontradoException) {
        throw new NotFoundException(error.message);
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
