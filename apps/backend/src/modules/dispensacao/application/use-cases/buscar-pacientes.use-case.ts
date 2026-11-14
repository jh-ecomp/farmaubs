import { Inject, Injectable } from "@nestjs/common";
import type { PacienteDto } from "@farmaubs/shared";
import {
  PACIENTE_REPOSITORY_PORT,
  type PacienteRepositoryPort,
} from "../../domain/ports/paciente.repository.port";

@Injectable()
export class BuscarPacientesUseCase {
  constructor(
    @Inject(PACIENTE_REPOSITORY_PORT)
    private readonly pacienteRepository: PacienteRepositoryPort,
  ) {}

  /**
   * Busca pacientes ativos por termo textual (CPF, CNS ou nome completo) para preenchimento ágil no balcão.
   * @param termo Fragmento de CPF, CNS ou nome do paciente.
   * @returns Lista de até 10 pacientes correspondentes.
   */
  async execute(termo?: string): Promise<PacienteDto[]> {
    const termoNormalizado = termo ? termo.trim() : "";
    if (!termoNormalizado) {
      return [];
    }

    return this.pacienteRepository.buscarPorTermo(termoNormalizado, 10);
  }
}

