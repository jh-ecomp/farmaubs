import { Module } from "@nestjs/common";
import { PacienteController } from "./api/controllers/paciente.controller";
import { CadastrarPacienteUseCase } from "./application/use-cases/cadastrar-paciente.use-case";
import { BuscarPacientesUseCase } from "./application/use-cases/buscar-pacientes.use-case";
import { ConsultarHistoricoPacienteUseCase } from "./application/use-cases/consultar-historico-paciente.use-case";
import { TypeOrmPacienteRepository } from "./infrastructure/adapters/typeorm-paciente.repository";
import { PACIENTE_REPOSITORY_PORT } from "./domain/ports/paciente.repository.port";

@Module({
  controllers: [PacienteController],
  providers: [
    CadastrarPacienteUseCase,
    BuscarPacientesUseCase,
    ConsultarHistoricoPacienteUseCase,
    TypeOrmPacienteRepository,
    {
      provide: PACIENTE_REPOSITORY_PORT,
      useExisting: TypeOrmPacienteRepository,
    },
  ],
  exports: [
    CadastrarPacienteUseCase,
    BuscarPacientesUseCase,
    ConsultarHistoricoPacienteUseCase,
    PACIENTE_REPOSITORY_PORT,
    TypeOrmPacienteRepository,
  ],
})
export class DispensacaoModule {}

