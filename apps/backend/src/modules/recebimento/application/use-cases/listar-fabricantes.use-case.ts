import type { FabricanteResponseDto } from "@farmaubs/shared";
import type { CatalogoRepositoryPort } from "../../domain/ports/catalogo.repository.port";

/**
 * [RF008]: Caso de uso puro para listagem dos fabricantes e laboratórios farmacêuticos ativos.
 */
export class ListarFabricantesUseCase {
  constructor(private readonly catalogoRepo: CatalogoRepositoryPort) {}

  /**
   * Lista todos os fabricantes ativos ordenados por nome fantasia.
   * @returns Lista de fabricantes ativos.
   */
  async execute(): Promise<FabricanteResponseDto[]> {
    return this.catalogoRepo.listarFabricantesAtivos();
  }
}
