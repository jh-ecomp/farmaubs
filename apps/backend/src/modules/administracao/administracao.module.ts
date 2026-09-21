import { Module } from "@nestjs/common";
import { AdministracaoController } from "./api/controllers/administracao.controller";
import { ListMunicipiosUseCase } from "./application/use-cases/list-municipios.use-case";
import { ListUnidadesSaudeUseCase } from "./application/use-cases/list-unidades-saude.use-case";
import { TypeOrmMunicipioRepository } from "./infrastructure/adapters/typeorm-municipio.repository";
import { TypeOrmHealthUnitRepository } from "../acesso/infrastructure/adapters/typeorm-health-unit.repository";
import { REPOSITORIO_MUNICIPIO_PORT } from "./domain/ports/municipio.repository.port";
import { REPOSITORIO_UNIDADE_SAUDE_PORT } from "./domain/ports/unidade-saude.repository.port";

@Module({
  controllers: [AdministracaoController],
  providers: [
    ListMunicipiosUseCase,
    ListUnidadesSaudeUseCase,
    TypeOrmMunicipioRepository,
    TypeOrmHealthUnitRepository,
    {
      provide: REPOSITORIO_MUNICIPIO_PORT,
      useExisting: TypeOrmMunicipioRepository,
    },
    {
      provide: REPOSITORIO_UNIDADE_SAUDE_PORT,
      useExisting: TypeOrmHealthUnitRepository,
    },
  ],
  exports: [
    ListMunicipiosUseCase,
    ListUnidadesSaudeUseCase,
    REPOSITORIO_MUNICIPIO_PORT,
    REPOSITORIO_UNIDADE_SAUDE_PORT,
    TypeOrmMunicipioRepository,
    TypeOrmHealthUnitRepository,
  ],
})
export class AdministracaoModule {}
