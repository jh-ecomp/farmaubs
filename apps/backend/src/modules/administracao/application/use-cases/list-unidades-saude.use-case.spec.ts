import { BadRequestException } from "@nestjs/common";
import { ListUnidadesSaudeUseCase } from "./list-unidades-saude.use-case";
import type { RepositorioUnidadeSaudePort } from "../../domain/ports/unidade-saude.repository.port";
import type { UnidadeSaudeDto } from "@farmaubs/shared";

describe("ListUnidadesSaudeUseCase", () => {
  let useCase: ListUnidadesSaudeUseCase;
  let unidadeSaudeRepoMock: jest.Mocked<RepositorioUnidadeSaudePort>;

  const municipioId = "01a06db9-c4af-7944-8ec5-c9b9443b054e";
  const mockUnidades: UnidadeSaudeDto[] = [
    {
      id: "ubs-1",
      municipioId,
      nome: "UBS Centro de Saúde Dr. Pedro",
      endereco: "Av. Bucar Neto, 100",
      responsavelTecnico: "Dra. Maria Santos",
      cafLeadTimeDays: 10,
    },
    {
      id: "ubs-2",
      municipioId,
      nome: "UBS Viazul",
      endereco: "Rua Projetada, 45",
      responsavelTecnico: null,
      cafLeadTimeDays: 15,
    },
  ];

  beforeEach(() => {
    unidadeSaudeRepoMock = {
      buscarPorMunicipio: jest.fn().mockResolvedValue(mockUnidades),
    };
    useCase = new ListUnidadesSaudeUseCase(unidadeSaudeRepoMock);
  });

  it("deve retornar unidades de saúde para um municipioId válido", async () => {
    const resultado = await useCase.executar(municipioId);

    expect(unidadeSaudeRepoMock.buscarPorMunicipio).toHaveBeenCalledWith(
      municipioId,
    );
    expect(resultado).toEqual(mockUnidades);
    expect(resultado).toHaveLength(2);
  });

  it("deve lançar BadRequestException se municipioId for undefined ou vazio", async () => {
    await expect(useCase.executar(undefined)).rejects.toThrow(
      new BadRequestException(
        "O parâmetro 'municipioId' é obrigatório para consulta de unidades de saúde.",
      ),
    );

    await expect(useCase.executar("")).rejects.toThrow(
      new BadRequestException(
        "O parâmetro 'municipioId' é obrigatório para consulta de unidades de saúde.",
      ),
    );

    await expect(useCase.executar("   ")).rejects.toThrow(
      new BadRequestException(
        "O parâmetro 'municipioId' é obrigatório para consulta de unidades de saúde.",
      ),
    );

    expect(unidadeSaudeRepoMock.buscarPorMunicipio).not.toHaveBeenCalled();
  });
});
