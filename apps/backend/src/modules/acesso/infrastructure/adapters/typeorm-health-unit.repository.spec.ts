import { TypeOrmHealthUnitRepository } from "./typeorm-health-unit.repository";
import type { TransactionContext } from "../../../../common/transaction/transaction-context.service";
import { UnidadeSaudeEntity } from "../../../administracao/infrastructure/persistence/entities/unidade-saude.entity";

describe("TypeOrmHealthUnitRepository", () => {
  let repository: TypeOrmHealthUnitRepository;
  let mockManager: { find: jest.Mock; createQueryBuilder: jest.Mock };
  let mockTransactionContext: { getManager: jest.Mock };

  beforeEach(() => {
    mockManager = {
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    mockTransactionContext = {
      getManager: jest.fn().mockReturnValue(mockManager),
    };

    repository = new TypeOrmHealthUnitRepository(
      mockTransactionContext as unknown as TransactionContext,
    );
  });

  describe("buscarPorMunicipio", () => {
    it("deve buscar UBSs pertencentes ao municipioId ordenadas por nome e mapear para UnidadeSaudeDto", async () => {
      const municipioId = "01a06db9-c4af-7944-8ec5-c9b9443b054e";
      const mockEntities = [
        {
          id: "ubs-1",
          municipio_id: municipioId,
          nome: "UBS Centro de Saúde Dr. Pedro",
          endereco: "Av. Bucar Neto, 100",
          responsavel_tecnico: "Dra. Maria Santos",
          caf_lead_time_days: 10,
        },
        {
          id: "ubs-2",
          municipio_id: municipioId,
          nome: "UBS Viazul",
          endereco: null,
          responsavel_tecnico: null,
          caf_lead_time_days: 15,
        },
      ];

      mockManager.find.mockResolvedValue(mockEntities);

      const resultado = await repository.buscarPorMunicipio(municipioId);

      expect(mockTransactionContext.getManager).toHaveBeenCalledTimes(1);
      expect(mockManager.find).toHaveBeenCalledWith(UnidadeSaudeEntity, {
        where: { municipio_id: municipioId },
        order: { nome: "ASC" },
      });

      expect(resultado).toEqual([
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
          endereco: "",
          responsavelTecnico: null,
          cafLeadTimeDays: 15,
        },
      ]);
    });
  });

  describe("buscarIdsExistentes", () => {
    it("deve retornar vazio se a lista de IDs for vazia", async () => {
      const resultado = await repository.buscarIdsExistentes([]);
      expect(resultado).toEqual([]);
      expect(mockTransactionContext.getManager).not.toHaveBeenCalled();
    });

    it("deve buscar IDs existentes usando createQueryBuilder", async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ id: "ubs-1" }]),
      };
      mockManager.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const resultado = await repository.buscarIdsExistentes(
        ["ubs-1", "ubs-2"],
        "muni-1",
      );

      expect(mockManager.createQueryBuilder).toHaveBeenCalledWith(
        UnidadeSaudeEntity,
        "ubs",
      );
      expect(mockQueryBuilder.select).toHaveBeenCalledWith("ubs.id", "id");
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "ubs.id IN (:...unidadesIds)",
        { unidadesIds: ["ubs-1", "ubs-2"] },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "ubs.municipio_id = :municipioId",
        { municipioId: "muni-1" },
      );
      expect(resultado).toEqual(["ubs-1"]);
    });
  });
});
