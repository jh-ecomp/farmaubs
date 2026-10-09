import { Reflector } from "@nestjs/core";
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { PerfilCodigo } from "@farmaubs/shared";
import { RolesGuard } from "./roles.guard";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { SKIP_AUTH_KEY } from "./skip-auth.decorator";

describe("RolesGuard (AC-13 / Camada A)", () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  const createMockContext = (options: {
    user?: any;
    isHttp?: boolean;
  }): ExecutionContext => {
    return {
      getType: jest
        .fn()
        .mockReturnValue(options.isHttp !== false ? "http" : "rpc"),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: options.user,
        }),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new RolesGuard(reflector);
  });

  describe("TC-INC3-01: Rotas Públicas", () => {
    it("deve autorizar imediatamente se a rota tiver metadados isPublic", async () => {
      reflector.getAllAndOverride.mockImplementation((key: any) => {
        if (key === IS_PUBLIC_KEY) return true;
        return undefined;
      });

      const context = createMockContext({ user: null });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("deve autorizar imediatamente se a rota tiver metadados skipAuth", async () => {
      reflector.getAllAndOverride.mockImplementation((key: any) => {
        if (key === SKIP_AUTH_KEY) return true;
        return undefined;
      });

      const context = createMockContext({ user: null });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe("TC-INC3-02: Rotas sem restrição @Roles", () => {
    it("deve autorizar quando não houver roles exigidas", async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createMockContext({
        user: { perfilCodigo: PerfilCodigo.FARMACEUTICO_RESIDENTE },
      });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe("TC-INC3-03: Autenticação ausente", () => {
    it("deve lançar UnauthorizedException quando não houver usuário no request", async () => {
      reflector.getAllAndOverride.mockImplementation((key: any) => {
        if (key === ROLES_KEY) return [PerfilCodigo.ADMINISTRADOR];
        return undefined;
      });

      const context = createMockContext({ user: undefined });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException("Token de autenticação ausente ou inválido"),
      );
    });
  });

  describe("TC-INC3-04 & TC-INC3-06: Perfil Autorizado", () => {
    it("deve autorizar quando perfilCodigo coincide com a única role exigida", async () => {
      reflector.getAllAndOverride.mockImplementation((key: any) => {
        if (key === ROLES_KEY) return [PerfilCodigo.ADMINISTRADOR];
        return undefined;
      });

      const context = createMockContext({
        user: { perfilCodigo: PerfilCodigo.ADMINISTRADOR },
      });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("deve autorizar quando perfilCodigo coincide com uma das múltiplas roles exigidas", async () => {
      reflector.getAllAndOverride.mockImplementation((key: any) => {
        if (key === ROLES_KEY)
          return [PerfilCodigo.GERENTE, PerfilCodigo.ADMINISTRADOR];
        return undefined;
      });

      const context = createMockContext({
        user: { perfilCodigo: PerfilCodigo.GERENTE },
      });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe("TC-INC3-05: Perfil Não Autorizado", () => {
    it("deve lançar ForbiddenException com mensagem canônica ao divergir de perfil", async () => {
      reflector.getAllAndOverride.mockImplementation((key: any) => {
        if (key === ROLES_KEY) return [PerfilCodigo.ADMINISTRADOR];
        return undefined;
      });

      const context = createMockContext({
        user: { perfilCodigo: PerfilCodigo.FARMACEUTICO_RESPONSAVEL },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException("Acesso negado para o perfil do usuário"),
      );
    });
  });

  describe("TC-INC3-07: Zero Queries em Memória (NF010)", () => {
    it("não deve chamar profileRepo quando perfilCodigo estiver presente no snapshot", async () => {
      const mockProfileRepo = {
        buscarPorId: jest.fn(),
      } as any;

      const guardWithRepo = new RolesGuard(reflector, mockProfileRepo);

      reflector.getAllAndOverride.mockImplementation((key: any) => {
        if (key === ROLES_KEY) return [PerfilCodigo.GERENTE];
        return undefined;
      });

      const context = createMockContext({
        user: { perfilCodigo: PerfilCodigo.GERENTE, perfilId: "p-123" },
      });

      const result = await guardWithRepo.canActivate(context);

      expect(result).toBe(true);
      expect(mockProfileRepo.buscarPorId).not.toHaveBeenCalled();
    });
  });
});
