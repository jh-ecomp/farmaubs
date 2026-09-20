import { defineFeature, loadFeature } from "jest-cucumber";
import * as path from "path";
import { ListUsersUseCase } from "./list-users.use-case";
import type { RepositorioUsuarioPort } from "../../domain/ports/user.repository.port";
import type {
  ListagemUsuariosFiltros,
  ListagemUsuariosResultado,
  UsuarioItemTabela,
} from "@farmaubs/shared";

const feature = loadFeature(path.resolve(__dirname, "list-users.feature"));

defineFeature(feature, (test) => {
  let useCase: ListUsersUseCase;
  let usuarioRepoMock: jest.Mocked<RepositorioUsuarioPort>;
  let resultado: ListagemUsuariosResultado;

  beforeEach(() => {
    usuarioRepoMock = {
      buscarPorEmail: jest.fn(),
      existePorEmail: jest.fn(),
      salvar: jest.fn(),
      listar: jest.fn(),
    } as unknown as jest.Mocked<RepositorioUsuarioPort>;
    useCase = new ListUsersUseCase(usuarioRepoMock);
  });

  test("Solicitação padrão de listagem paginada", ({
    given,
    when,
    then,
    and,
  }) => {
    const usuariosMock: UsuarioItemTabela[] = Array.from({ length: 10 }).map(
      (_, index) => ({
        id: `01919a77-3e15-7000-8000-${String(index + 1).padStart(12, "0")}`,
        municipioId: "01919a77-3e15-7000-8000-000000000001",
        municipioNome: "Parnaíba",
        nomeCompleto: `Usuário Teste ${index + 1}`,
        email: `usuario${index + 1}@farmaubs.gov.br`,
        perfilCodigo: "FARMACEUTICO_RESPONSAVEL",
        perfilNome: "Farmacêutico Responsável",
        unidades: [
          {
            id: "01919a77-3e15-7000-8000-000000000010",
            nome: "UBS Central",
          },
        ],
        ativo: true,
        ultimoLoginEm: null,
        createdAt: new Date("2026-09-10T10:00:00.000Z"),
      }),
    );

    given("que existem 25 usuários cadastrados no repositório", () => {
      usuarioRepoMock.listar.mockResolvedValue({
        data: usuariosMock,
        total: 25,
        page: 1,
        limit: 10,
        totalPages: 3,
      });
    });

    when("o caso de uso for executado sem parâmetros adicionais", async () => {
      resultado = await useCase.executar();
    });

    then("o resultado deve conter o total de 25 usuários", () => {
      expect(resultado.total).toBe(25);
    });

    and("a página atual deve ser 1", () => {
      expect(resultado.page).toBe(1);
    });

    and("o limite deve ser 10", () => {
      expect(resultado.limit).toBe(10);
    });

    and("o total de páginas deve ser 3", () => {
      expect(resultado.totalPages).toBe(3);
    });

    and("a lista retornada deve conter 10 usuários", () => {
      expect(resultado.data).toHaveLength(10);
    });

    and('nenhum usuário deve conter o campo "senha_hash"', () => {
      for (const usuario of resultado.data) {
        expect((usuario as any).senha_hash).toBeUndefined();
        expect((usuario as any).senhaHash).toBeUndefined();
      }
    });
  });

  test("Filtragem por município e status ativo", ({
    given,
    when,
    then,
    and,
  }) => {
    const municipioIdFiltrado = "11111111-1111-1111-1111-111111111111";
    const usuariosFiltrados: UsuarioItemTabela[] = [
      {
        id: "01919a77-3e15-7000-8000-000000000001",
        municipioId: municipioIdFiltrado,
        municipioNome: "Parnaíba",
        nomeCompleto: "Carlos Silva",
        email: "carlos@farmaubs.gov.br",
        perfilCodigo: "GESTOR",
        perfilNome: "Gestor",
        unidades: [],
        ativo: true,
        ultimoLoginEm: null,
        createdAt: new Date(),
      },
    ];

    given('que existem usuários em "Parnaíba" e "Teresina"', () => {
      usuarioRepoMock.listar.mockResolvedValue({
        data: usuariosFiltrados,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    when(
      /^o caso de uso for executado com município "(.*)" e status "(.*)"$/,
      async (municipioId: string, status: string) => {
        resultado = await useCase.executar({ municipioId, status });
      },
    );

    then(
      /^o repositório deve ser consultado com o filtro de município "(.*)" e status "(.*)"$/,
      (municipioId: string, status: string) => {
        expect(usuarioRepoMock.listar).toHaveBeenCalledWith(
          expect.objectContaining({
            municipioId,
            status,
          }),
        );
      },
    );

    and(
      "todos os usuários retornados devem ser do município filtrado e estar ativos",
      () => {
        expect(
          resultado.data.every((u) => u.municipioId === municipioIdFiltrado),
        ).toBe(true);
        expect(resultado.data.every((u) => u.ativo === true)).toBe(true);
      },
    );
  });

  test("Busca parcial textual por nome ou e-mail", ({
    given,
    when,
    then,
    and,
  }) => {
    const usuarioMariana: UsuarioItemTabela = {
      id: "01919a77-3e15-7000-8000-000000000099",
      municipioId: "01919a77-3e15-7000-8000-000000000001",
      municipioNome: "Parnaíba",
      nomeCompleto: "Dra. Mariana Vasconcelos",
      email: "mariana.vasconcelos@farmaubs.gov.br",
      perfilCodigo: "FARMACEUTICO_RESPONSAVEL",
      perfilNome: "Farmacêutico Responsável",
      unidades: [],
      ativo: true,
      ultimoLoginEm: null,
      createdAt: new Date(),
    };

    given(/^que existe o usuário "(.*)" com e-mail "(.*)"$/, () => {
      usuarioRepoMock.listar.mockResolvedValue({
        data: [usuarioMariana],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    when(
      /^o caso de uso for executado com o termo de busca "(.*)"$/,
      async (termo: string) => {
        resultado = await useCase.executar({ busca: termo });
      },
    );

    then(
      /^o repositório deve ser consultado com o termo de busca "(.*)"$/,
      (termo: string) => {
        expect(usuarioRepoMock.listar).toHaveBeenCalledWith(
          expect.objectContaining({
            busca: termo,
          }),
        );
      },
    );

    and(
      /^o usuário "(.*)" deve constar no resultado$/,
      (nomeEsperado: string) => {
        expect(
          resultado.data.some((u) => u.nomeCompleto === nomeEsperado),
        ).toBe(true);
      },
    );
  });

  test("Normalização de limites de paginação extremos", ({
    given,
    when,
    then,
  }) => {
    given("que o repositório possui usuários cadastrados", () => {
      usuarioRepoMock.listar.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 100,
        totalPages: 0,
      });
    });

    when(
      "o caso de uso for executado com página menor que 1 e limite maior que 100",
      async () => {
        await useCase.executar({ page: -5, limit: 999 });
      },
    );

    then(
      "o caso de uso deve normalizar a página para 1 e o limite para 100",
      () => {
        expect(usuarioRepoMock.listar).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 1,
            limit: 100,
          }),
        );
      },
    );
  });
});
