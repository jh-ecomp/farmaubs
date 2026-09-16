import { TypeOrmUserRepository } from "./typeorm-user.repository";
import { TransactionContext } from "../../../../common/transaction/transaction-context.service";
import { User } from "../../../administracao/infrastructure/persistence/entities/user.entity";
import { UserUnit } from "../../../administracao/infrastructure/persistence/entities/UserUnit.entity";

describe("TypeOrmUserRepository - listar", () => {
  let repository: TypeOrmUserRepository;
  let mockEntityManager: any;
  let mockTransactionContext: any;
  let mockUserQb: any;
  let mockUnitQb: any;

  beforeEach(() => {
    mockUserQb = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
      getRawMany: jest.fn().mockResolvedValue([
        {
          id: "user-uuid-1",
          municipioId: "mun-uuid-1",
          municipioNome: "Parnaíba",
          nomeCompleto: "Carlos Eduardo",
          email: "carlos@farmaubs.gov.br",
          perfilCodigo: "ADMINISTRADOR",
          perfilNome: "Administrador",
          ativo: true,
          ultimoLoginEm: null,
          createdAt: new Date("2026-09-10T10:00:00Z"),
        },
      ]),
    };

    mockUnitQb = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          usuarioId: "user-uuid-1",
          unidadeId: "ubs-uuid-1",
          unidadeNome: "UBS Central",
        },
      ]),
    };

    mockEntityManager = {
      createQueryBuilder: jest.fn().mockImplementation((entity: any) => {
        if (entity === User) return mockUserQb;
        if (entity === UserUnit) return mockUnitQb;
        return mockUserQb;
      }),
    };

    mockTransactionContext = {
      getManager: jest.fn().mockReturnValue(mockEntityManager),
    };

    repository = new TypeOrmUserRepository(
      mockTransactionContext as TransactionContext,
    );
  });

  it("deve listar usuários com paginação padrão e agregar UBSs", async () => {
    const resultado = await repository.listar({ page: 1, limit: 10 });

    expect(mockUserQb.offset).toHaveBeenCalledWith(0);
    expect(mockUserQb.limit).toHaveBeenCalledWith(10);
    expect(mockUserQb.orderBy).toHaveBeenCalledWith("u.created_at", "DESC");
    expect(resultado.total).toBe(1);
    expect(resultado.totalPages).toBe(1);
    expect(resultado.data).toHaveLength(1);
    expect(resultado.data[0].id).toBe("user-uuid-1");
    expect(resultado.data[0].unidades).toEqual([
      { id: "ubs-uuid-1", nome: "UBS Central" },
    ]);
    expect((resultado.data[0] as any).senha_hash).toBeUndefined();
    expect((resultado.data[0] as any).senhaHash).toBeUndefined();
  });

  it("deve aplicar filtros de busca, município, perfil e status ATIVO", async () => {
    await repository.listar({
      page: 2,
      limit: 15,
      busca: "carlos",
      municipioId: "mun-uuid-1",
      perfilId: "ADMINISTRADOR",
      status: "ATIVO",
    });

    expect(mockUserQb.offset).toHaveBeenCalledWith(15);
    expect(mockUserQb.limit).toHaveBeenCalledWith(15);
    expect(mockUserQb.andWhere).toHaveBeenCalledWith(
      "(LOWER(u.nome_completo) LIKE :termo OR LOWER(u.email) LIKE :termo)",
      { termo: "%carlos%" },
    );
    expect(mockUserQb.andWhere).toHaveBeenCalledWith(
      "u.municipio_id = :municipioId",
      { municipioId: "mun-uuid-1" },
    );
    expect(mockUserQb.andWhere).toHaveBeenCalledWith(
      "(u.perfil_id = :perfilValor OR UPPER(p.codigo) = :perfilUpper)",
      { perfilValor: "ADMINISTRADOR", perfilUpper: "ADMINISTRADOR" },
    );
    expect(mockUserQb.andWhere).toHaveBeenCalledWith("u.ativo = :ativo", {
      ativo: true,
    });
  });

  it("deve aplicar filtro de status INATIVO", async () => {
    await repository.listar({ status: "INATIVO" });

    expect(mockUserQb.andWhere).toHaveBeenCalledWith("u.ativo = :ativo", {
      ativo: false,
    });
  });

  it("não deve consultar UBSs se nenhum usuário for retornado na página", async () => {
    mockUserQb.getRawMany.mockResolvedValue([]);
    mockUserQb.getCount.mockResolvedValue(0);

    const resultado = await repository.listar({ page: 1, limit: 10 });

    expect(resultado.total).toBe(0);
    expect(resultado.totalPages).toBe(0);
    expect(resultado.data).toEqual([]);
    expect(mockEntityManager.createQueryBuilder).toHaveBeenCalledTimes(1);
  });
});
