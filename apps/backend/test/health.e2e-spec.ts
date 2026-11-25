import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Server } from "node:http";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { DatabaseHealthPort } from "../src/health/ports/database-health.port";

describe("HealthController (e2e — Camada C / RL-04)", () => {
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

  it("GET /api/v1/health → 200 com status ok, banco up e uptime numérico", async () => {
    const response = await request(app.getHttpServer() as Server)
      .get("/api/v1/health")
      .expect(200);

    expect(response.body.status).toBe("ok");
    expect(response.body.checks.database).toBe("up");
    expect(typeof response.body.uptime).toBe("number");
    expect(response.body.timestamp).toBeDefined();
  });

  it("GET /api/v1/health → 503 com status degraded quando PostgreSQL está indisponível", async () => {
    const degradedModule: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseHealthPort)
      .useValue({ isUp: () => Promise.resolve(false) })
      .compile();

    const degradedApp = degradedModule.createNestApplication();
    configureApp(degradedApp);
    await degradedApp.init();

    try {
      const response = await request(degradedApp.getHttpServer() as Server)
        .get("/api/v1/health")
        .expect(503);

      expect(response.body.status).toBe("degraded");
      expect(response.body.checks.database).toBe("down");
    } finally {
      await degradedApp.close();
    }
  });
});
