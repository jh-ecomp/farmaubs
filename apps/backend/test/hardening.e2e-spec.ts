import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Server } from "node:http";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";

describe("Hardening de Produção (E2E — Camada C / RL-01)", () => {
  let app: INestApplication;
  const savedEnv = {
    NODE_ENV: process.env.NODE_ENV,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    SWAGGER_ENABLED: process.env.SWAGGER_ENABLED,
    THROTTLER_ENABLED: process.env.THROTTLER_ENABLED,
  };

  beforeAll(async () => {
    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGIN = "https://app.farmaubs.com.br";
    delete process.env.SWAGGER_ENABLED;
    process.env.THROTTLER_ENABLED = "true";

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  });

  it("retorna 404 em /api/v1/docs e aplica cabeçalhos Helmet em /api/v1/health", async () => {
    const server = app.getHttpServer() as Server;

    await request(server).get("/api/v1/docs").expect(404);

    const healthRes = await request(server).get("/api/v1/health").expect(200);
    expect(healthRes.headers["x-content-type-options"]).toBe("nosniff");
    expect(healthRes.headers["x-frame-options"]).toBeDefined();
  });

  it("retorna 429 na 11ª requisição seguida para POST /api/v1/acesso/login do mesmo IP", async () => {
    const server = app.getHttpServer() as Server;

    for (let i = 0; i < 10; i++) {
      await request(server)
        .post("/api/v1/acesso/login")
        .set("CF-Connecting-IP", "198.51.100.42")
        .send({ email: "nao.existe.rl01@farmaubs.dev", senha: "qualquer" })
        .expect(401);
    }

    await request(server)
      .post("/api/v1/acesso/login")
      .set("CF-Connecting-IP", "198.51.100.42")
      .send({ email: "nao.existe.rl01@farmaubs.dev", senha: "qualquer" })
      .expect(429);
  });
});
