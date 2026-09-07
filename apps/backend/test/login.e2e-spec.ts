import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { Server } from "node:http";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";

describe("POST /api/v1/auth/login (E2E — camada C)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // Cenário 1 — Caminho feliz (RF002 — Essencial)
  it("credenciais válidas retornam token e redirectUrl", async () => {
    const res = await request(app.getHttpServer() as Server)
      .post("/api/v1/auth/login")
      .send({ email: "admin@farmaubs.dev", senha: "Admin@123456" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body).toHaveProperty("redirectUrl");
    expect(res.body.token).toHaveLength(64);
  });

  // Cenário 2 — Credenciais inválidas
  it("senha errada retorna 401 com mensagem genérica", async () => {
    const res = await request(app.getHttpServer() as Server)
      .post("/api/v1/auth/login")
      .send({ email: "admin@farmaubs.dev", senha: "senhaerrada" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("E-mail ou senha incorretos.");
  });

  // Cenário 5 — Anti-enumeração
  it("e-mail inexistente retorna 401 com mesma mensagem genérica", async () => {
    const res = await request(app.getHttpServer() as Server)
      .post("/api/v1/auth/login")
      .send({ email: "nao.existe@farmaubs.dev", senha: "qualquer" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("E-mail ou senha incorretos.");
  });

  // Cenário 4 — Conta bloqueada
  it("conta bloqueada retorna 429 com tempo restante", async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer() as Server)
        .post("/api/v1/auth/login")
        .send({
          email: "farmaceutico.residente@farmaubs.dev",
          senha: "errada",
        });
    }

    const res = await request(app.getHttpServer() as Server)
      .post("/api/v1/auth/login")
      .send({
        email: "farmaceutico.residente@farmaubs.dev",
        senha: "Reside@123456",
      });

    expect(res.status).toBe(429);
    expect(res.body).toHaveProperty("minutosRestantes");
  });

  // Validação de DTO
  it("body sem senha retorna 400", async () => {
    const res = await request(app.getHttpServer() as Server)
      .post("/api/v1/auth/login")
      .send({ email: "admin@farmaubs.dev" });

    expect(res.status).toBe(400);
  });

  it("e-mail inválido retorna 400", async () => {
    const res = await request(app.getHttpServer() as Server)
      .post("/api/v1/auth/login")
      .send({ email: "nao-e-email", senha: "qualquer" });

    expect(res.status).toBe(400);
  });
});
