import { Module } from "@nestjs/common";
import { EstoqueAnaliticaController } from "./api/controllers/estoque-analitica.controller";
import { ObterMetricasEstoqueUseCase } from "./application/use-cases/obter-metricas-estoque.use-case";
import {
  REPOSITORIO_ESTOQUE_METRICAS_PORT,
  type RepositorioEstoqueMetricasPort,
} from "./domain/ports/estoque-metricas.repository.port";
import { EstoqueMetricasPgRepository } from "./infrastructure/adapters/estoque-metricas-pg.repository";

/**
 * [RF018 / RF022 / RF023]: Módulo de estoque analítico. Instancia o caso de uso puro via
 * useFactory, ligando-o ao adaptador PG pela porta de repositório.
 */
@Module({
  controllers: [EstoqueAnaliticaController],
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
  ],
  exports: [ObterMetricasEstoqueUseCase],
})
export class EstoqueModule {}
