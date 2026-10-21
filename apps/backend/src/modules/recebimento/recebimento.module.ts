import { Module } from "@nestjs/common";
import { CatalogoController } from "./api/controllers/catalogo.controller";
import { BuscarProdutosCatalogoUseCase } from "./application/use-cases/buscar-produtos-catalogo.use-case";
import { ListarFabricantesUseCase } from "./application/use-cases/listar-fabricantes.use-case";
import { CadastrarFabricanteUseCase } from "./application/use-cases/cadastrar-fabricante.use-case";
import { TypeOrmCatalogoRepository } from "./infrastructure/adapters/typeorm-catalogo.repository";
import {
  CATALOGO_REPOSITORY_PORT,
  type CatalogoRepositoryPort,
} from "./domain/ports/catalogo.repository.port";

@Module({
  controllers: [CatalogoController],
  providers: [
    TypeOrmCatalogoRepository,
    {
      provide: CATALOGO_REPOSITORY_PORT,
      useExisting: TypeOrmCatalogoRepository,
    },
    {
      provide: BuscarProdutosCatalogoUseCase,
      useFactory: (repo: CatalogoRepositoryPort) =>
        new BuscarProdutosCatalogoUseCase(repo),
      inject: [CATALOGO_REPOSITORY_PORT],
    },
    {
      provide: ListarFabricantesUseCase,
      useFactory: (repo: CatalogoRepositoryPort) =>
        new ListarFabricantesUseCase(repo),
      inject: [CATALOGO_REPOSITORY_PORT],
    },
    {
      provide: CadastrarFabricanteUseCase,
      useFactory: (repo: CatalogoRepositoryPort) =>
        new CadastrarFabricanteUseCase(repo),
      inject: [CATALOGO_REPOSITORY_PORT],
    },
  ],
  exports: [
    CATALOGO_REPOSITORY_PORT,
    BuscarProdutosCatalogoUseCase,
    ListarFabricantesUseCase,
    CadastrarFabricanteUseCase,
    TypeOrmCatalogoRepository,
  ],
})
export class RecebimentoModule {}
