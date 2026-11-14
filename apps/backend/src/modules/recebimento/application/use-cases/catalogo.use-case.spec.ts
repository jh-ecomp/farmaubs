import { BuscarProdutosCatalogoUseCase } from "./buscar-produtos-catalogo.use-case";
import { ListarFabricantesUseCase } from "./listar-fabricantes.use-case";
import { CadastrarFabricanteUseCase } from "./cadastrar-fabricante.use-case";
import type { CatalogoRepositoryPort } from "../../domain/ports/catalogo.repository.port";
import {
  FabricanteCnpjJaExisteException,
  FabricanteDadosInvalidosException,
  TermoBuscaCurtoException,
} from "../../domain/errors/catalogo.errors";

describe("RE-02 — Casos de Uso do Catálogo de Medicamentos e Fabricantes (Camada A)", () => {
  let repoMock: jest.Mocked<CatalogoRepositoryPort>;
  let buscarProdutosUseCase: BuscarProdutosCatalogoUseCase;
  let listarFabricantesUseCase: ListarFabricantesUseCase;
  let cadastrarFabricanteUseCase: CadastrarFabricanteUseCase;

  beforeEach(() => {
    repoMock = {
      buscarProdutosPorTermo: jest.fn(),
      buscarProdutoPorId: jest.fn(),
      listarFabricantesAtivos: jest.fn(),
      buscarFabricantePorCnpj: jest.fn(),
      cadastrarFabricante: jest.fn(),
    };

    buscarProdutosUseCase = new BuscarProdutosCatalogoUseCase(repoMock);
    listarFabricantesUseCase = new ListarFabricantesUseCase(repoMock);
    cadastrarFabricanteUseCase = new CadastrarFabricanteUseCase(repoMock);
  });

  describe("BuscarProdutosCatalogoUseCase", () => {
    it("deve rejeitar termo com menos de 2 caracteres", async () => {
      await expect(buscarProdutosUseCase.execute("a")).rejects.toBeInstanceOf(
        TermoBuscaCurtoException,
      );
      await expect(buscarProdutosUseCase.execute("  ")).rejects.toBeInstanceOf(
        TermoBuscaCurtoException,
      );
      await expect(buscarProdutosUseCase.execute(undefined)).rejects.toBeInstanceOf(
        TermoBuscaCurtoException,
      );
      expect(repoMock.buscarProdutosPorTermo).not.toHaveBeenCalled();
    });

    it("deve retornar lista de medicamentos quando o termo for válido", async () => {
      const mockResult = [
        {
          id: "prod-1",
          nomeComercial: "Amoxil",
          principioAtivo: "Amoxicilina",
          apresentacao: "500mg",
          categoria: "ANTIBIOTICOS",
          antimicrobiano: true,
          ativo: true,
        },
      ];
      repoMock.buscarProdutosPorTermo.mockResolvedValue(mockResult);

      const resultado = await buscarProdutosUseCase.execute("Amox");
      expect(resultado).toEqual(mockResult);
      expect(repoMock.buscarProdutosPorTermo).toHaveBeenCalledWith("Amox");
    });
  });

  describe("ListarFabricantesUseCase", () => {
    it("deve delegar a listagem de fabricantes ativos ao repositório", async () => {
      const mockFab = [
        {
          id: "fab-1",
          razaoSocial: "Eurofarma Laboratórios",
          nomeFantasia: "Eurofarma",
          ativo: true,
        },
      ];
      repoMock.listarFabricantesAtivos.mockResolvedValue(mockFab);

      const resultado = await listarFabricantesUseCase.execute();
      expect(resultado).toEqual(mockFab);
      expect(repoMock.listarFabricantesAtivos).toHaveBeenCalled();
    });
  });

  describe("CadastrarFabricanteUseCase", () => {
    it("deve rejeitar razão social com menos de 3 caracteres", async () => {
      await expect(
        cadastrarFabricanteUseCase.execute({
          razaoSocial: "ab",
          nomeFantasia: "Laboratório",
        }),
      ).rejects.toBeInstanceOf(FabricanteDadosInvalidosException);
    });

    it("deve rejeitar nome fantasia com menos de 2 caracteres", async () => {
      await expect(
        cadastrarFabricanteUseCase.execute({
          razaoSocial: "Laboratório Modelo LTDA",
          nomeFantasia: "a",
        }),
      ).rejects.toBeInstanceOf(FabricanteDadosInvalidosException);
    });

    it("deve rejeitar CNPJ que não tenha 14 dígitos", async () => {
      await expect(
        cadastrarFabricanteUseCase.execute({
          razaoSocial: "Laboratório Modelo LTDA",
          nomeFantasia: "Modelo",
          cnpj: "12345",
        }),
      ).rejects.toBeInstanceOf(FabricanteDadosInvalidosException);
    });

    it("deve rejeitar CNPJ duplicado", async () => {
      repoMock.buscarFabricantePorCnpj.mockResolvedValue({
        id: "fab-existente",
        razaoSocial: "Outro Lab",
        nomeFantasia: "Outro",
        cnpj: "61190096000192",
        ativo: true,
      });

      await expect(
        cadastrarFabricanteUseCase.execute({
          razaoSocial: "Laboratório Modelo LTDA",
          nomeFantasia: "Modelo",
          cnpj: "61.190.096/0001-92",
        }),
      ).rejects.toBeInstanceOf(FabricanteCnpjJaExisteException);
    });

    it("deve cadastrar fabricante com sucesso quando os dados forem válidos", async () => {
      repoMock.buscarFabricantePorCnpj.mockResolvedValue(null);
      repoMock.cadastrarFabricante.mockResolvedValue({
        id: "fab-novo",
        razaoSocial: "Laboratório Modelo LTDA",
        nomeFantasia: "Modelo",
        cnpj: "61190096000192",
        ativo: true,
      });

      const res = await cadastrarFabricanteUseCase.execute({
        razaoSocial: "  Laboratório Modelo LTDA  ",
        nomeFantasia: "  Modelo  ",
        cnpj: "61.190.096/0001-92",
      });

      expect(res.id).toBe("fab-novo");
      expect(repoMock.cadastrarFabricante).toHaveBeenCalledWith({
        razaoSocial: "Laboratório Modelo LTDA",
        nomeFantasia: "Modelo",
        cnpj: "61190096000192",
      });
    });
  });
});
