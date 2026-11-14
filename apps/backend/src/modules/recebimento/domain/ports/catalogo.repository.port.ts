import type {
  CriarFabricanteRequest,
  FabricanteResponseDto,
  ProdutoCatalogoResponseDto,
} from "@farmaubs/shared";

export const CATALOGO_REPOSITORY_PORT = Symbol("CATALOGO_REPOSITORY_PORT");

/**
 * [RF008]: Porta de repositório para busca no catálogo de medicamentos e fabricantes.
 */
export interface CatalogoRepositoryPort {
  /**
   * Busca medicamentos ativos no catálogo por termo parcial (princípio ativo, nome comercial ou apresentação).
   * @param termo - Texto de busca com no mínimo 2 caracteres.
   * @returns Lista de produtos encontrados no catálogo.
   */
  buscarProdutosPorTermo(termo: string): Promise<ProdutoCatalogoResponseDto[]>;

  /**
   * Obtém um produto específico pelo identificador único.
   * @param id - Identificador UUID do produto.
   * @returns Produto encontrado ou null.
   */
  buscarProdutoPorId(id: string): Promise<ProdutoCatalogoResponseDto | null>;

  /**
   * Lista todos os fabricantes ativos cadastrados ordenados por nome fantasia.
   * @returns Lista de fabricantes ativos.
   */
  listarFabricantesAtivos(): Promise<FabricanteResponseDto[]>;

  /**
   * Busca um fabricante por seu CNPJ (apenas dígitos).
   * @param cnpj - CNPJ de 14 dígitos.
   * @returns Fabricante ou null se não existir.
   */
  buscarFabricantePorCnpj(cnpj: string): Promise<FabricanteResponseDto | null>;

  /**
   * Cadastra um novo laboratório/fabricante produtor de medicamentos.
   * @param dados - Dados cadastrais do fabricante.
   * @returns Fabricante criado e persistido.
   */
  cadastrarFabricante(
    dados: CriarFabricanteRequest,
  ): Promise<FabricanteResponseDto>;
}
