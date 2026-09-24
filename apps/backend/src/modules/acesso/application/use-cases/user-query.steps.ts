import { defineFeature, loadFeature } from "jest-cucumber";
import * as path from "path";
import { ListUsersUseCase } from "./list-users.use-case";
import { GetUserByIdUseCase } from "./get-user-by-id.use-case";
import type { RepositorioUsuarioPort } from "../../domain/ports/user.repository.port";
import { UsuarioNaoEncontradoException } from "../../domain/errors/user-management.errors";
import type {
  ListagemUsuariosResultado,
  UsuarioDetalheDto,
  UsuarioItemTabela,
  UsuarioItemListaDto,
} from "@farmaubs/shared";

const feature = loadFeature(path.resolve(__dirname, "user-query.feature"));

defineFeature(feature, (test) => {
  let listUsersUseCase: ListUsersUseCase;
  let getUserByIdUseCase: GetUserByIdUseCase;
  let usuarioRepoMock: jest.Mocked<RepositorioUsuarioPort>;
  let listagemResultado: ListagemUsuariosResultado;
  let detalheResultado: UsuarioDetalheDto;
  let erroCapturado: any;

  beforeEach(() => {
    usuarioRepoMock = {
      buscarPorEmail: jest.fn(),
      buscarPorId: jest.fn(),
      buscarDetalhesPorId: jest.fn(),
      buscarUbsIds: jest.fn(),
      existePorEmail: jest.fn(),
      salvar: jest.fn(),
      listar: jest.fn(),
      atualizarDados: jest.fn(),
      atualizarPerfilEUbs: jest.fn(),
      atualizarStatus: jest.fn(),
      atualizarSenhaProvisoria: jest.fn(),
      contarAdministradoresAtivos: jest.fn(),
      buscarSenhaHashPorId: jest.fn(),
      concluirTrocaDeSenha: jest.fn(),
    } as unknown as jest.Mocked<RepositorioUsuarioPort>;

    listUsersUseCase = new ListUsersUseCase(usuarioRepoMock);
    getUserByIdUseCase = new GetUserByIdUseCase(usuarioRepoMock);
    erroCapturado = null;
  });

  test("Listagem paginada padrão com contagem correta", ({
    given,
    when,
    then,
    and,
  }) => {
    given("que existem 25 usuários cadastrados no repositório", () => {
      const itensMock: UsuarioItemListaDto[] = Array.from({ length: 10 }).map(
        (_, i) => ({
          id: `uuid-${i + 1}`,
          nomeCompleto: `Usuário ${i + 1}`,
          email: `usuario${i + 1}@ubs.gov.br`,
          perfilCodigo: "ADMINISTRADOR",
          perfilNome: "Administrador",
          municipioId: "mun-1",
          municipioNome: "Santos",
          ativo: true,
          deveTrocarSenha: false,
          totalUbsAssociadas: 1,
          criadoEm: new Date(),
        }),
      );

      const dataMock: UsuarioItemTabela[] = itensMock.map((u) => ({
        id: u.id,
        municipioId: u.municipioId,
        municipioNome: u.municipioNome,
        nomeCompleto: u.nomeCompleto,
        email: u.email,
        perfilCodigo: u.perfilCodigo,
        perfilNome: u.perfilNome,
        unidades: [],
        ativo: u.ativo,
        createdAt: new Date(),
      }));

      usuarioRepoMock.listar.mockResolvedValue({
        data: dataMock,
        total: 25,
        page: 1,
        limit: 10,
        totalPages: 3,
        itens: itensMock,
        totalItens: 25,
        pagina: 1,
        limite: 10,
        totalPaginas: 3,
      });
    });

    when(
      /^o caso de uso ListUsersUseCase for executado com página (\d+) e limite (\d+)$/,
      async (pagina: string, limite: string) => {
        listagemResultado = await listUsersUseCase.executar({
          pagina: Number(pagina),
          limite: Number(limite),
        });
      },
    );

    then(/^o resultado deve conter (\d+) itens$/, (quantidade: string) => {
      const total = (listagemResultado.itens ?? listagemResultado.data).length;
      expect(total).toBe(Number(quantidade));
    });

    and(/^o total de itens deve ser (\d+)$/, (totalItens: string) => {
      const total = listagemResultado.totalItens ?? listagemResultado.total;
      expect(total).toBe(Number(totalItens));
    });

    and(/^o total de páginas deve ser (\d+)$/, (totalPaginas: string) => {
      const total =
        listagemResultado.totalPaginas ?? listagemResultado.totalPages;
      expect(total).toBe(Number(totalPaginas));
    });
  });

  test("Filtro combinado de busca textual e município", ({
    given,
    and,
    when,
    then,
  }) => {
    const santosId = "santos-uuid";

    given('que existem usuários em "Santos" e em "São Paulo"', () => {
      // Setup de contexto
    });

    and(
      /^o usuário "(.*)" pertence a "(.*)" com e-mail "(.*)"$/,
      (nome: string, municipio: string, email: string) => {
        usuarioRepoMock.listar.mockImplementation(async (filtros) => {
          if (
            (filtros.busca === "carlos" || filtros.termoBusca === "carlos") &&
            filtros.municipioId === santosId
          ) {
            return {
              data: [
                {
                  id: "carlos-uuid",
                  municipioId: santosId,
                  municipioNome: municipio,
                  nomeCompleto: nome,
                  email: email,
                  perfilCodigo: "ADMINISTRADOR",
                  unidades: [],
                  ativo: true,
                  createdAt: new Date(),
                },
              ],
              total: 1,
              page: 1,
              limit: 10,
              totalPages: 1,
              itens: [
                {
                  id: "carlos-uuid",
                  nomeCompleto: nome,
                  email: email,
                  perfilCodigo: "ADMINISTRADOR",
                  perfilNome: "Administrador",
                  municipioId: santosId,
                  municipioNome: municipio,
                  ativo: true,
                  deveTrocarSenha: false,
                  totalUbsAssociadas: 0,
                  criadoEm: new Date(),
                },
              ],
              totalItens: 1,
              pagina: 1,
              limite: 10,
              totalPaginas: 1,
            };
          }
          return {
            data: [],
            total: 0,
            page: 1,
            limit: 10,
            totalPages: 0,
            itens: [],
            totalItens: 0,
            pagina: 1,
            limite: 10,
            totalPaginas: 0,
          };
        });
      },
    );

    when(
      /^o Administrador buscar pelo termo "(.*)" filtrando pelo ID de "(.*)"$/,
      async (termo: string, _municipio: string) => {
        listagemResultado = await listUsersUseCase.executar({
          termoBusca: termo,
          municipioId: santosId,
        });
      },
    );

    then(
      /^apenas o usuário "(.*)" deve ser retornado$/,
      (nomeEsperado: string) => {
        const itens = listagemResultado.itens ?? listagemResultado.data;
        expect(itens).toHaveLength(1);
        expect(itens[0].nomeCompleto).toBe(nomeEsperado);
      },
    );
  });

  test("Consulta de detalhe de usuário por ID com sucesso", ({
    given,
    and,
    when,
    then,
  }) => {
    const usuarioMock: UsuarioDetalheDto = {
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      nomeCompleto: "Carlos Eduardo",
      email: "carlos@santos.gov.br",
      ativo: true,
      deveTrocarSenha: false,
      municipio: {
        id: "santos-uuid",
        nome: "Santos",
        uf: "SP",
      },
      perfil: {
        id: "perfil-admin-uuid",
        codigo: "ADMINISTRADOR",
        nome: "Administrador",
      },
      unidadesSaude: [
        {
          id: "ubs-1",
          cnes: "2401824",
          nome: "UBS Gonzaga",
          ativo: true,
        },
        {
          id: "ubs-2",
          cnes: "2401832",
          nome: "UBS Boqueirão",
          ativo: true,
        },
      ],
      ultimoLoginEm: null,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    };

    given(/^que existe um usuário com ID "(.*)"$/, (_id: string) => {
      usuarioRepoMock.buscarDetalhesPorId.mockResolvedValue(usuarioMock);
    });

    and(/^o usuário possui (\d+) UBSs vinculadas$/, (qtd: string) => {
      expect(usuarioMock.unidadesSaude).toHaveLength(Number(qtd));
    });

    when(
      /^o caso de uso GetUserByIdUseCase for executado com o ID "(.*)"$/,
      async (id: string) => {
        detalheResultado = await getUserByIdUseCase.executar(id);
      },
    );

    then("os detalhes do usuário devem ser retornados com sucesso", () => {
      expect(detalheResultado).toBeDefined();
      expect(detalheResultado.id).toBe("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    });

    and(
      /^a lista de UBSs vinculadas deve conter (\d+) unidades$/,
      (qtd: string) => {
        expect(detalheResultado.unidadesSaude).toHaveLength(Number(qtd));
      },
    );

    and("a senha hash não deve estar presente no resultado", () => {
      expect((detalheResultado as any).senha_hash).toBeUndefined();
      expect((detalheResultado as any).senhaHash).toBeUndefined();
      expect((detalheResultado as any).password_hash).toBeUndefined();
    });
  });

  test("Consulta de usuário por ID inexistente", ({ given, when, then }) => {
    given(/^que não existe um usuário com ID "(.*)"$/, (_id: string) => {
      usuarioRepoMock.buscarDetalhesPorId.mockResolvedValue(null);
    });

    when(
      /^o caso de uso GetUserByIdUseCase for executado com o ID "(.*)"$/,
      async (id: string) => {
        try {
          await getUserByIdUseCase.executar(id);
        } catch (err) {
          erroCapturado = err;
        }
      },
    );

    then("uma exceção UsuarioNaoEncontradoException deve ser lançada", () => {
      expect(erroCapturado).toBeInstanceOf(UsuarioNaoEncontradoException);
    });
  });
});
