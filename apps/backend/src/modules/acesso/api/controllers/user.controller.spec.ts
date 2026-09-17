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
import { EditUserUseCase } from "../../application/use-cases/edit-user.use-case";
import { UpdateAssociationsUseCase } from "../../application/use-cases/update-associations.use-case";
import { ToggleUserStatusUseCase } from "../../application/use-cases/toggle-user-status.use-case";
import { SetTemporaryPasswordUseCase } from "../../application/use-cases/set-temporary-password.use-case";

import { CadastrarUsuarioDto } from "../dto/create-user.dto";
import { ListUsersQueryDto } from "../dto/list-users-query.dto";
import { EditarUsuarioDto } from "../dto/edit-user.dto";
import { AtualizarAssociacoesUsuarioDto } from "../dto/update-associations.dto";
import { AlterarStatusUsuarioDto } from "../dto/toggle-status.dto";
import { RedefinirSenhaProvisoriaDto } from "../dto/set-temporary-password.dto";

import {
  DadosUsuarioInvalidosException,
  PerfilNaoEncontradoException,
  UnidadeSaudeInvalidaException,
  UsuarioEmailJaExisteException,
} from "../../domain/errors/user-registration.errors";
import {
  AutoInativacaoBloqueadaException,
  IntegridadeTerritorialException,
  SenhaInvalidaException,
  UltimoAdministradorException,
  UsuarioNaoEncontradoException,
} from "../../domain/errors/user-management.errors";
import { RolesGuard } from "../../../../common/guards/roles.guard";
import { REPOSITORIO_PERFIL_PORT } from "../../domain/ports/profile.repository.port";

describe("UserController", () => {
  let controller: UserController;
  let useCaseMock: jest.Mocked<CadastrarUsuarioUseCase>;
  let listUsersUseCaseMock: jest.Mocked<ListUsersUseCase>;
  let editUserUseCaseMock: jest.Mocked<EditUserUseCase>;
  let updateAssociationsUseCaseMock: jest.Mocked<UpdateAssociationsUseCase>;
  let toggleUserStatusUseCaseMock: jest.Mocked<ToggleUserStatusUseCase>;
  let setTemporaryPasswordUseCaseMock: jest.Mocked<SetTemporaryPasswordUseCase>;
  let perfilRepoMock: { buscarPorId: jest.Mock };

  const dtoValido: CadastrarUsuarioDto = {
    municipioId: "01919a77-3e15-7000-8000-000000000001",
  const mockUsuarioResultado = {
    id: "user-uuid-1",
    municipioId: "muni-uuid-1",
    nomeCompleto: "Carlos Eduardo da Silva",
    email: "carlos.silva@ubs.gov.br",
    senha: "SenhaForte#2026",
    perfil: "FARMACEUTICO",
    ubsIds: ["01919a77-3e15-7000-8000-000000000010"],
    perfilId: "perfil-uuid-1",
    ativo: true,
    deveTrocarSenha: true,
    ubsIds: ["ubs-uuid-1"],
    atualizadoEm: new Date(),
  };

  const mockRequest = {
    sessao: {
      usuarioId: "admin-executor-uuid",
    },
  };

  beforeEach(async () => {
    useCaseMock = {
      executar: jest.fn(),
    } as unknown as jest.Mocked<CadastrarUsuarioUseCase>;

    listUsersUseCaseMock = {
      executar: jest.fn(),
    } as unknown as jest.Mocked<ListUsersUseCase>;

    editUserUseCaseMock = {
      executar: jest.fn(),
    } as unknown as jest.Mocked<EditUserUseCase>;

    updateAssociationsUseCaseMock = {
      executar: jest.fn(),
    } as unknown as jest.Mocked<UpdateAssociationsUseCase>;

    toggleUserStatusUseCaseMock = {
      executar: jest.fn(),
    } as unknown as jest.Mocked<ToggleUserStatusUseCase>;

    setTemporaryPasswordUseCaseMock = {
      executar: jest.fn(),
    } as unknown as jest.Mocked<SetTemporaryPasswordUseCase>;

    perfilRepoMock = {
      buscarPorId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: CadastrarUsuarioUseCase, useValue: useCaseMock },
        { provide: ListUsersUseCase, useValue: listUsersUseCaseMock },
        { provide: EditUserUseCase, useValue: editUserUseCaseMock },
        {
          provide: CadastrarUsuarioUseCase,
          useValue: useCaseMock,
          provide: UpdateAssociationsUseCase,
          useValue: updateAssociationsUseCaseMock,
        },
        {
          provide: ListUsersUseCase,
          useValue: listUsersUseCaseMock,
          provide: ToggleUserStatusUseCase,
          useValue: toggleUserStatusUseCaseMock,
        },
        {
          provide: SetTemporaryPasswordUseCase,
          useValue: setTemporaryPasswordUseCaseMock,
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
  describe("POST /api/v1/usuarios (cadastro)", () => {
    const dtoValido: CadastrarUsuarioDto = {
      municipioId: "01919a77-3e15-7000-8000-000000000001",
      nomeCompleto: "Carlos Eduardo da Silva",
      email: "carlos.silva@ubs.gov.br",
      senha: "SenhaForte#2026",
      perfil: "FARMACEUTICO",
      ubsIds: ["01919a77-3e15-7000-8000-000000000010"],
    };

    useCaseMock.executar.mockResolvedValue(mockResultado);
    it("deve cadastrar usuário com sucesso retornando status 201 e dados do usuário", async () => {
      useCaseMock.executar.mockResolvedValue(mockUsuarioResultado as any);
      const resultado = await controller.cadastrar(dtoValido);
      expect(resultado).toEqual(mockUsuarioResultado);
    });

    const resultado = await controller.cadastrar(dtoValido);
    it("deve converter UsuarioEmailJaExisteException em ConflictException (409)", async () => {
      useCaseMock.executar.mockRejectedValue(
        new UsuarioEmailJaExisteException(dtoValido.email),
      );
      await expect(controller.cadastrar(dtoValido)).rejects.toThrow(
        ConflictException,
      );
    });

    expect(useCaseMock.executar).toHaveBeenCalledWith(dtoValido);
    expect(resultado).toEqual(mockResultado);
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
  });

  it("deve converter UsuarioEmailJaExisteException em ConflictException (409)", async () => {
    useCaseMock.executar.mockRejectedValue(
      new UsuarioEmailJaExisteException(dtoValido.email),
    );
  describe("PATCH /api/v1/usuarios/:id (editar dados cadastrais)", () => {
    const dto: EditarUsuarioDto = {
      nomeCompleto: "Novo Nome",
      email: "novo@farmaubs.gov.br",
    };

    await expect(controller.cadastrar(dtoValido)).rejects.toThrow(
      ConflictException,
    );
  });
    it("deve atualizar dados com sucesso e retornar 200", async () => {
      editUserUseCaseMock.executar.mockResolvedValue(mockUsuarioResultado);

  it("deve converter PerfilNaoEncontradoException em NotFoundException (404)", async () => {
    useCaseMock.executar.mockRejectedValue(
      new PerfilNaoEncontradoException("INEXISTENTE"),
    );
      const resultado = await controller.editar("user-uuid-1", dto, mockRequest);

    await expect(controller.cadastrar(dtoValido)).rejects.toThrow(
      NotFoundException,
    );
      expect(editUserUseCaseMock.executar).toHaveBeenCalledWith(
        "admin-executor-uuid",
        "user-uuid-1",
        dto,
      );
      expect(resultado).toEqual(mockUsuarioResultado);
    });

    it("deve converter UsuarioNaoEncontradoException em NotFoundException (404)", async () => {
      editUserUseCaseMock.executar.mockRejectedValue(
        new UsuarioNaoEncontradoException("user-uuid-1"),
      );

      await expect(
        controller.editar("user-uuid-1", dto, mockRequest),
      ).rejects.toThrow(NotFoundException);
    });

    it("deve converter UsuarioEmailJaExisteException em ConflictException (409)", async () => {
      editUserUseCaseMock.executar.mockRejectedValue(
        new UsuarioEmailJaExisteException("novo@farmaubs.gov.br"),
      );

      await expect(
        controller.editar("user-uuid-1", dto, mockRequest),
      ).rejects.toThrow(ConflictException);
    });
  });

  it("deve converter UnidadeSaudeInvalidaException em BadRequestException (400)", async () => {
    useCaseMock.executar.mockRejectedValue(
      new UnidadeSaudeInvalidaException("UBS inválida"),
    );
  describe("PUT /api/v1/usuarios/:id/associacoes (perfil e UBSs)", () => {
    const dto: AtualizarAssociacoesUsuarioDto = {
      perfilId: "perfil-farm-uuid",
      ubsIds: ["ubs-uuid-1"],
    };

    await expect(controller.cadastrar(dtoValido)).rejects.toThrow(
      BadRequestException,
    );
    it("deve atualizar associações com sucesso e retornar 200", async () => {
      updateAssociationsUseCaseMock.executar.mockResolvedValue(
        mockUsuarioResultado,
      );

      const resultado = await controller.atualizarAssociacoes(
        "user-uuid-1",
        dto,
        mockRequest,
      );

      expect(updateAssociationsUseCaseMock.executar).toHaveBeenCalledWith(
        "admin-executor-uuid",
        "user-uuid-1",
        dto,
      );
      expect(resultado).toEqual(mockUsuarioResultado);
    });

    it("deve converter IntegridadeTerritorialException em BadRequestException (400)", async () => {
      updateAssociationsUseCaseMock.executar.mockRejectedValue(
        new IntegridadeTerritorialException("UBS de outro município"),
      );

      await expect(
        controller.atualizarAssociacoes("user-uuid-1", dto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it("deve converter UltimoAdministradorException em ConflictException (409)", async () => {
      updateAssociationsUseCaseMock.executar.mockRejectedValue(
        new UltimoAdministradorException(),
      );

      await expect(
        controller.atualizarAssociacoes("user-uuid-1", dto, mockRequest),
      ).rejects.toThrow(ConflictException);
    });
  });

  it("deve converter DadosUsuarioInvalidosException em BadRequestException (400)", async () => {
    useCaseMock.executar.mockRejectedValue(
      new DadosUsuarioInvalidosException("Nome obrigatório"),
    );
  describe("PATCH /api/v1/usuarios/:id/status (inativar / reativar)", () => {
    const dto: AlterarStatusUsuarioDto = { ativo: false };

    await expect(controller.cadastrar(dtoValido)).rejects.toThrow(
      BadRequestException,
    );
    it("deve alterar status com sucesso e retornar 200", async () => {
      toggleUserStatusUseCaseMock.executar.mockResolvedValue({
        ...mockUsuarioResultado,
        ativo: false,
      });

      const resultado = await controller.alterarStatus(
        "user-uuid-1",
        dto,
        mockRequest,
      );

      expect(toggleUserStatusUseCaseMock.executar).toHaveBeenCalledWith(
        "admin-executor-uuid",
        "user-uuid-1",
        dto,
      );
      expect(resultado.ativo).toBe(false);
    });

    it("deve converter AutoInativacaoBloqueadaException em ConflictException (409)", async () => {
      toggleUserStatusUseCaseMock.executar.mockRejectedValue(
        new AutoInativacaoBloqueadaException(),
      );

      await expect(
        controller.alterarStatus("user-uuid-1", dto, mockRequest),
      ).rejects.toThrow(ConflictException);
    });

    it("deve converter UltimoAdministradorException em ConflictException (409)", async () => {
      toggleUserStatusUseCaseMock.executar.mockRejectedValue(
        new UltimoAdministradorException(),
      );

      await expect(
        controller.alterarStatus("user-uuid-1", dto, mockRequest),
      ).rejects.toThrow(ConflictException);
    });
  });

  it("deve propagar erros inesperados sem mascarar", async () => {
    useCaseMock.executar.mockRejectedValue(new Error("Erro de banco de dados"));
  describe("POST /api/v1/usuarios/:id/senha-provisoria (redefinir senha)", () => {
    const dto: RedefinirSenhaProvisoriaDto = {
      senhaProvisoria: "Provisoria#2026",
    };

    await expect(controller.cadastrar(dtoValido)).rejects.toThrow(
      "Erro de banco de dados",
    );
    it("deve redefinir senha provisória com sucesso e responder void (204)", async () => {
      setTemporaryPasswordUseCaseMock.executar.mockResolvedValue(undefined);

      const resultado = await controller.redefinirSenhaProvisoria(
        "user-uuid-1",
        dto,
        mockRequest,
      );

      expect(setTemporaryPasswordUseCaseMock.executar).toHaveBeenCalledWith(
        "admin-executor-uuid",
        "user-uuid-1",
        dto,
      );
      expect(resultado).toBeUndefined();
    });

    it("deve converter SenhaInvalidaException em BadRequestException (400)", async () => {
      setTemporaryPasswordUseCaseMock.executar.mockRejectedValue(
        new SenhaInvalidaException("Senha fraca"),
      );

      await expect(
        controller.redefinirSenhaProvisoria("user-uuid-1", dto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it("deve converter UsuarioNaoEncontradoException em NotFoundException (404)", async () => {
      setTemporaryPasswordUseCaseMock.executar.mockRejectedValue(
        new UsuarioNaoEncontradoException("user-uuid-1"),
      );

      await expect(
        controller.redefinirSenhaProvisoria("user-uuid-1", dto, mockRequest),
      ).rejects.toThrow(NotFoundException);
    });
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
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 1,
        totalPages: 0,
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
  describe("RolesGuard (RBAC nas rotas)", () => {
    let guard: RolesGuard;
    let reflector: Reflector;

    beforeEach(() => {
      reflector = new Reflector();
      guard = new RolesGuard(reflector, perfilRepoMock as any);
    });

    function criarMockContext(sessao?: any): any {
    function criarMockContext(handler: any, sessao?: any): any {
      return {
        getHandler: () => controller.listar,
        getHandler: () => handler,
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
    it("deve permitir acesso para perfil ADMINISTRADOR no endpoint de senha provisória", async () => {
      perfilRepoMock.buscarPorId.mockResolvedValue({
        id: "perfil-admin-uuid",
        codigo: "ADMINISTRADOR",
        nome: "Administrador",
        ativo: true,
      });

      const context = criarMockContext({
      const context = criarMockContext(controller.redefinirSenhaProvisoria, {
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
      const context = criarMockContext(controller.redefinirSenhaProvisoria, {
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
      const context = criarMockContext(controller.redefinirSenhaProvisoria, undefined);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
