import { Module } from "@nestjs/common";
import { CatalogoController } from "./api/controllers/catalogo.controller";
import { RecebimentoController } from "./api/controllers/recebimento.controller";
import { HistoricoRecebimentoController } from "./api/controllers/historico-recebimento.controller";
import { BuscarProdutosCatalogoUseCase } from "./application/use-cases/buscar-produtos-catalogo.use-case";
import { ListarFabricantesUseCase } from "./application/use-cases/listar-fabricantes.use-case";
import { CadastrarFabricanteUseCase } from "./application/use-cases/cadastrar-fabricante.use-case";
import { EfetivarRecebimentoUseCase } from "./application/use-cases/efetivar-recebimento.use-case";
import { ListarHistoricoRecebimentoUseCase } from "./application/use-cases/listar-historico-recebimento.use-case";
import { ObterDetalhesRecebimentoUseCase } from "./application/use-cases/obter-detalhes-recebimento.use-case";
import { EstornarRecebimentoUseCase } from "./application/use-cases/estornar-recebimento.use-case";
import { TypeOrmCatalogoRepository } from "./infrastructure/adapters/typeorm-catalogo.repository";
import { TypeOrmRecebimentoRepository } from "./infrastructure/adapters/typeorm-recebimento.repository";
import { TypeOrmHistoricoRecebimentoRepository } from "./infrastructure/adapters/typeorm-historico-recebimento.repository";
import {
  CATALOGO_REPOSITORY_PORT,
  type CatalogoRepositoryPort,
} from "./domain/ports/catalogo.repository.port";
import {
  RECEBIMENTO_REPOSITORY_PORT,
  type RecebimentoRepositoryPort,
} from "./domain/ports/recebimento.repository.port";
import {
  HISTORICO_RECEBIMENTO_REPOSITORY_PORT,
  type HistoricoRecebimentoRepositoryPort,
} from "./domain/ports/historico-recebimento.repository.port";

import { TypeOrmModule } from "@nestjs/typeorm";
import { ProdutoEntity } from "./infrastructure/persistence/entities/produto.entity";
import { FabricanteEntity } from "./infrastructure/persistence/entities/fabricante.entity";
import { DocumentoEntradaEntity } from "./infrastructure/persistence/entities/documento-entrada.entity";
import { LoteEntity } from "./infrastructure/persistence/entities/lote.entity";
import { RecebimentoItemEntity } from "./infrastructure/persistence/entities/recebimento-item.entity";
import { MovimentacaoEstoqueEntity } from "./infrastructure/persistence/entities/movimentacao-estoque.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProdutoEntity,
      FabricanteEntity,
      DocumentoEntradaEntity,
      LoteEntity,
      RecebimentoItemEntity,
      MovimentacaoEstoqueEntity,
    ]),
  ],
  controllers: [
    CatalogoController,
    RecebimentoController,
    HistoricoRecebimentoController,
  ],
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
    TypeOrmHistoricoRecebimentoRepository,
    {
      provide: HISTORICO_RECEBIMENTO_REPOSITORY_PORT,
      useExisting: TypeOrmHistoricoRecebimentoRepository,
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
    {
      provide: ListarHistoricoRecebimentoUseCase,
      useFactory: (repo: HistoricoRecebimentoRepositoryPort) =>
        new ListarHistoricoRecebimentoUseCase(repo),
      inject: [HISTORICO_RECEBIMENTO_REPOSITORY_PORT],
    },
    {
      provide: ObterDetalhesRecebimentoUseCase,
      useFactory: (repo: HistoricoRecebimentoRepositoryPort) =>
        new ObterDetalhesRecebimentoUseCase(repo),
      inject: [HISTORICO_RECEBIMENTO_REPOSITORY_PORT],
    },
    {
      provide: EstornarRecebimentoUseCase,
      useFactory: (repo: HistoricoRecebimentoRepositoryPort) =>
        new EstornarRecebimentoUseCase(repo),
      inject: [HISTORICO_RECEBIMENTO_REPOSITORY_PORT],
    },
  ],
  exports: [
    CATALOGO_REPOSITORY_PORT,
    RECEBIMENTO_REPOSITORY_PORT,
    HISTORICO_RECEBIMENTO_REPOSITORY_PORT,
    BuscarProdutosCatalogoUseCase,
    ListarFabricantesUseCase,
    CadastrarFabricanteUseCase,
    EfetivarRecebimentoUseCase,
    ListarHistoricoRecebimentoUseCase,
    ObterDetalhesRecebimentoUseCase,
    EstornarRecebimentoUseCase,
    TypeOrmCatalogoRepository,
    TypeOrmRecebimentoRepository,
    TypeOrmHistoricoRecebimentoRepository,
  ],
})
export class RecebimentoModule {}
