import { BadRequestException, ConflictException } from "@nestjs/common";
import { CatalogoController } from "./catalogo.controller";
import { BuscarProdutosCatalogoUseCase } from "../../application/use-cases/buscar-produtos-catalogo.use-case";
import { ListarFabricantesUseCase } from "../../application/use-cases/listar-fabricantes.use-case";
import { CadastrarFabricanteUseCase } from "../../application/use-cases/cadastrar-fabricante.use-case";
import type { CatalogoRepositoryPort } from "../../domain/ports/catalogo.repository.port";

describe("RE-02 — CatalogoController (Camada C)", () => {
  let controller: CatalogoController;
  let repoMock: jest.Mocked<CatalogoRepositoryPort>;

  beforeEach(() => {
    repoMock = {
      buscarProdutosPorTermo: jest.fn(),
      buscarProdutoPorId: jest.fn(),
      listarFabricantesAtivos: jest.fn(),
      buscarFabricantePorCnpj: jest.fn(),
      cadastrarFabricante: jest.fn(),
    };

    const buscarProdutosUseCase = new BuscarProdutosCatalogoUseCase(repoMock);
    const listarFabricantesUseCase = new ListarFabricantesUseCase(repoMock);
    const cadastrarFabricanteUseCase = new CadastrarFabricanteUseCase(repoMock);

    controller = new CatalogoController(
      buscarProdutosUseCase,
      listarFabricantesUseCase,
      cadastrarFabricanteUseCase,
    );
  });

  it("deve retornar lista de produtos ao buscar por termo válido", async () => {
    repoMock.buscarProdutosPorTermo.mockResolvedValue([
      {
        id: "p1",
        principioAtivo: "Dipirona",
        apresentacao: "500mg",
        categoria: "ANALGESICOS",
        antimicrobiano: false,
        ativo: true,
      },
    ]);

    const res = await controller.buscarProdutos({ termo: "Dipirona" });
    expect(res).toHaveLength(1);
    expect(res[0].principioAtivo).toBe("Dipirona");
  });

  it("deve lançar BadRequestException para busca com termo curto", async () => {
    await expect(controller.buscarProdutos({ termo: "a" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("deve listar fabricantes ativos", async () => {
    repoMock.listarFabricantesAtivos.mockResolvedValue([
      { id: "f1", razaoSocial: "EMS S/A", nomeFantasia: "EMS", ativo: true },
    ]);

    const res = await controller.listarFabricantes();
    expect(res).toHaveLength(1);
    expect(res[0].nomeFantasia).toBe("EMS");
  });

  it("deve cadastrar fabricante com sucesso", async () => {
    repoMock.buscarFabricantePorCnpj.mockResolvedValue(null);
    repoMock.cadastrarFabricante.mockResolvedValue({
      id: "f1",
      razaoSocial: "EMS S/A",
      nomeFantasia: "EMS",
      cnpj: "57507378000101",
      ativo: true,
    });

    const res = await controller.cadastrarFabricante({
      razaoSocial: "EMS S/A",
      nomeFantasia: "EMS",
      cnpj: "57507378000101",
    });

    expect(res.id).toBe("f1");
  });

  it("deve lançar ConflictException para CNPJ duplicado", async () => {
    repoMock.buscarFabricantePorCnpj.mockResolvedValue({
      id: "existente",
      razaoSocial: "EMS S/A",
      nomeFantasia: "EMS",
      cnpj: "57507378000101",
      ativo: true,
    });

    await expect(
      controller.cadastrarFabricante({
        razaoSocial: "EMS S/A",
        nomeFantasia: "EMS",
        cnpj: "57507378000101",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
