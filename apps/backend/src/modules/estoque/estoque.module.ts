import { Module } from "@nestjs/common";
import { EstoqueAnaliticaController } from "./api/controllers/estoque-analitica.controller";
import { EstoqueSaldosController } from "./api/controllers/estoque-saldos.controller";
import { ConsultarSaldosPaginadosUseCase } from "./application/use-cases/consultar-saldos-paginados.use-case";
import { ObterMetricasEstoqueUseCase } from "./application/use-cases/obter-metricas-estoque.use-case";
import {
  REPOSITORIO_ESTOQUE_METRICAS_PORT,
  type RepositorioEstoqueMetricasPort,
} from "./domain/ports/estoque-metricas.repository.port";
import {
  REPOSITORIO_ESTOQUE_SALDOS_PORT,
  type RepositorioEstoqueSaldosPort,
} from "./domain/ports/estoque-saldos.repository.port";
import { EstoqueMetricasPgRepository } from "./infrastructure/adapters/estoque-metricas-pg.repository";
import { EstoqueSaldosPgRepository } from "./infrastructure/adapters/estoque-saldos-pg.repository";

/**
 * [RF005 / RF018 / RF022 / RF023]: Módulo de estoque. Instancia os casos de uso puros via
 * useFactory, ligando-os aos adaptadores PG pelas portas de repositório.
 */
@Module({
  controllers: [EstoqueAnaliticaController, EstoqueSaldosController],
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
  ],
  exports: [ObterMetricasEstoqueUseCase, ConsultarSaldosPaginadosUseCase],
})
export class EstoqueModule {}
