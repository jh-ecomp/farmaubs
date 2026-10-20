import { Module } from "@nestjs/common";
import { PacienteController } from "./api/controllers/paciente.controller";
import { DispensacaoCatalogoController } from "./api/controllers/dispensacao-catalogo.controller";
import { CadastrarPacienteUseCase } from "./application/use-cases/cadastrar-paciente.use-case";
import { BuscarPacientesUseCase } from "./application/use-cases/buscar-pacientes.use-case";
import { ConsultarHistoricoPacienteUseCase } from "./application/use-cases/consultar-historico-paciente.use-case";
import { BuscarMedicamentosDispensacaoUseCase } from "./application/use-cases/buscar-medicamentos-dispensacao.use-case";
import { ObterSugestaoLotesFefoUseCase } from "./application/use-cases/obter-sugestao-lotes-fefo.use-case";
import { TypeOrmPacienteRepository } from "./infrastructure/adapters/typeorm-paciente.repository";
import { TypeOrmDispensacaoCatalogoRepository } from "./infrastructure/adapters/typeorm-dispensacao-catalogo.repository";
import { PACIENTE_REPOSITORY_PORT } from "./domain/ports/paciente.repository.port";
import {
  DISPENSACAO_CATALOGO_REPOSITORY_PORT,
  type DispensacaoCatalogoRepositoryPort,
} from "./domain/ports/dispensacao-catalogo.repository.port";

@Module({
  controllers: [PacienteController, DispensacaoCatalogoController],
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
  ],
  exports: [
    CadastrarPacienteUseCase,
    BuscarPacientesUseCase,
    ConsultarHistoricoPacienteUseCase,
    BuscarMedicamentosDispensacaoUseCase,
    ObterSugestaoLotesFefoUseCase,
    PACIENTE_REPOSITORY_PORT,
    DISPENSACAO_CATALOGO_REPOSITORY_PORT,
    TypeOrmPacienteRepository,
    TypeOrmDispensacaoCatalogoRepository,
  ],
})
export class DispensacaoModule {}
