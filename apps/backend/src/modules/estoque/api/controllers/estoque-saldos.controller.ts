import { Controller, Get, HttpCode, HttpStatus, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  PerfilCodigo,
  type ConsultarSaldosPaginadosResponseDto,
} from "@farmaubs/shared";
import { ConsultarSaldosPaginadosUseCase } from "../../application/use-cases/consultar-saldos-paginados.use-case";
import { ConsultarSaldosQueryDto } from "../dto/consultar-saldos-query.dto";
import { Roles } from "../../../../common/decorators";
import { TenantScoped } from "../../../../common/decorators/tenant-scoped.decorator";

const FUSO_UBS = "America/Fortaleza";

@ApiTags("Estoque")
@Controller("estoque")
export class EstoqueSaldosController {
  constructor(
    private readonly consultarSaldosUseCase: ConsultarSaldosPaginadosUseCase,
  ) {}

  /**
   * [RF005 / RF022]: Lista paginada de saldos por medicamento, com lotes em ordem FEFO.
   * @param query - unidadeId (validado contra o escopo pelo TenantScopeGuard), filtros e paginação.
   * @returns ConsultarSaldosPaginadosResponseDto com itens e metadados de paginação.
   * @throws {ForbiddenException} Se a UBS estiver fora do escopo ou o perfil não tiver permissão.
   */
  @Get("saldos")
  @Roles(
    PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    PerfilCodigo.FARMACEUTICO_RESIDENTE,
    PerfilCodigo.GERENTE,
    PerfilCodigo.ADMINISTRADOR,
  )
  @TenantScoped({ checkUbs: true })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Saldos de estoque da UBS por medicamento e lote",
    description:
      "Listagem paginada com busca textual, categoria, filtro de validade (mês corrente, 90 dias, vencidos) e situação do estoque (RF005, RF022).",
  })
  @ApiOkResponse({ description: "Página de saldos retornada com sucesso." })
  @ApiBadRequestResponse({ description: "Parâmetros de consulta inválidos." })
  @ApiUnauthorizedResponse({ description: "Sessão ausente ou inválida." })
  @ApiForbiddenResponse({
    description: "Perfil sem permissão ou UBS fora do escopo.",
  })
  async consultar(
    @Query() query: ConsultarSaldosQueryDto,
  ): Promise<ConsultarSaldosPaginadosResponseDto> {
    return this.consultarSaldosUseCase.executar(
      query.unidadeId,
      {
        termo: query.termo?.trim() || undefined,
        categoria: query.categoria?.trim() || undefined,
        filtroValidade: query.filtroValidade ?? "TODOS",
        statusEstoque: query.statusEstoque ?? "TODOS",
        // Number() garante número mesmo se o ValidationPipe não estiver com transform.
        pagina: Number(query.pagina ?? 1),
        itensPorPagina: Number(query.itensPorPagina ?? 15),
      },
      this.dataLocalUbs(),
    );
  }

  /** Data de hoje (AAAA-MM-DD) no fuso da UBS, para o cálculo de validade. */
  private dataLocalUbs(): string {
    return new Intl.DateTimeFormat("sv-SE", { timeZone: FUSO_UBS }).format(
      new Date(),
    );
  }
}
