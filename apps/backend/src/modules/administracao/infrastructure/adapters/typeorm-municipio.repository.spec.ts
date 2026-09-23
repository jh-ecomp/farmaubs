import { TypeOrmMunicipioRepository } from "./typeorm-municipio.repository";
import type { TransactionContext } from "../../../../common/transaction/transaction-context.service";
import { MunicipioEntity } from "../persistence/entities/municipio.entity";

describe("TypeOrmMunicipioRepository", () => {
  let repository: TypeOrmMunicipioRepository;
  let mockManager: { find: jest.Mock };
  let mockTransactionContext: { getManager: jest.Mock };

  beforeEach(() => {
    mockManager = {
      find: jest.fn(),
    };
    mockTransactionContext = {
      getManager: jest.fn().mockReturnValue(mockManager),
    };

    repository = new TypeOrmMunicipioRepository(
      mockTransactionContext as unknown as TransactionContext,
    );
  });

  it("deve buscar municípios ativos com ordenação alfabética por nome e mapear para MunicipioDto", async () => {
    const mockEntities = [
      {
        id: "m-1",
        nome: "Floriano",
        uf: "PI",
        codigo_ibge: "2203907",
        ativo: true,
      },
      {
        id: "m-2",
        nome: "Teresina",
        uf: "PI",
        codigo_ibge: "2211001",
        ativo: true,
      },
    ];

    mockManager.find.mockResolvedValue(mockEntities);

    const resultado = await repository.listarAtivos();

    expect(mockTransactionContext.getManager).toHaveBeenCalledTimes(1);
    expect(mockManager.find).toHaveBeenCalledWith(MunicipioEntity, {
      where: { ativo: true },
      order: { nome: "ASC" },
    });

    expect(resultado).toEqual([
      {
        id: "m-1",
        nome: "Floriano",
        uf: "PI",
        ibgeCode: "2203907",
      },
      {
        id: "m-2",
        nome: "Teresina",
        uf: "PI",
        ibgeCode: "2211001",
      },
    ]);
  });
});
