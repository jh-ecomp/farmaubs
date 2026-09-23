/**
 * Camada C — Teste e2e do caminho feliz de login via API (RF002 Essencial).
 *
 * Sobe a aplicação NestJS completa com banco real e faz requisições HTTP
 * via Supertest. Valida o contrato de entrada/saída do endpoint POST /api/v1/acesso/login.
 *
 * Requer banco PostgreSQL acessível via variáveis de ambiente:
 *   DB_HOST, DB_PORT, POSTGRES_DB, DB_USER, DB_PASSWORD
 *
 * Execução:
 *   npm run test -- --testPathPattern="acesso.e2e.spec" --runInBand
 *
 * Pré-condições:
 *   - Migrations aplicadas (AC-01 a AC-04)
 *   - Seed de desenvolvimento executado (TAREFA-12)
 */

import "../../../../../test/setup-env";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
const request = require("supertest");
import { DataSource } from "typeorm";
import { AppModule } from "../../../../app.module";
import { configureApp } from "../../../../app.setup";

// ─── Credenciais do seed (TAREFA-12) ────────────────────────────────────────
const ADMIN_EMAIL = "admin@farmaubs.dev";
const ADMIN_SENHA = "Admin@123456";

// ─── setup / teardown ───────────────────────────────────────────────────────

let app: INestApplication;
let ds: DataSource;
let dsAdmin: DataSource;

beforeAll(async () => {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  ds = moduleRef.get(DataSource);

  // dsAdmin é usado nos helpers de setup que fazem UPDATE direto em users
  // (farmaubs_app tem RLS — sem GUC setado o UPDATE não afeta nenhuma linha)
  dsAdmin = new DataSource({
    type: "postgres",
    host: process.env.TEST_DB_HOST ?? process.env.DB_HOST ?? "localhost",
    port: parseInt(
      process.env.TEST_DB_PORT ?? process.env.DB_PORT ?? "5435",
      10,
    ),
    database:
      process.env.TEST_DB_DATABASE ?? process.env.POSTGRES_DB ?? "farmaubs",
    username: process.env.MIGRATION_DB_USER ?? "farmaubs_admin",
    password:
      process.env.TEST_ADMIN_DB_PASSWORD ??
      process.env.MIGRATION_DB_PASSWORD ??
      "farmaubs_test_password",
    synchronize: false,
    logging: false,
  });
  await dsAdmin.initialize();
}, 60_000);

afterAll(async () => {
  await app.close();
  if (dsAdmin?.isInitialized) await dsAdmin.destroy();
}, 30_000);

async function resetarUsuario(email: string) {
  if (dsAdmin?.isInitialized) {
    await dsAdmin.query(
      `UPDATE users
       SET tentativas_login_falhas = 0,
           bloqueado_ate           = NULL,
           updated_at              = now()
       WHERE email = $1`,
      [email],
    );
    await dsAdmin.query(
      `DELETE FROM sessions WHERE usuario_id = (SELECT id FROM users WHERE email = $1)`,
      [email],
    );
  }
}

// ─── testes ──────────────────────────────────────────────────────────────────

describe("POST /api/v1/acesso/login (e2e — camada C)", () => {
  beforeEach(async () => {
    await resetarUsuario(ADMIN_EMAIL);
  });

  afterEach(async () => {
    await resetarUsuario(ADMIN_EMAIL);
  });

  // ── Cenário 1: caminho feliz ─────────────────────────────────────────────

  describe("Cenário 1 — Login com sucesso (RF002 Essencial)", () => {
    it("responde HTTP 200", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/acesso/login")
        .send({ email: ADMIN_EMAIL, senha: ADMIN_SENHA })
        .expect(200);
    });

    it("retorna usuarioId e redirectUrl no corpo", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/acesso/login")
        .send({ email: ADMIN_EMAIL, senha: ADMIN_SENHA });

      expect(res.body).toMatchObject({
        usuario: expect.objectContaining({
          id: expect.any(String),
          nomeCompleto: expect.any(String),
          email: ADMIN_EMAIL,
          perfilCodigo: "ADMINISTRADOR",
          municipioId: expect.any(String),
          unidadeIds: expect.any(Array),
          deveTrocarSenha: false,
        }),
        sessao: expect.objectContaining({
          expiresAt: expect.any(String),
          ttlSeconds: expect.any(Number),
          warningSeconds: expect.any(Number),
        }),
        redirectUrl: "/dashboard",
      });
      expect(res.body.usuario.unidadeIds.length).toBeGreaterThan(0);
    });

    it("inclui token Bearer no cabeçalho Authorization", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/acesso/login")
        .send({ email: ADMIN_EMAIL, senha: ADMIN_SENHA });

      const authHeader = res.headers["authorization"] as string | undefined;
      expect(authHeader).toBeDefined();
      expect(authHeader).toMatch(/^Bearer [0-9a-f]{64}$/);
    });

    it("token é diferente a cada login (unicidade)", async () => {
      const res1 = await request(app.getHttpServer())
        .post("/api/v1/acesso/login")
        .send({ email: ADMIN_EMAIL, senha: ADMIN_SENHA });

      const res2 = await request(app.getHttpServer())
        .post("/api/v1/acesso/login")
        .send({ email: ADMIN_EMAIL, senha: ADMIN_SENHA });

      expect(res1.headers["authorization"]).not.toBe(
        res2.headers["authorization"],
      );
    });
  });

  // ── Cenário 2: credenciais inválidas ────────────────────────────────────

  describe("Cenário 2 — Senha incorreta", () => {
    it("responde HTTP 401", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/acesso/login")
        .send({ email: ADMIN_EMAIL, senha: "SenhaErrada!" })
        .expect(401);
    });

    it("retorna mensagem genérica (anti enumeração)", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/acesso/login")
        .send({ email: ADMIN_EMAIL, senha: "SenhaErrada!" });

      expect(res.body.message).toBe("E-mail ou senha incorretos.");
    });

    it("não retorna cabeçalho Authorization", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/acesso/login")
        .send({ email: ADMIN_EMAIL, senha: "SenhaErrada!" });

      expect(res.headers["authorization"]).toBeUndefined();
    });
  });

  // ── Cenário 5: e-mail inexistente (anti enumeração) ─────────────────────

  describe("Cenário 5 — E-mail inexistente", () => {
    it("responde HTTP 401 com a mesma mensagem genérica", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/acesso/login")
        .send({ email: "nao.existe@farmaubs.dev", senha: "qualquer" });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("E-mail ou senha incorretos.");
    });
  });

  // ── Cenário 4: conta bloqueada ───────────────────────────────────────────

  describe("Cenário 4 — Conta bloqueada", () => {
    it("responde HTTP 429 com minutosRestantes durante bloqueio", async () => {
      // Bloqueia a conta diretamente no banco (simula 5 falhas já registradas)
      await dsAdmin.query(
        `UPDATE users
         SET tentativas_login_falhas = 5,
             bloqueado_ate           = now() + interval '15 minutes'
         WHERE email = $1`,
        [ADMIN_EMAIL],
      );

      const res = await request(app.getHttpServer())
        .post("/api/v1/acesso/login")
        .send({ email: ADMIN_EMAIL, senha: ADMIN_SENHA });

      expect(res.status).toBe(429);
      expect(res.body).toMatchObject({
        minutosRestantes: expect.any(Number),
        message: expect.stringContaining("bloqueada"),
      });
      expect(res.body.minutosRestantes).toBeGreaterThan(0);
    });

    it("não retorna Authorization durante bloqueio", async () => {
      await dsAdmin.query(
        `UPDATE users
         SET tentativas_login_falhas = 5,
             bloqueado_ate           = now() + interval '15 minutes'
         WHERE email = $1`,
        [ADMIN_EMAIL],
      );

      const res = await request(app.getHttpServer())
        .post("/api/v1/acesso/login")
        .send({ email: ADMIN_EMAIL, senha: ADMIN_SENHA });

      expect(res.headers["authorization"]).toBeUndefined();
    });
  });

  // ── Validação de contrato (DTO) ──────────────────────────────────────────

  describe("Validação de contrato", () => {
    it("responde HTTP 400 para corpo vazio", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/acesso/login")
        .send({})
        .expect(400);
    });

    it("responde HTTP 400 para e-mail inválido", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/acesso/login")
        .send({ email: "nao-e-email", senha: "qualquer" })
        .expect(400);
    });

    it("responde HTTP 400 sem o campo senha", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/acesso/login")
        .send({ email: ADMIN_EMAIL })
        .expect(400);
    });

    it("responde HTTP 400 para campos extras (forbidNonWhitelisted)", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/acesso/login")
        .send({
          email: ADMIN_EMAIL,
          senha: ADMIN_SENHA,
          campoExtra: "injetado",
        })
        .expect(400);
    });
  });

  // ── Cenário 6: Validação de Sessão, Sliding Expiration e Header (AC-10) ──

  describe("Validação Contínua de Sessão e Timeout (AC-10 — Camada C)", () => {
    let validToken: string;

    beforeEach(async () => {
      await resetarUsuario(ADMIN_EMAIL);
      const loginRes = await request(app.getHttpServer())
        .post("/api/v1/acesso/login")
        .send({ email: ADMIN_EMAIL, senha: ADMIN_SENHA });
      expect(loginRes.status).toBe(200);
      validToken = loginRes.headers["authorization"];
    });

    it("GET /api/v1/acesso/me com token válido responde 200 com payload da sessão e header X-Session-Expires-At", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/acesso/me")
        .set("Authorization", validToken)
        .expect(200);

      expect(res.body).toMatchObject({
        usuarioId: expect.any(String),
        municipioId: expect.any(String),
        perfilCodigo: "ADMINISTRADOR",
        unidadeIds: expect.any(Array),
        nomeCompleto: expect.any(String),
        email: ADMIN_EMAIL,
        deveTrocarSenha: false,
        expiresAt: expect.any(String),
      });
      expect(res.body.unidadeIds.length).toBeGreaterThan(0);

      expect(res.headers["x-session-expires-at"]).toBeDefined();
      const expiresAtHeader = new Date(res.headers["x-session-expires-at"]);
      expect(expiresAtHeader.getTime()).toBeGreaterThan(Date.now());
    });

    it("GET /api/v1/acesso/me sem cabeçalho Authorization responde 401 Unauthorized", async () => {
      await request(app.getHttpServer()).get("/api/v1/acesso/me").expect(401);
    });

    it("GET /api/v1/acesso/me com token inválido responde 401 Unauthorized", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/acesso/me")
        .set("Authorization", "Bearer token-invalido-inexistente")
        .expect(401);
    });

    it("GET /api/v1/acesso/me após expiração manual da sessão responde 401", async () => {
      // Expira a sessão diretamente no banco como admin (bypass RLS)
      await dsAdmin.query(
        `UPDATE sessions SET expira_em = now() - interval '1 minute'`,
      );

      await request(app.getHttpServer())
        .get("/api/v1/acesso/me")
        .set("Authorization", validToken)
        .expect(401);
    });

    it("POST /api/v1/acesso/renovar estende sessão e retorna 200 com novo expiresAt", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/acesso/renovar")
        .set("Authorization", validToken)
        .expect(200);

      expect(res.body).toMatchObject({
        expiresAt: expect.any(String),
        ttlSeconds: 3600,
        warningSeconds: 300,
      });

      expect(res.headers["x-session-expires-at"]).toBeDefined();
      const expiresAtDate = new Date(res.body.expiresAt);
      expect(expiresAtDate.getTime() - Date.now()).toBeGreaterThanOrEqual(
        3500 * 1000,
      );
    });

    it("GET /api/v1/health permanece acessível sem autenticação (@SkipAuth)", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/health")
        .expect(200);

      expect(res.body.status).toBe("ok");
    });
  });
});
