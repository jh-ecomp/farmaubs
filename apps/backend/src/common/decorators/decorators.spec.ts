import { Reflector } from "@nestjs/core";
import { ExecutionContext } from "@nestjs/common";
import { PerfilCodigo } from "@farmaubs/shared";
import { Roles, ROLES_KEY } from "./roles.decorator";
import { TenantScoped, TENANT_SCOPED_KEY } from "./tenant-scoped.decorator";
import { Public, IS_PUBLIC_KEY } from "./public.decorator";
import { SKIP_AUTH_KEY } from "../guards/skip-auth.decorator";
import { CurrentUser } from "./current-user.decorator";

describe("Decorators de Autorização e Tenant (AC-13 / Camada A)", () => {
  const reflector = new Reflector();

  describe("TC-INC2-01: @Roles", () => {
    it("deve gravar metadados de perfis no handler", () => {
      class TestController {
        @Roles(PerfilCodigo.ADMINISTRADOR, PerfilCodigo.GERENTE)
        testMethod() {}
      }

      const roles = reflector.get<string[]>(
        ROLES_KEY,
        TestController.prototype.testMethod,
      );
      expect(roles).toEqual([PerfilCodigo.ADMINISTRADOR, PerfilCodigo.GERENTE]);
    });
  });

  describe("TC-INC2-02 & TC-INC2-03: @TenantScoped", () => {
    it("deve gravar opções padrão { checkUbs: false }", () => {
      class TestController {
        @TenantScoped()
        testMethod() {}
      }

      const options = reflector.get(
        TENANT_SCOPED_KEY,
        TestController.prototype.testMethod,
      );
      expect(options).toEqual({ checkUbs: false });
    });

    it("deve gravar opções customizadas com checkUbs e paramName", () => {
      class TestController {
        @TenantScoped({ checkUbs: true, paramName: "customUbsId" })
        testMethod() {}
      }

      const options = reflector.get(
        TENANT_SCOPED_KEY,
        TestController.prototype.testMethod,
      );
      expect(options).toEqual({ checkUbs: true, paramName: "customUbsId" });
    });
  });

  describe("TC-INC2-04: @Public", () => {
    it("deve definir metadados isPublic e skipAuth simultaneamente", () => {
      class TestController {
        @Public()
        testMethod() {}
      }

      const isPublic = reflector.get(
        IS_PUBLIC_KEY,
        TestController.prototype.testMethod,
      );
      const skipAuth = reflector.get(
        SKIP_AUTH_KEY,
        TestController.prototype.testMethod,
      );

      expect(isPublic).toBe(true);
      expect(skipAuth).toBe(true);
    });
  });

  describe("TC-INC2-05: @CurrentUser", () => {
    function getParamDecoratorFactory(decorator: any) {
      class TestClass {
        testMethod(@decorator() _user: any) {}
      }
      // Em NestJS, createParamDecorator anexa metadados na função de rota
      const metadata = Reflect.getMetadata(
        "__routeArguments__",
        TestClass,
        "testMethod",
      );
      const key = Object.keys(metadata)[0];
      return metadata[key].factory;
    }

    it("deve extrair o usuário autenticado do request", () => {
      const factory = getParamDecoratorFactory(CurrentUser);
      const mockUser = {
        id: "user-1",
        email: "admin@farmaubs.dev",
        perfilCodigo: PerfilCodigo.ADMINISTRADOR,
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ user: mockUser }),
        }),
      } as unknown as ExecutionContext;

      const result = factory(undefined, mockContext);
      expect(result).toEqual(mockUser);
    });

    it("deve extrair propriedade específica do usuário quando informado parâmetro", () => {
      const factory = getParamDecoratorFactory(CurrentUser);
      const mockUser = {
        id: "user-1",
        email: "admin@farmaubs.dev",
        perfilCodigo: PerfilCodigo.ADMINISTRADOR,
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ user: mockUser }),
        }),
      } as unknown as ExecutionContext;

      const result = factory("email", mockContext);
      expect(result).toBe("admin@farmaubs.dev");
    });
  });
});
