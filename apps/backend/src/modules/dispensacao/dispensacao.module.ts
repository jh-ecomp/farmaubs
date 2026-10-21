import { Module } from "@nestjs/common";
import { PacienteController } from "./api/controllers/paciente.controller";
import { DispensacaoCatalogoController } from "./api/controllers/dispensacao-catalogo.controller";
import { DispensacaoController } from "./api/controllers/dispensacao.controller";
import { CadastrarPacienteUseCase } from "./application/use-cases/cadastrar-paciente.use-case";
import { BuscarPacientesUseCase } from "./application/use-cases/buscar-pacientes.use-case";
import { ConsultarHistoricoPacienteUseCase } from "./application/use-cases/consultar-historico-paciente.use-case";
import { BuscarMedicamentosDispensacaoUseCase } from "./application/use-cases/buscar-medicamentos-dispensacao.use-case";
import { ObterSugestaoLotesFefoUseCase } from "./application/use-cases/obter-sugestao-lotes-fefo.use-case";
import { EfetivarDispensacaoUseCase } from "./application/use-cases/efetivar-dispensacao.use-case";
import { TypeOrmPacienteRepository } from "./infrastructure/adapters/typeorm-paciente.repository";
import { TypeOrmDispensacaoCatalogoRepository } from "./infrastructure/adapters/typeorm-dispensacao-catalogo.repository";
import { TypeOrmDispensacaoRepository } from "./infrastructure/adapters/typeorm-dispensacao.repository";
import { PACIENTE_REPOSITORY_PORT } from "./domain/ports/paciente.repository.port";
import {
  DISPENSACAO_CATALOGO_REPOSITORY_PORT,
  type DispensacaoCatalogoRepositoryPort,
} from "./domain/ports/dispensacao-catalogo.repository.port";
import {
  DISPENSACAO_REPOSITORY_PORT,
  type DispensacaoRepositoryPort,
} from "./domain/ports/dispensacao.repository.port";

@Module({
  controllers: [
    PacienteController,
    DispensacaoCatalogoController,
    DispensacaoController,
  ],
  providers: [
    CadastrarPacienteUseCase,
    BuscarPacientesUseCase,
    ConsultarHistoricoPacienteUseCase,
    TypeOrmPacienteRepository,
    {
      provide: PACIENTE_REPOSITORY_PORT,
      useExisting: TypeOrmPacienteRepository,
    },
    TypeOrmDispensacaoCatalogoRepository,
    {
      provide: DISPENSACAO_CATALOGO_REPOSITORY_PORT,
      useExisting: TypeOrmDispensacaoCatalogoRepository,
    },
    TypeOrmDispensacaoRepository,
    {
      provide: DISPENSACAO_REPOSITORY_PORT,
      useExisting: TypeOrmDispensacaoRepository,
    },
    {
      provide: BuscarMedicamentosDispensacaoUseCase,
      useFactory: (repo: DispensacaoCatalogoRepositoryPort) =>
        new BuscarMedicamentosDispensacaoUseCase(repo),
      inject: [DISPENSACAO_CATALOGO_REPOSITORY_PORT],
    },
    {
      provide: ObterSugestaoLotesFefoUseCase,
      useFactory: (repo: DispensacaoCatalogoRepositoryPort) =>
        new ObterSugestaoLotesFefoUseCase(repo),
      inject: [DISPENSACAO_CATALOGO_REPOSITORY_PORT],
    },
    {
      provide: EfetivarDispensacaoUseCase,
      useFactory: (repo: DispensacaoRepositoryPort) =>
        new EfetivarDispensacaoUseCase(repo),
      inject: [DISPENSACAO_REPOSITORY_PORT],
    },
  ],
  exports: [
    CadastrarPacienteUseCase,
    BuscarPacientesUseCase,
    ConsultarHistoricoPacienteUseCase,
    BuscarMedicamentosDispensacaoUseCase,
    ObterSugestaoLotesFefoUseCase,
    EfetivarDispensacaoUseCase,
    PACIENTE_REPOSITORY_PORT,
    DISPENSACAO_CATALOGO_REPOSITORY_PORT,
    DISPENSACAO_REPOSITORY_PORT,
    TypeOrmPacienteRepository,
    TypeOrmDispensacaoCatalogoRepository,
    TypeOrmDispensacaoRepository,
  ],
})
export class DispensacaoModule {}
