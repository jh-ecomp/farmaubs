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
  type EstoqueMetricasResponseDto,
} from "@farmaubs/shared";
import { ObterMetricasEstoqueUseCase } from "../../application/use-cases/obter-metricas-estoque.use-case";
import { EstoqueMetricasQueryDto } from "../dto/estoque-metricas-query.dto";
import { Roles } from "../../../../common/decorators";
import { TenantScoped } from "../../../../common/decorators/tenant-scoped.decorator";

const FUSO_UBS = "America/Fortaleza";

@ApiTags("Estoque")
@Controller("estoque")
export class EstoqueAnaliticaController {
  constructor(
    private readonly obterMetricasUseCase: ObterMetricasEstoqueUseCase,
  ) {}

  /**
   * [RF018 / RF022 / RF023]: Retorna os indicadores consolidados de estoque de uma UBS.
   * @param query - unidadeId da UBS, validado contra o escopo do usuário pelo TenantScopeGuard.
   * @returns EstoqueMetricasResponseDto com totais, risco de ruptura e validade dos lotes.
   * @throws {ForbiddenException} Se a UBS estiver fora do escopo ou o perfil não tiver permissão.
   */
  @Get("metricas")
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
    summary: "Indicadores analíticos de estoque da UBS",
    description:
      "Total de medicamentos ativos, unidades físicas, itens em risco de ruptura e lotes com validade no mês, abaixo de 90 dias ou vencidos (RF018, RF022, RF023).",
  })
  @ApiOkResponse({ description: "Métricas calculadas com sucesso." })
  @ApiBadRequestResponse({ description: "unidadeId ausente ou não é UUID." })
  @ApiUnauthorizedResponse({ description: "Sessão ausente ou inválida." })
  @ApiForbiddenResponse({
    description: "Perfil sem permissão ou UBS fora do escopo.",
  })
  async obter(
    @Query() query: EstoqueMetricasQueryDto,
  ): Promise<EstoqueMetricasResponseDto> {
    return this.obterMetricasUseCase.executar(
      query.unidadeId,
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
