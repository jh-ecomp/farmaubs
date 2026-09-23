import { ListMunicipiosUseCase } from "./list-municipios.use-case";
import type { RepositorioMunicipioPort } from "../../domain/ports/municipio.repository.port";
import type { MunicipioDto } from "@farmaubs/shared";

describe("ListMunicipiosUseCase", () => {
  let useCase: ListMunicipiosUseCase;
  let municipioRepoMock: jest.Mocked<RepositorioMunicipioPort>;

  const mockMunicipios: MunicipioDto[] = [
    {
      id: "01a06db9-c4af-7944-8ec5-c9b9443b054e",
      nome: "Floriano",
      uf: "PI",
      ibgeCode: "2203907",
    },
    {
      id: "01919a77-3e15-7000-8000-000000000001",
      nome: "Parnaíba",
      uf: "PI",
      ibgeCode: "2207700",
    },
    {
      id: "01919a77-3e15-7000-8000-000000000002",
      nome: "Teresina",
      uf: "PI",
      ibgeCode: "2211001",
    },
  ];

  beforeEach(() => {
    municipioRepoMock = {
      listarAtivos: jest.fn().mockResolvedValue(mockMunicipios),
    };
    useCase = new ListMunicipiosUseCase(municipioRepoMock);
  });

  it("deve retornar listagem de municípios ativos ordenados alfabeticamente", async () => {
    const resultado = await useCase.executar();

    expect(municipioRepoMock.listarAtivos).toHaveBeenCalledTimes(1);
    expect(resultado).toEqual(mockMunicipios);
    expect(resultado).toHaveLength(3);
    expect(resultado[0].nome).toBe("Floriano");
  });

  it("deve propagar erro caso o repositório falhe", async () => {
    municipioRepoMock.listarAtivos.mockRejectedValue(
      new Error("Erro de conexão no banco de dados"),
    );

    await expect(useCase.executar()).rejects.toThrow(
      "Erro de conexão no banco de dados",
    );
  });
});
