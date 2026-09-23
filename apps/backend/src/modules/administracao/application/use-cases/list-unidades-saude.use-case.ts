import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { UnidadeSaudeDto } from "@farmaubs/shared";
import {
  REPOSITORIO_UNIDADE_SAUDE_PORT,
  type RepositorioUnidadeSaudePort,
} from "../../domain/ports/unidade-saude.repository.port";

@Injectable()
export class ListUnidadesSaudeUseCase {
  constructor(
    @Inject(REPOSITORIO_UNIDADE_SAUDE_PORT)
    private readonly unidadeSaudeRepo: RepositorioUnidadeSaudePort,
  ) {}

  async executar(municipioId?: string): Promise<UnidadeSaudeDto[]> {
    if (!municipioId || !municipioId.trim()) {
      throw new BadRequestException(
        "O parâmetro 'municipioId' é obrigatório para consulta de unidades de saúde.",
      );
    }

    return this.unidadeSaudeRepo.buscarPorMunicipio(municipioId.trim());
  }
}
