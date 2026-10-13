import { Reflector } from "@nestjs/core";
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { PerfilCodigo } from "@farmaubs/shared";
import { TenantScopeGuard } from "./tenant-scope.guard";
import { TENANT_SCOPED_KEY } from "../decorators/tenant-scoped.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

describe("TenantScopeGuard (AC-13 / Camada A)", () => {
  let guard: TenantScopeGuard;
  let reflector: jest.Mocked<Reflector>;

  const createMockContext = (options: {
    user?: any;
    params?: any;
    query?: any;
    body?: any;
  }): { context: ExecutionContext; req: any } => {
    const req = {
      user: options.user,
      params: options.params ?? {},
      query: options.query ?? {},
      body: options.body ?? {},
      tenantScope: undefined,
    };

    const context = {
      getType: jest.fn().mockReturnValue("http"),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(req),
      }),
    } as unknown as ExecutionContext;

    return { context, req };
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new TenantScopeGuard(reflector);
  });

  describe("Rotas Públicas e Autenticação", () => {
    it("deve permitir acesso se a rota for pública", () => {
      reflector.getAllAndOverride.mockImplementation((key: any) => {
        if (key === IS_PUBLIC_KEY) return true;
        return undefined;
      });

      const { context } = createMockContext({ user: null });
      expect(guard.canActivate(context)).toBe(true);
    });

    it("deve lançar UnauthorizedException se não houver usuário", () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const { context } = createMockContext({ user: null });
      expect(() => guard.canActivate(context)).toThrow(
        new UnauthorizedException("Token de autenticação ausente ou inválido"),
      );
    });
  });

  describe("TC-INC4-01 & TC-INC4-02: Bypass Global do Administrador (ADR-002)", () => {
    it("deve conceder bypass ao Administrador para qualquer município", () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const adminUser = {
        id: "admin-1",
        perfilCodigo: PerfilCodigo.ADMINISTRADOR,
        municipioId: "municipio-sp",
        unidadeIds: ["ubs-1"],
      };

      const { context, req } = createMockContext({
        user: adminUser,
        params: { municipioId: "municipio-outro" },
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(req.tenantScope).toEqual({
        municipioId: "municipio-sp",
        unidadeIds: ["ubs-1"],
        isGlobalAdmin: true,
      });
    });

    it("deve conceder bypass ao Administrador para UBS não vinculada com checkUbs: true", () => {
      reflector.getAllAndOverride.mockImplementation((key: any) => {
        if (key === TENANT_SCOPED_KEY) return { checkUbs: true };
        return undefined;
      });

      const adminUser = {
        id: "admin-1",
        perfilCodigo: PerfilCodigo.ADMINISTRADOR,
        municipioId: "municipio-sp",
        unidadeIds: ["ubs-1"],
      };

      const { context, req } = createMockContext({
        user: adminUser,
        params: { unidadeId: "ubs-de-outro-municipio" },
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(req.tenantScope.isGlobalAdmin).toBe(true);
    });
  });

  describe("TC-INC4-03 & TC-INC4-04: Validação de Escopo Municipal (Perfis Operacionais)", () => {
    const gerenteUser = {
      id: "gerente-1",
      perfilCodigo: PerfilCodigo.GERENTE,
      municipioId: "municipio-santos",
      unidadeIds: ["ubs-1", "ubs-2"],
    };

    it("deve autorizar quando municipioId informado coincide com o do usuário", () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const { context, req } = createMockContext({
        user: gerenteUser,
        params: { municipioId: "municipio-santos" },
      });

      expect(guard.canActivate(context)).toBe(true);
      expect(req.tenantScope).toEqual({
        municipioId: "municipio-santos",
        unidadeIds: ["ubs-1", "ubs-2"],
        isGlobalAdmin: false,
      });
    });

    it("deve lançar ForbiddenException quando municipioId em query for diferente", () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const { context } = createMockContext({
        user: gerenteUser,
        query: { municipioId: "municipio-campinas" },
      });

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException(
          "Acesso negado: município fora do escopo do usuário",
        ),
      );
    });

    it("deve lançar ForbiddenException quando municipioId em body for diferente", () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const { context } = createMockContext({
        user: gerenteUser,
        body: { municipioId: "municipio-campinas" },
      });

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException(
          "Acesso negado: município fora do escopo do usuário",
        ),
      );
    });
  });

  describe("TC-INC4-05, TC-INC4-06 & TC-INC4-07: Validação de Escopo de UBSs", () => {
    const farmaUser = {
      id: "farma-1",
      perfilCodigo: PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
      municipioId: "municipio-santos",
      unidadeIds: ["ubs-01", "ubs-02"],
    };

    it("deve autorizar farmacêutico acessando UBS vinculada no seu município", () => {
      reflector.getAllAndOverride.mockImplementation((key: any) => {
        if (key === TENANT_SCOPED_KEY) return { checkUbs: true };
        return undefined;
      });

      const { context } = createMockContext({
        user: farmaUser,
        params: { unidadeId: "ubs-01" },
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it("deve lançar ForbiddenException para UBS não vinculada", () => {
      reflector.getAllAndOverride.mockImplementation((key: any) => {
        if (key === TENANT_SCOPED_KEY) return { checkUbs: true };
        return undefined;
      });

      const { context } = createMockContext({
        user: farmaUser,
        params: { unidadeId: "ubs-99" },
      });

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException(
          "Acesso negado: unidade de saúde fora do escopo do usuário",
        ),
      );
    });

    it("deve lançar ForbiddenException quando a unidade for enviada no body", () => {
      reflector.getAllAndOverride.mockImplementation((key: any) => {
        if (key === TENANT_SCOPED_KEY) return { checkUbs: true };
        return undefined;
      });

      const { context } = createMockContext({
        user: farmaUser,
        body: { unidadeId: "ubs-99" },
      });

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException(
          "Acesso negado: unidade de saúde fora do escopo do usuário",
        ),
      );
    });

    it("deve suportar nome customizado de parâmetro de UBS (ex: paramName: 'customUbsId')", () => {
      reflector.getAllAndOverride.mockImplementation((key: any) => {
        if (key === TENANT_SCOPED_KEY)
          return { checkUbs: true, paramName: "customUbsId" };
        return undefined;
      });

      const { context } = createMockContext({
        user: farmaUser,
        params: { customUbsId: "ubs-99" },
      });

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException(
          "Acesso negado: unidade de saúde fora do escopo do usuário",
        ),
      );
    });

    it("deve lançar ForbiddenException quando checkUbs: true e nenhum identificador de UBS for fornecido", () => {
      reflector.getAllAndOverride.mockImplementation((key: any) => {
        if (key === TENANT_SCOPED_KEY) return { checkUbs: true };
        return undefined;
      });

      const { context } = createMockContext({
        user: farmaUser,
        params: {},
        query: {},
        body: {},
      });

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException(
          "Acesso negado: unidade de saúde obrigatória não informada",
        ),
      );
    });
  });

  describe("TC-INC4-08: Injeção de req.tenantScope", () => {
    it("deve preencher req.tenantScope com dados precisos para os interceptors", () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const user = {
        id: "residente-1",
        perfilCodigo: PerfilCodigo.FARMACEUTICO_RESIDENTE,
        municipioId: "muni-123",
        unidadeIds: ["ubs-abc"],
      };

      const { context, req } = createMockContext({ user });

      guard.canActivate(context);

      expect(req.tenantScope).toEqual({
        municipioId: "muni-123",
        unidadeIds: ["ubs-abc"],
        isGlobalAdmin: false,
      });
    });
  });
});
