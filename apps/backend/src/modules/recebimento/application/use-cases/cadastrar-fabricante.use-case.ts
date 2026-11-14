import type {
  CriarFabricanteRequest,
  FabricanteResponseDto,
} from "@farmaubs/shared";
import type { CatalogoRepositoryPort } from "../../domain/ports/catalogo.repository.port";
import {
  FabricanteCnpjJaExisteException,
  FabricanteDadosInvalidosException,
} from "../../domain/errors/catalogo.errors";

/**
 * [RF008]: Caso de uso puro para cadastro de novos fabricantes e laboratórios produtores.
 */
export class CadastrarFabricanteUseCase {
  constructor(private readonly catalogoRepo: CatalogoRepositoryPort) {}

  /**
   * Executa a validação e o cadastro do fabricante.
   * @param dados - Dados do fabricante a ser criado.
   * @returns Fabricante cadastrado com ID gerado.
   * @throws {FabricanteDadosInvalidosException} Se razão social ou nome fantasia forem inválidos.
   * @throws {FabricanteCnpjJaExisteException} Se o CNPJ informado já estiver em uso.
   */
  async execute(
    dados: CriarFabricanteRequest,
  ): Promise<FabricanteResponseDto> {
    const razaoSocial = dados.razaoSocial?.trim() ?? "";
    if (razaoSocial.length < 3) {
      throw new FabricanteDadosInvalidosException(
        "A razão social deve conter no mínimo 3 caracteres.",
      );
    }

    const nomeFantasia = dados.nomeFantasia?.trim() ?? "";
    if (nomeFantasia.length < 2) {
      throw new FabricanteDadosInvalidosException(
        "O nome fantasia deve conter no mínimo 2 caracteres.",
      );
    }

    let cnpjLimpo: string | null = null;
    if (dados.cnpj) {
      cnpjLimpo = dados.cnpj.replace(/\D/g, "");
      if (cnpjLimpo.length !== 14) {
        throw new FabricanteDadosInvalidosException(
          "O CNPJ deve conter exatamente 14 dígitos numéricos.",
        );
      }

      const existente = await this.catalogoRepo.buscarFabricantePorCnpj(cnpjLimpo);
      if (existente) {
        throw new FabricanteCnpjJaExisteException(cnpjLimpo);
      }
    }

    return this.catalogoRepo.cadastrarFabricante({
      razaoSocial,
      nomeFantasia,
      cnpj: cnpjLimpo,
    });
  }
}
