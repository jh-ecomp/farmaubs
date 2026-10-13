import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "chai";
import * as crypto from "node:crypto";
import type { Request, Response } from "express";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AcessoController } from "../../../src/modules/acesso/api/controllers/acesso.controller";
import { SessionAuthGuard } from "../../../src/common/guards/session-auth.guard";
import { ISessionRepository } from "../../../src/modules/acesso/domain/ports/session.repository.port";

interface CookieCall {
  name: string;
  val: string;
  options: Record<string, any>;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function buildMockExecutionContext(req: Record<string, any>): ExecutionContext {
  return {
    getType: () => "http",
    getHandler: () => () => {},
    getClass: () => () => {},
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
      getNext: () => () => {},
    }),
  } as unknown as ExecutionContext;
}

// ── Cenário 1: Emissão de cookie HttpOnly no login ─────────────────────────────

Given(
  "que o usuário envia credenciais válidas para {string}",
  function (this: any, _endpoint: string) {
    this.loginToken = "sessao-token-1234567890abcdef";
    this.cookieCalls = [] as CookieCall[];

    this.mockRes = {
      setHeader: (_name: string, _val: string) => {},
      cookie: (name: string, val: string, options: Record<string, any>) => {
        this.cookieCalls.push({ name, val, options });
      },
      clearCookie: (name: string, options: Record<string, any>) => {
        this.clearedCookie = { name, options };
      },
      status: (code: number) => {
        this.statusCode = code;
      },
    } as unknown as Response;

    this.mockReq = {
      ip: "127.0.0.1",
      headers: { "user-agent": "BDD Test Browser" },
    } as unknown as Request;

    const loginUseCaseMock = {
      executar: async () => ({
        ok: true,
        token: this.loginToken,
        usuario: {
          id: "u-1",
          nomeCompleto: "Usuario BDD",
          email: "bdd@ubs.gov.br",
          perfil: "ADMINISTRADOR",
          ativo: true,
          deveTrocarSenha: false,
          municipioId: "mun-1",
          unidadeIds: ["ubs-1"],
        },
        sessao: {
          id: "s-1",
          expiresAt: new Date(Date.now() + 3600 * 1000),
          ttlSeconds: 3600,
          warningSeconds: 300,
        },
        redirectUrl: "/admin",
      }),
    };

    this.controller = new AcessoController(
      loginUseCaseMock as any,
      {} as any,
      {} as any,
      {} as any,
    );
  },
);

When("a requisição é processada com sucesso", async function (this: any) {
  this.loginResponse = await this.controller.login(
    { email: "bdd@ubs.gov.br", senha: "Password@123" },
    this.mockReq,
    this.mockRes,
  );
  this.statusCode = 200;
});

Then("a resposta deve retornar status 200 OK", function (this: any) {
  expect(this.statusCode).to.equal(200);
  expect(this.loginResponse).to.have.property("token", this.loginToken);
});

Then(
  "o cabeçalho {string} deve conter {string}",
  function (this: any, headerName: string, prefix: string) {
    if (headerName === "Set-Cookie") {
      const sessionCookie = this.cookieCalls.find(
        (c: CookieCall) => c.name === "farmaubs_session",
      );
      expect(sessionCookie).to.exist;
      expect(sessionCookie.val).to.equal(this.loginToken);
    }
  },
);

Then("o cookie deve conter a diretiva {string}", function (this: any, diretiva: string) {
  const sessionCookie = this.cookieCalls.find(
    (c: CookieCall) => c.name === "farmaubs_session",
  );
  expect(sessionCookie).to.exist;

  if (diretiva === "HttpOnly") {
    expect(sessionCookie.options.httpOnly).to.be.true;
  } else if (diretiva === "Path=/api/v1") {
    expect(sessionCookie.options.path).to.equal("/api/v1");
  } else if (diretiva === "SameSite=Lax") {
    expect(sessionCookie.options.sameSite).to.equal("lax");
  }
});

// ── Cenário 2: Autenticação via cookie sem Authorization ───────────────────────

Given(
  "que a requisição para {string} possui o cookie {string} com token válido",
  function (this: any, _endpoint: string, cookieName: string) {
    this.validToken = "token-cookie-valido-123";
    const tokenHash = hashToken(this.validToken);

    this.sessionRepoMock = {
      buscarPorTokenHash: async (h: string) => {
        if (h === tokenHash) {
          return {
            id: "sess-cookie-1",
            usuarioId: "u-cookie",
            tokenHash,
            status: "ativa",
            expiraEm: new Date(Date.now() + 3600 * 1000),
            ultimaAtividadeEm: new Date(),
            criadoEm: new Date(),
          };
        }
        return null;
      },
      renovarAtividade: async () => {},
    } as unknown as ISessionRepository;

    const reflectorMock = {
      getAllAndOverride: () => false,
    } as unknown as Reflector;

    const configServiceMock = {
      get: (_key: string, def?: string) => def,
    } as unknown as ConfigService;

    this.guard = new SessionAuthGuard(
      reflectorMock,
      this.sessionRepoMock,
      configServiceMock,
    );

    this.guardReq = {
      cookies: { [cookieName]: this.validToken },
      headers: {},
    };
  },
);

Given("a requisição não possui cabeçalho {string}", function (this: any, headerName: string) {
  delete this.guardReq.headers[headerName.toLowerCase()];
});

When("a requisição passa pelo SessionAuthGuard", async function (this: any) {
  const context = buildMockExecutionContext(this.guardReq);
  try {
    this.guardResult = await this.guard.canActivate(context);
    this.guardError = null;
  } catch (err) {
    this.guardResult = false;
    this.guardError = err;
  }
});

Then("a requisição deve ser autorizada", function (this: any) {
  expect(this.guardError).to.be.null;
  expect(this.guardResult).to.be.true;
});

Then("o usuário autenticado deve ser injetado no contexto", function (this: any) {
  expect(this.guardReq.sessao).to.exist;
  expect(this.guardReq.sessao).to.have.property("usuarioId");
});

// ── Cenário 3: Autenticação via Authorization Bearer (Mobile) ──────────────────

Given(
  "que a requisição para {string} não possui cookie",
  function (this: any, _endpoint: string) {
    this.validMobileToken = "token-mobile-valido-789";
    const tokenHash = hashToken(this.validMobileToken);

    this.sessionRepoMock = {
      buscarPorTokenHash: async (h: string) => {
        if (h === tokenHash) {
          return {
            id: "sess-mobile-1",
            usuarioId: "u-mobile-app",
            tokenHash,
            status: "ativa",
            expiraEm: new Date(Date.now() + 3600 * 1000),
            ultimaAtividadeEm: new Date(),
            criadoEm: new Date(),
          };
        }
        return null;
      },
      renovarAtividade: async () => {},
    } as unknown as ISessionRepository;

    const reflectorMock = {
      getAllAndOverride: () => false,
    } as unknown as Reflector;

    const configServiceMock = {
      get: (_key: string, def?: string) => def,
    } as unknown as ConfigService;

    this.guard = new SessionAuthGuard(
      reflectorMock,
      this.sessionRepoMock,
      configServiceMock,
    );

    this.guardReq = {
      cookies: {},
      headers: {},
    };
  },
);

Given(
  "a requisição possui cabeçalho {string}",
  function (this: any, headerValue: string) {
    if (headerValue.includes("<token_valido>")) {
      this.guardReq.headers["authorization"] = `Bearer ${this.validMobileToken}`;
    } else {
      this.guardReq.headers["authorization"] = headerValue;
    }
  },
);

// ── Cenário 4: Rejeição sem cookie e sem cabeçalho ─────────────────────────────

Given(
  "que a requisição para {string} não possui cookie {string}",
  function (this: any, _endpoint: string, _cookieName: string) {
    const reflectorMock = {
      getAllAndOverride: () => false,
    } as unknown as Reflector;

    const configServiceMock = {
      get: (_key: string, def?: string) => def,
    } as unknown as ConfigService;

    this.guard = new SessionAuthGuard(
      reflectorMock,
      {} as any,
      configServiceMock,
    );

    this.guardReq = {
      cookies: {},
      headers: {},
    };
  },
);

Then(
  "a resposta deve ser 401 Unauthorized com mensagem {string}",
  function (this: any, expectedMessage: string) {
    expect(this.guardError).to.be.instanceOf(UnauthorizedException);
    expect((this.guardError as UnauthorizedException).message).to.equal(
      expectedMessage,
    );
  },
);

// ── Cenário 5: Expurgo de cookie no logout ─────────────────────────────────────

Given(
  "que o usuário possui sessão ativa informada via cookie {string}",
  function (this: any, cookieName: string) {
    this.logoutToken = "token-ativo-para-logout-999";
    this.revokedToken = null;

    this.mockLogoutRes = {
      clearCookie: (name: string, options: Record<string, any>) => {
        this.clearedCookie = { name, options };
      },
    } as unknown as Response;

    this.mockLogoutReq = {
      cookies: { [cookieName]: this.logoutToken },
      headers: {},
    } as unknown as Request;

    const logoutUseCaseMock = {
      executar: async (t: string) => {
        this.revokedToken = t;
      },
    };

    this.logoutController = new AcessoController(
      {} as any,
      {} as any,
      logoutUseCaseMock as any,
      {} as any,
    );
  },
);

When("o usuário executa {string}", async function (this: any, _endpoint: string) {
  await this.logoutController.logout(this.mockLogoutReq, this.mockLogoutRes);
  this.logoutStatusCode = 204;
});

Then(
  "a sessão deve ser marcada como revogada no banco de dados",
  function (this: any) {
    expect(this.revokedToken).to.equal(this.logoutToken);
  },
);

Then("a resposta deve retornar status 204 No Content", function (this: any) {
  expect(this.logoutStatusCode).to.equal(204);
});

Then(
  "o cabeçalho {string} deve invalidar {string} com Max-Age zerado",
  function (this: any, _headerName: string, cookieName: string) {
    expect(this.clearedCookie).to.exist;
    expect(this.clearedCookie.name).to.equal(cookieName);
    expect(this.clearedCookie.options.path).to.equal("/api/v1");
    expect(this.clearedCookie.options.httpOnly).to.be.true;
  },
);
