import { Inject, Injectable } from "@nestjs/common";
import type { MunicipioDto } from "@farmaubs/shared";
import {
  REPOSITORIO_MUNICIPIO_PORT,
  type RepositorioMunicipioPort,
} from "../../domain/ports/municipio.repository.port";

@Injectable()
export class ListMunicipiosUseCase {
  constructor(
    @Inject(REPOSITORIO_MUNICIPIO_PORT)
    private readonly municipioRepo: RepositorioMunicipioPort,
  ) {}

  async executar(): Promise<MunicipioDto[]> {
    return this.municipioRepo.listarAtivos();
  }
}
