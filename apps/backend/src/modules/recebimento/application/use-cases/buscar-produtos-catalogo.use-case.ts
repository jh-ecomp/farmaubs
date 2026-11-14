import type { ProdutoCatalogoResponseDto } from "@farmaubs/shared";
import type { CatalogoRepositoryPort } from "../../domain/ports/catalogo.repository.port";
import { TermoBuscaCurtoException } from "../../domain/errors/catalogo.errors";

/**
 * [RF008]: Caso de uso puro para busca textual de medicamentos no catálogo da REMUME.
 */
export class BuscarProdutosCatalogoUseCase {
  constructor(private readonly catalogoRepo: CatalogoRepositoryPort) {}

  /**
   * Executa a busca textual de medicamentos ativos.
   * @param termo - Texto de busca (mínimo 2 caracteres).
   * @returns Lista de produtos correspondentes.
   * @throws {TermoBuscaCurtoException} Se o termo possuir menos de 2 caracteres.
   */
  async execute(termo?: string): Promise<ProdutoCatalogoResponseDto[]> {
    const termoNormalizado = termo?.trim() ?? "";
    if (termoNormalizado.length < 2) {
      throw new TermoBuscaCurtoException();
    }

    return this.catalogoRepo.buscarProdutosPorTermo(termoNormalizado);
  }
}
