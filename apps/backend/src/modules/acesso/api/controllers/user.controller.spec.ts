import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserController } from "./user.controller";
import { CadastrarUsuarioUseCase } from "../../application/use-cases/register-user.use-case";
import { ListUsersUseCase } from "../../application/use-cases/list-users.use-case";
import { CadastrarUsuarioDto } from "../dto/create-user.dto";
import { ListUsersQueryDto } from "../dto/list-users-query.dto";
import {
  DadosUsuarioInvalidosException,
  PerfilNaoEncontradoException,
  UnidadeSaudeInvalidaException,
  UsuarioEmailJaExisteException,
} from "../../domain/errors/user-registration.errors";
import { RolesGuard } from "../../../../common/guards/roles.guard";
import { REPOSITORIO_PERFIL_PORT } from "../../domain/ports/profile.repository.port";

describe("UserController", () => {
  let controller: UserController;
  let useCaseMock: jest.Mocked<CadastrarUsuarioUseCase>;
  let listUsersUseCaseMock: jest.Mocked<ListUsersUseCase>;
  let perfilRepoMock: { buscarPorId: jest.Mock };

  const dtoValido: CadastrarUsuarioDto = {
    municipioId: "01919a77-3e15-7000-8000-000000000001",
    nomeCompleto: "Carlos Eduardo da Silva",
    email: "carlos.silva@ubs.gov.br",
    senha: "SenhaForte#2026",
    perfil: "FARMACEUTICO",
    ubsIds: ["01919a77-3e15-7000-8000-000000000010"],
  };

  beforeEach(async () => {
    useCaseMock = {
      executar: jest.fn(),
    } as unknown as jest.Mocked<CadastrarUsuarioUseCase>;

    listUsersUseCaseMock = {
      executar: jest.fn(),
    } as unknown as jest.Mocked<ListUsersUseCase>;

    perfilRepoMock = {
      buscarPorId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: CadastrarUsuarioUseCase,
          useValue: useCaseMock,
        },
        {
          provide: ListUsersUseCase,
          useValue: listUsersUseCaseMock,
        },
        {
          provide: REPOSITORIO_PERFIL_PORT,
          useValue: perfilRepoMock,
        },
        RolesGuard,
        Reflector,
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it("deve cadastrar usuário com sucesso retornando status 201 e dados do usuário", async () => {
    const dataCriacao = new Date("2026-09-10T12:00:00.000Z");
    const mockResultado = {
      id: "01919a77-3e15-7000-8000-000000000020",
      municipioId: dtoValido.municipioId,
      nomeCompleto: dtoValido.nomeCompleto,
      email: dtoValido.email,
      perfilId: "01919a77-3e15-7000-8000-000000000005",
      ativo: true,
      deveTrocarSenha: true,
      ubsIds: dtoValido.ubsIds,
      criadoEm: dataCriacao,
      createdAt: dataCriacao,
    };

    useCaseMock.executar.mockResolvedValue(mockResultado);

    const resultado = await controller.cadastrar(dtoValido);

    expect(useCaseMock.executar).toHaveBeenCalledWith(dtoValido);
    expect(resultado).toEqual(mockResultado);
  });

  it("deve converter UsuarioEmailJaExisteException em ConflictException (409)", async () => {
    useCaseMock.executar.mockRejectedValue(
      new UsuarioEmailJaExisteException(dtoValido.email),
    );

    await expect(controller.cadastrar(dtoValido)).rejects.toThrow(
      ConflictException,
    );
  });

  it("deve converter PerfilNaoEncontradoException em NotFoundException (404)", async () => {
    useCaseMock.executar.mockRejectedValue(
      new PerfilNaoEncontradoException("INEXISTENTE"),
    );

    await expect(controller.cadastrar(dtoValido)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("deve converter UnidadeSaudeInvalidaException em BadRequestException (400)", async () => {
    useCaseMock.executar.mockRejectedValue(
      new UnidadeSaudeInvalidaException("UBS inválida"),
    );

    await expect(controller.cadastrar(dtoValido)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("deve converter DadosUsuarioInvalidosException em BadRequestException (400)", async () => {
    useCaseMock.executar.mockRejectedValue(
      new DadosUsuarioInvalidosException("Nome obrigatório"),
    );

    await expect(controller.cadastrar(dtoValido)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("deve propagar erros inesperados sem mascarar", async () => {
    useCaseMock.executar.mockRejectedValue(new Error("Erro de banco de dados"));

    await expect(controller.cadastrar(dtoValido)).rejects.toThrow(
      "Erro de banco de dados",
    );
  });

  describe("GET /api/v1/usuarios (listar)", () => {
    it("deve listar usuários com sucesso retornando resultado paginado", async () => {
      const mockResultado = {
        data: [
          {
            id: "01919a77-3e15-7000-8000-000000000001",
            municipioId: "01919a77-3e15-7000-8000-000000000001",
            municipioNome: "Parnaíba",
            nomeCompleto: "Carlos Eduardo",
            email: "carlos@farmaubs.gov.br",
            perfilCodigo: "ADMINISTRADOR",
            perfilNome: "Administrador",
            unidades: [],
            ativo: true,
            ultimoLoginEm: null,
            createdAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      listUsersUseCaseMock.executar.mockResolvedValue(mockResultado);

      const query: ListUsersQueryDto = { page: 1, limit: 10 };
      const resultado = await controller.listar(query);

      expect(listUsersUseCaseMock.executar).toHaveBeenCalledWith(query);
      expect(resultado).toEqual(mockResultado);
    });

    it("deve repassar filtros opcionais para o caso de uso", async () => {
      listUsersUseCaseMock.executar.mockResolvedValue({
        data: [],
        total: 0,
        page: 2,
        limit: 20,
        totalPages: 0,
      });

      const query: ListUsersQueryDto = {
        page: 2,
        limit: 20,
        busca: "mariana",
        municipioId: "01919a77-3e15-7000-8000-000000000001",
        perfilId: "ADMINISTRADOR",
        status: "ATIVO",
      };

      await controller.listar(query);

      expect(listUsersUseCaseMock.executar).toHaveBeenCalledWith(query);
    });
  });

  describe("RolesGuard (RBAC no endpoint de listagem)", () => {
    let guard: RolesGuard;
    let reflector: Reflector;

    beforeEach(() => {
      reflector = new Reflector();
      guard = new RolesGuard(reflector, perfilRepoMock as any);
    });

    function criarMockContext(sessao?: any): any {
      return {
        getHandler: () => controller.listar,
        getClass: () => UserController,
        getType: () => "http",
        switchToHttp: () => ({
          getRequest: () => ({
            session: sessao,
          }),
        }),
      };
    }

    it("deve permitir acesso para usuário com perfil ADMINISTRADOR", async () => {
      perfilRepoMock.buscarPorId.mockResolvedValue({
        id: "perfil-admin-uuid",
        codigo: "ADMINISTRADOR",
        nome: "Administrador",
        ativo: true,
      });

      const context = criarMockContext({
        id: "sessao-1",
        usuarioId: "user-1",
        perfilId: "perfil-admin-uuid",
      });

      const canActivate = await guard.canActivate(context);
      expect(canActivate).toBe(true);
    });

    it("deve rejeitar com ForbiddenException (403) para perfil FARMACEUTICO_RESPONSAVEL", async () => {
      perfilRepoMock.buscarPorId.mockResolvedValue({
        id: "perfil-farm-uuid",
        codigo: "FARMACEUTICO_RESPONSAVEL",
        nome: "Farmacêutico",
        ativo: true,
      });

      const context = criarMockContext({
        id: "sessao-2",
        usuarioId: "user-2",
        perfilId: "perfil-farm-uuid",
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("deve rejeitar com UnauthorizedException (401) quando a sessão não existe", async () => {
      const context = criarMockContext(undefined);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
