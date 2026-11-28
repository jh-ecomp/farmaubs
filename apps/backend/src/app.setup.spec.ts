import { Controller, Get, INestApplication } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { Server } from "node:http";
import request from "supertest";
import { configureApp, extractClientIp, parseCorsOrigins } from "./app.setup";
import { isThrottlerEnabled } from "./config/env.validation";
import { AcessoController } from "./modules/acesso/api/controllers/acesso.controller";
import { ChangePasswordUseCase } from "./modules/acesso/application/use-cases/change-password.use-case";
import { LoginUseCase } from "./modules/acesso/application/use-cases/login.use-case";
import { LogoutUseCase } from "./modules/acesso/application/use-cases/logout.use-case";
import { RenewSessionUseCase } from "./modules/acesso/application/use-cases/renew-session.use-case";

@Controller("health")
class ProbeHealthController {
  @Get()
  check() {
    return { status: "ok" };
  }
}

describe("Hardening HTTP da API — configureApp & Throttler (RL-01)", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("extrai IP real priorizando CF-Connecting-IP e primeiro X-Forwarded-For", () => {
    expect(
      extractClientIp({
        headers: {
          "cf-connecting-ip": "177.10.20.30",
          "x-forwarded-for": "10.0.0.1, 172.18.0.2",
        },
        ip: "172.18.0.3",
      }),
    ).toBe("177.10.20.30");

    expect(
      extractClientIp({
        headers: { "x-forwarded-for": "189.40.50.60, 172.18.0.2" },
        ip: "172.18.0.3",
      }),
    ).toBe("189.40.50.60");

    expect(extractClientIp({ headers: {}, ip: "127.0.0.1" })).toBe("127.0.0.1");
  });

  it("separa múltiplas origens no CORS_ORIGIN", () => {
    expect(
      parseCorsOrigins(
        "https://app.farmaubs.com.br, https://hml.farmaubs.com.br ",
      ),
    ).toEqual(["https://app.farmaubs.com.br", "https://hml.farmaubs.com.br"]);
  });

  describe("Swagger condicional, Helmet, CORS e Rate Limit em /api/v1/acesso/login", () => {
    let app: INestApplication;
    const loginUseCaseMock = {
      executar: jest.fn().mockResolvedValue({
        ok: false,
        motivo: "CREDENCIAIS_INVALIDAS",
      }),
    };

    beforeEach(async () => {
      loginUseCaseMock.executar.mockClear();
      process.env.NODE_ENV = "production";
      delete process.env.SWAGGER_ENABLED;
      process.env.CORS_ORIGIN =
        "https://app.farmaubs.com.br,https://hml.farmaubs.com.br";
      process.env.THROTTLER_ENABLED = "true";

      const moduleRef = await Test.createTestingModule({
        imports: [
          ThrottlerModule.forRoot({
            throttlers: [{ name: "default", ttl: 60_000, limit: 120 }],
            getTracker: (req) => extractClientIp(req),
            skipIf: () => !isThrottlerEnabled(),
          }),
        ],
        controllers: [ProbeHealthController, AcessoController],
        providers: [
          { provide: APP_GUARD, useClass: ThrottlerGuard },
          { provide: LoginUseCase, useValue: loginUseCaseMock },
          { provide: RenewSessionUseCase, useValue: { executar: jest.fn() } },
          { provide: LogoutUseCase, useValue: { executar: jest.fn() } },
          { provide: ChangePasswordUseCase, useValue: { executar: jest.fn() } },
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      configureApp(app);
      await app.init();
    });

    afterEach(async () => {
      await app.close();
    });

    it("oculta Swagger (/api/v1/docs -> 404) por padrão em NODE_ENV=production", async () => {
      await request(app.getHttpServer() as Server)
        .get("/api/v1/docs")
        .expect(404);
    });

    it("aplica cabeçalhos de segurança Helmet nas respostas da API", async () => {
      const res = await request(app.getHttpServer() as Server)
        .get("/api/v1/health")
        .expect(200);

      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-frame-options"]).toBeDefined();
    });

    it("autoriza múltiplas origens configuradas em CORS_ORIGIN e bloqueia origem desconhecida", async () => {
      const allowed = await request(app.getHttpServer() as Server)
        .get("/api/v1/health")
        .set("Origin", "https://hml.farmaubs.com.br")
        .expect(200);
      expect(allowed.headers["access-control-allow-origin"]).toBe(
        "https://hml.farmaubs.com.br",
      );
      expect(allowed.headers["access-control-expose-headers"]).toContain(
        "Content-Disposition",
      );

      const denied = await request(app.getHttpServer() as Server)
        .get("/api/v1/health")
        .set("Origin", "https://atacante.exemplo.com")
        .expect(200);
      expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("bloqueia a 11ª tentativa em POST /api/v1/acesso/login com HTTP 429 isolando por IP real", async () => {
      const server = app.getHttpServer() as Server;

      for (let i = 0; i < 10; i++) {
        await request(server)
          .post("/api/v1/acesso/login")
          .set("CF-Connecting-IP", "203.0.113.10")
          .send({ email: "admin@farmaubs.dev", senha: "SenhaErrada123" })
          .expect(401);
      }

      // 11ª chamada do mesmo IP real deve ser barrada pelo Throttler com 429
      await request(server)
        .post("/api/v1/acesso/login")
        .set("CF-Connecting-IP", "203.0.113.10")
        .send({ email: "admin@farmaubs.dev", senha: "SenhaErrada123" })
        .expect(429);

      // Outro cliente atrás do mesmo proxy continua operando normalmente
      await request(server)
        .post("/api/v1/acesso/login")
        .set("CF-Connecting-IP", "203.0.113.99")
        .send({ email: "admin@farmaubs.dev", senha: "SenhaErrada123" })
        .expect(401);

      expect(loginUseCaseMock.executar).toHaveBeenLastCalledWith(
        "admin@farmaubs.dev",
        "SenhaErrada123",
        "203.0.113.99",
        undefined,
      );
    });
  });
});
