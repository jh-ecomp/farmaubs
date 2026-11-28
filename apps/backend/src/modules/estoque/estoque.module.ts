import { Logger, Module } from "@nestjs/common";
import { EstoqueAjustesController } from "./api/controllers/estoque-ajustes.controller";
import { EstoqueAnaliticaController } from "./api/controllers/estoque-analitica.controller";
import { EstoqueRastreabilidadeController } from "./api/controllers/estoque-rastreabilidade.controller";
import { EstoqueRelatoriosController } from "./api/controllers/estoque-relatorios.controller";
import { EstoqueSaldosController } from "./api/controllers/estoque-saldos.controller";
import { ConsultarRastreabilidadeLoteUseCase } from "./application/use-cases/consultar-rastreabilidade-lote.use-case";
import { ConsultarSaldosPaginadosUseCase } from "./application/use-cases/consultar-saldos-paginados.use-case";
import { GerarRelatorioEstoqueXlsxUseCase } from "./application/use-cases/gerar-relatorio-estoque-xlsx.use-case";
import { ObterMetricasEstoqueUseCase } from "./application/use-cases/obter-metricas-estoque.use-case";
import { RegistrarAjusteEstoqueUseCase } from "./application/use-cases/registrar-ajuste-estoque.use-case";
import {
  REPOSITORIO_ESTOQUE_AJUSTES_PORT,
  type RepositorioEstoqueAjustesPort,
} from "./domain/ports/estoque-ajustes.repository.port";
import {
  REPOSITORIO_ESTOQUE_METRICAS_PORT,
  type RepositorioEstoqueMetricasPort,
} from "./domain/ports/estoque-metricas.repository.port";
import {
  REPOSITORIO_ESTOQUE_RASTREABILIDADE,
  type RepositorioEstoqueRastreabilidadePort,
} from "./domain/ports/estoque-rastreabilidade.repository.port";
import {
  REPOSITORIO_ESTOQUE_RELATORIOS_PORT,
  type RepositorioEstoqueRelatoriosPort,
} from "./domain/ports/estoque-relatorios.repository.port";
import {
  REPOSITORIO_ESTOQUE_SALDOS_PORT,
  type RepositorioEstoqueSaldosPort,
} from "./domain/ports/estoque-saldos.repository.port";
import {
  GERADOR_PLANILHA_ESTOQUE_PORT,
  type GeradorPlanilhaEstoquePort,
} from "./domain/ports/gerador-planilha-estoque.port";
import { EstoqueAjustesPgRepository } from "./infrastructure/adapters/estoque-ajustes-pg.repository";
import { EstoqueMetricasPgRepository } from "./infrastructure/adapters/estoque-metricas-pg.repository";
import { EstoqueRastreabilidadePgRepository } from "./infrastructure/adapters/estoque-rastreabilidade-pg.repository";
import { EstoqueRelatoriosPgRepository } from "./infrastructure/adapters/estoque-relatorios-pg.repository";
import { EstoqueSaldosPgRepository } from "./infrastructure/adapters/estoque-saldos-pg.repository";
import { ExcelJsGeradorPlanilhaEstoqueAdapter } from "./infrastructure/adapters/exceljs-gerador-planilha-estoque.adapter";

/**
 * [RF005 / RF009 / RF011 / RF018 / RF020 / RF022 / RF023 / RF028]: Módulo de estoque. Instancia os casos de uso
 * puros via useFactory / providers, ligando-os aos adaptadores PG pelas portas de repositório e serviços de infraestrutura.
 */
@Module({
  controllers: [
    EstoqueAnaliticaController,
    EstoqueSaldosController,
    EstoqueAjustesController,
    EstoqueRastreabilidadeController,
    EstoqueRelatoriosController,
  ],
  providers: [
    EstoqueMetricasPgRepository,
    {
      provide: REPOSITORIO_ESTOQUE_METRICAS_PORT,
      useExisting: EstoqueMetricasPgRepository,
    },
    {
      provide: ObterMetricasEstoqueUseCase,
      useFactory: (repo: RepositorioEstoqueMetricasPort) =>
        new ObterMetricasEstoqueUseCase(repo),
      inject: [REPOSITORIO_ESTOQUE_METRICAS_PORT],
    },
    EstoqueSaldosPgRepository,
    {
      provide: REPOSITORIO_ESTOQUE_SALDOS_PORT,
      useExisting: EstoqueSaldosPgRepository,
    },
    {
      provide: ConsultarSaldosPaginadosUseCase,
      useFactory: (repo: RepositorioEstoqueSaldosPort) =>
        new ConsultarSaldosPaginadosUseCase(repo),
      inject: [REPOSITORIO_ESTOQUE_SALDOS_PORT],
    },
    EstoqueAjustesPgRepository,
    {
      provide: REPOSITORIO_ESTOQUE_AJUSTES_PORT,
      useExisting: EstoqueAjustesPgRepository,
    },
    {
      provide: RegistrarAjusteEstoqueUseCase,
      useFactory: (repo: RepositorioEstoqueAjustesPort) =>
        new RegistrarAjusteEstoqueUseCase(repo),
      inject: [REPOSITORIO_ESTOQUE_AJUSTES_PORT],
    },
    EstoqueRastreabilidadePgRepository,
    {
      provide: REPOSITORIO_ESTOQUE_RASTREABILIDADE,
      useExisting: EstoqueRastreabilidadePgRepository,
    },
    {
      provide: ConsultarRastreabilidadeLoteUseCase,
      useFactory: (repo: RepositorioEstoqueRastreabilidadePort) =>
        new ConsultarRastreabilidadeLoteUseCase(
          repo,
          new Logger(ConsultarRastreabilidadeLoteUseCase.name),
        ),
      inject: [REPOSITORIO_ESTOQUE_RASTREABILIDADE],
    },
    EstoqueRelatoriosPgRepository,
    {
      provide: REPOSITORIO_ESTOQUE_RELATORIOS_PORT,
      useExisting: EstoqueRelatoriosPgRepository,
    },
    ExcelJsGeradorPlanilhaEstoqueAdapter,
    {
      provide: GERADOR_PLANILHA_ESTOQUE_PORT,
      useExisting: ExcelJsGeradorPlanilhaEstoqueAdapter,
    },
    {
      provide: GerarRelatorioEstoqueXlsxUseCase,
      useFactory: (
        repo: RepositorioEstoqueRelatoriosPort,
        gerador: GeradorPlanilhaEstoquePort,
      ) => new GerarRelatorioEstoqueXlsxUseCase(repo, gerador),
      inject: [
        REPOSITORIO_ESTOQUE_RELATORIOS_PORT,
        GERADOR_PLANILHA_ESTOQUE_PORT,
      ],
    },
  ],
  exports: [
    ObterMetricasEstoqueUseCase,
    ConsultarSaldosPaginadosUseCase,
    GerarRelatorioEstoqueXlsxUseCase,
  ],
})
export class EstoqueModule {}
