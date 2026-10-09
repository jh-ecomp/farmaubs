import { Given, When, Then, Before } from "@cucumber/cucumber";
import { expect } from "chai";
import { Reflector } from "@nestjs/core";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { PerfilCodigo } from "@farmaubs/shared";
import { RolesGuard } from "../../../src/common/guards/roles.guard";
import { TenantScopeGuard } from "../../../src/common/guards/tenant-scope.guard";
import { ROLES_KEY } from "../../../src/common/decorators/roles.decorator";
import { TENANT_SCOPED_KEY } from "../../../src/common/decorators/tenant-scoped.decorator";

interface StepContext {
  requiredRoles?: string[];
  tenantOptions?: any;
  user?: any;
  req?: any;
  rolesGuardResult?: boolean;
  tenantGuardResult?: boolean;
  lastError?: any;
  httpStatus?: number;
}

let ctx: StepContext = {};

function createMockExecutionContext(req: any, roles?: string[], tenantOptions?: any): ExecutionContext {
  const reflector = {
    getAllAndOverride: (key: string) => {
      if (key === ROLES_KEY) return roles;
      if (key === TENANT_SCOPED_KEY) return tenantOptions;
      return undefined;
    },
  } as unknown as Reflector;

  return {
    getType: () => "http",
    getHandler: () => () => {},
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
}

Before(function () {
  ctx = {
    req: {
      params: {},
      query: {},
      body: {},
      headers: {},
    },
  };
});

Given(/^que a rota está anotada com @Roles\((.*)\)$/, function (role: string) {
  ctx.requiredRoles = [role];
});

Given("o usuário na requisição possui o perfil {string}", function (perfil: string) {
  ctx.user = {
    id: "usr-1",
    email: "user@farmaubs.dev",
    perfilCodigo: perfil as PerfilCodigo,
    municipioId: "muni-1",
    unidadeIds: ["ubs-01"],
  };
  ctx.req.user = ctx.user;
});

When("o RolesGuard avaliar a execução", async function () {
  const reflector = {
    getAllAndOverride: (key: string) => {
      if (key === ROLES_KEY) return ctx.requiredRoles;
      return undefined;
    },
  } as unknown as Reflector;

  const guard = new RolesGuard(reflector);
  const execContext = createMockExecutionContext(ctx.req, ctx.requiredRoles);

  try {
    ctx.rolesGuardResult = await guard.canActivate(execContext);
    ctx.lastError = undefined;
  } catch (err) {
    ctx.lastError = err;
    ctx.rolesGuardResult = false;
  }
});

Then("o guard deve retornar verdadeiro", function () {
  expect(ctx.rolesGuardResult).to.be.true;
});

Then("o guard deve lançar ForbiddenException com status 403", function () {
  expect(ctx.lastError).to.be.an.instanceOf(ForbiddenException);
  expect(ctx.lastError.getStatus()).to.equal(403);
  expect(ctx.lastError.message).to.equal("Acesso negado para o perfil do usuário");
});

Given(/que a rota possui @TenantScoped\(.*checkUbs:\s*true.*\)/, function () {
  ctx.tenantOptions = { checkUbs: true };
});

Given("a requisição aponta para a UBS {string}", function (ubs: string) {
  ctx.req.params.unidadeId = ubs;
});

Given("o usuário autenticado possui o perfil {string}", function (perfil: string) {
  ctx.user = {
    id: "admin-1",
    email: "admin@farmaubs.dev",
    perfilCodigo: perfil as PerfilCodigo,
    municipioId: "muni-sp",
    unidadeIds: ["ubs-sp-01"],
  };
  ctx.req.user = ctx.user;
});

When("o TenantScopeGuard avaliar a execução", function () {
  const reflector = {
    getAllAndOverride: (key: string) => {
      if (key === TENANT_SCOPED_KEY) return ctx.tenantOptions;
      return undefined;
    },
  } as unknown as Reflector;

  const guard = new TenantScopeGuard(reflector);
  const execContext = createMockExecutionContext(ctx.req, undefined, ctx.tenantOptions);

  try {
    ctx.tenantGuardResult = guard.canActivate(execContext);
    ctx.lastError = undefined;
  } catch (err) {
    ctx.lastError = err;
    ctx.tenantGuardResult = false;
  }
});

Then("o acesso deve ser autorizado com sucesso", function () {
  expect(ctx.tenantGuardResult).to.be.true;
  expect(ctx.req.tenantScope).to.exist;
});

Given("que o Farmacêutico pertence ao município {string}", function (municipio: string) {
  ctx.user = {
    id: "farma-1",
    email: "farma@farmaubs.dev",
    perfilCodigo: PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    municipioId: municipio,
    unidadeIds: [],
  };
  ctx.req.user = ctx.user;
});

Given(/possui as UBSs \[(.*)\] vinculadas/, function (ubssStr: string) {
  const ubss = ubssStr
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
  ctx.user.unidadeIds = ubss;
  ctx.req.user.unidadeIds = ubss;
  ctx.tenantOptions = { checkUbs: true };
});

Given("a requisição acessa a rota com o parâmetro unidadeId {string}", function (unidadeId: string) {
  ctx.req.params.unidadeId = unidadeId;
});

Then("a requisição é autorizada", function () {
  expect(ctx.tenantGuardResult).to.be.true;
});

Then(
  "o req.tenantScope deve ser preenchido com município {string} e unidades autorizadas",
  function (municipio: string) {
    expect(ctx.req.tenantScope).to.exist;
    expect(ctx.req.tenantScope.municipioId).to.equal(municipio);
    expect(ctx.req.tenantScope.unidadeIds).to.deep.equal(ctx.user.unidadeIds);
    expect(ctx.req.tenantScope.isGlobalAdmin).to.be.false;
  },
);

Given("que o Farmacêutico possui apenas a UBS {string} vinculada", function (ubs: string) {
  ctx.user = {
    id: "farma-1",
    email: "farma@farmaubs.dev",
    perfilCodigo: PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    municipioId: "Santos",
    unidadeIds: [ubs],
  };
  ctx.req.user = ctx.user;
  ctx.tenantOptions = { checkUbs: true };
});

When(
  "ele tentar enviar requisição para a rota com parâmetro unidadeId {string}",
  function (unidadeId: string) {
    ctx.req.params.unidadeId = unidadeId;

    const reflector = {
      getAllAndOverride: (key: string) => {
        if (key === TENANT_SCOPED_KEY) return ctx.tenantOptions;
        return undefined;
      },
    } as unknown as Reflector;

    const guard = new TenantScopeGuard(reflector);
    const execContext = createMockExecutionContext(ctx.req, undefined, ctx.tenantOptions);

    try {
      ctx.tenantGuardResult = guard.canActivate(execContext);
      ctx.lastError = undefined;
    } catch (err) {
      ctx.lastError = err;
      ctx.tenantGuardResult = false;
    }
  },
);

Then("o TenantScopeGuard deve lançar ForbiddenException com status 403", function () {
  expect(ctx.lastError).to.be.an.instanceOf(ForbiddenException);
  expect(ctx.lastError.getStatus()).to.equal(403);
});

Given("uma requisição GET para {string}", function (url: string) {
  ctx.req.url = url;
  ctx.req.method = "GET";
  // Rota de relatórios de indicadores exige perfil GERENTE ou ADMINISTRADOR
  ctx.requiredRoles = [PerfilCodigo.GERENTE, PerfilCodigo.ADMINISTRADOR];
});

Given("o header Authorization contém token válido de {string}", function (perfil: string) {
  ctx.user = {
    id: "residente-1",
    email: "residente@farmaubs.dev",
    perfilCodigo: perfil as PerfilCodigo,
    municipioId: "Santos",
    unidadeIds: ["ubs-01"],
  };
  ctx.req.user = ctx.user;
});

When("a API processar a requisição", async function () {
  const reflector = {
    getAllAndOverride: (key: string) => {
      if (key === ROLES_KEY) return ctx.requiredRoles;
      return undefined;
    },
  } as unknown as Reflector;

  const guard = new RolesGuard(reflector);
  const execContext = createMockExecutionContext(ctx.req, ctx.requiredRoles);

  try {
    await guard.canActivate(execContext);
    ctx.httpStatus = 200;
  } catch (err: any) {
    if (err instanceof ForbiddenException) {
      ctx.httpStatus = 403;
    } else {
      ctx.httpStatus = 500;
    }
  }
});

Then("o status HTTP de resposta deve ser 403 Forbidden", function () {
  expect(ctx.httpStatus).to.equal(403);
});
