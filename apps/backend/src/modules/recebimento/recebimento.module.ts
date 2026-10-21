import { Module } from "@nestjs/common";
import { CatalogoController } from "./api/controllers/catalogo.controller";
import { RecebimentoController } from "./api/controllers/recebimento.controller";
import { BuscarProdutosCatalogoUseCase } from "./application/use-cases/buscar-produtos-catalogo.use-case";
import { ListarFabricantesUseCase } from "./application/use-cases/listar-fabricantes.use-case";
import { CadastrarFabricanteUseCase } from "./application/use-cases/cadastrar-fabricante.use-case";
import { EfetivarRecebimentoUseCase } from "./application/use-cases/efetivar-recebimento.use-case";
import { TypeOrmCatalogoRepository } from "./infrastructure/adapters/typeorm-catalogo.repository";
import { TypeOrmRecebimentoRepository } from "./infrastructure/adapters/typeorm-recebimento.repository";
import {
  CATALOGO_REPOSITORY_PORT,
  type CatalogoRepositoryPort,
} from "./domain/ports/catalogo.repository.port";
import {
  RECEBIMENTO_REPOSITORY_PORT,
  type RecebimentoRepositoryPort,
} from "./domain/ports/recebimento.repository.port";

@Module({
  controllers: [CatalogoController, RecebimentoController],
  providers: [
    TypeOrmCatalogoRepository,
    {
      provide: CATALOGO_REPOSITORY_PORT,
      useExisting: TypeOrmCatalogoRepository,
    },
    TypeOrmRecebimentoRepository,
    {
      provide: RECEBIMENTO_REPOSITORY_PORT,
      useExisting: TypeOrmRecebimentoRepository,
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
    {
      provide: EfetivarRecebimentoUseCase,
      useFactory: (
        recebimentoRepo: RecebimentoRepositoryPort,
        catalogoRepo: CatalogoRepositoryPort,
      ) => new EfetivarRecebimentoUseCase(recebimentoRepo, catalogoRepo),
      inject: [RECEBIMENTO_REPOSITORY_PORT, CATALOGO_REPOSITORY_PORT],
    },
  ],
  exports: [
    CATALOGO_REPOSITORY_PORT,
    RECEBIMENTO_REPOSITORY_PORT,
    BuscarProdutosCatalogoUseCase,
    ListarFabricantesUseCase,
    CadastrarFabricanteUseCase,
    EfetivarRecebimentoUseCase,
    TypeOrmCatalogoRepository,
    TypeOrmRecebimentoRepository,
  ],
})
export class RecebimentoModule {}
