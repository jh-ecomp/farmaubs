import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { Pool } from "pg";
import { runBootstrapProd } from "../../src/database/bootstrap-prod";
import { runSeedQa } from "../../src/database/seed-qa";

describe("Migrations em dist/, Bootstrap de Produção e Seed QA (Camada B — RL-02)", () => {
  const host = process.env.TEST_DB_HOST ?? "localhost";
  const port = parseInt(process.env.TEST_DB_PORT ?? "5435", 10);
  const adminUser = "farmaubs_admin";
  const adminPassword =
    process.env.TEST_ADMIN_DB_PASSWORD ?? "farmaubs_test_password";
  const cleanProdDb = "farmaubs_rl02_prod_test";
  const cleanQaDb = "farmaubs_rl02_qa_test";
  const backendRoot = path.resolve(__dirname, "../..");

  let maintPool: Pool;
  let prodPool: Pool;
  let qaPool: Pool;

  beforeAll(async () => {
    maintPool = new Pool({
      host,
      port,
      database: "farmaubs",
      user: adminUser,
      password: adminPassword,
    });

    await maintPool.query(`DROP DATABASE IF EXISTS "${cleanProdDb}" WITH (FORCE)`);
    await maintPool.query(`CREATE DATABASE "${cleanProdDb}"`);
    await maintPool.query(`DROP DATABASE IF EXISTS "${cleanQaDb}" WITH (FORCE)`);
    await maintPool.query(`CREATE DATABASE "${cleanQaDb}"`);

    prodPool = new Pool({
      host,
      port,
      database: cleanProdDb,
      user: adminUser,
      password: adminPassword,
    });
    qaPool = new Pool({
      host,
      port,
      database: cleanQaDb,
      user: adminUser,
      password: adminPassword,
    });
  }, 60_000);

  afterAll(async () => {
    await prodPool?.end();
    await qaPool?.end();
    if (maintPool) {
      await maintPool.query(
        `DROP DATABASE IF EXISTS "${cleanProdDb}" WITH (FORCE)`,
      );
      await maintPool.query(
        `DROP DATABASE IF EXISTS "${cleanQaDb}" WITH (FORCE)`,
      );
      await maintPool.end();
    }
  });

  it("aplica todas as migrations via dist/database/data-source.js sem ts-node e inicializa bootstrap-prod de forma idempotente", async () => {
    const typeormCli = path.join(
      backendRoot,
      "node_modules",
      "typeorm",
      "cli.js",
    );
    const distDataSource = path.join(
      backendRoot,
      "dist",
      "database",
      "data-source.js",
    );

    execFileSync(
      process.execPath,
      [typeormCli, "migration:run", "-d", distDataSource],
      {
        cwd: backendRoot,
        env: {
          ...process.env,
          NODE_ENV: "production",
          DB_HOST: host,
          DB_PORT: String(port),
          POSTGRES_DB: cleanProdDb,
          MIGRATION_DB_USER: adminUser,
          MIGRATION_DB_PASSWORD: adminPassword,
        },
        stdio: "pipe",
      },
    );

    const bootstrapEnv: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      APP_ENV: "production",
      BOOTSTRAP_MUNICIPIO_NOME: "Parnaíba",
      BOOTSTRAP_MUNICIPIO_UF: "PI",
      BOOTSTRAP_MUNICIPIO_IBGE: "2207702",
      BOOTSTRAP_UBS_NOME: "UBS Piloto FarmaUBS",
      BOOTSTRAP_ADMIN_EMAIL: "admin.piloto@farmaubs.com.br",
      BOOTSTRAP_ADMIN_PASSWORD: "Piloto@Farma2026!Strong",
      BCRYPT_COST: "12",
    };

    const firstRun = await runBootstrapProd(bootstrapEnv, prodPool);
    expect(firstRun.adminCreated).toBe(true);

    // Simula que o administrador já trocou sua senha no 1º acesso
    await prodPool.query(
      `UPDATE users SET deve_trocar_senha = false, senha_hash = 'hash-definitivo' WHERE id = $1`,
      [firstRun.adminId],
    );

    // 2ª execução: não duplica nem sobrescreve senha/flag existente
    const secondRun = await runBootstrapProd(bootstrapEnv, prodPool);
    expect(secondRun.adminCreated).toBe(false);
    expect(secondRun.adminId).toBe(firstRun.adminId);

    const { rows: admins } = await prodPool.query(
      `SELECT email, deve_trocar_senha, senha_hash FROM users WHERE email = 'admin.piloto@farmaubs.com.br'`,
    );
    expect(admins).toHaveLength(1);
    expect(admins[0].deve_trocar_senha).toBe(false);
    expect(admins[0].senha_hash).toBe("hash-definitivo");

    // Garante zero dados fictícios em produção
    const { rows: pacientes } = await prodPool.query(
      `SELECT count(*)::int AS total FROM pacientes`,
    );
    const { rows: lotes } = await prodPool.query(
      `SELECT count(*)::int AS total FROM lotes`,
    );
    expect(pacientes[0].total).toBe(0);
    expect(lotes[0].total).toBe(0);
  }, 60_000);

  it("popula massa sintética e conta QA_SMOKE_EMAIL em HML e bloqueia em production", async () => {
    await expect(
      runSeedQa(
        {
          APP_ENV: "production",
          ALLOW_QA_SEED: "true",
          QA_SMOKE_PASSWORD: "Smoke@Farma2026!",
        },
        qaPool,
      ),
    ).rejects.toThrow(/APP_ENV=production/i);

    const typeormCli = path.join(
      backendRoot,
      "node_modules",
      "typeorm",
      "cli.js",
    );
    const distDataSource = path.join(
      backendRoot,
      "dist",
      "database",
      "data-source.js",
    );

    execFileSync(
      process.execPath,
      [typeormCli, "migration:run", "-d", distDataSource],
      {
        cwd: backendRoot,
        env: {
          ...process.env,
          NODE_ENV: "production",
          DB_HOST: host,
          DB_PORT: String(port),
          POSTGRES_DB: cleanQaDb,
          MIGRATION_DB_USER: adminUser,
          MIGRATION_DB_PASSWORD: adminPassword,
        },
        stdio: "pipe",
      },
    );

    const qaRes = await runSeedQa(
      {
        NODE_ENV: "production",
        APP_ENV: "hml",
        ALLOW_QA_SEED: "true",
        QA_SMOKE_EMAIL: "qa.smoke@farmaubs.dev",
        QA_SMOKE_PASSWORD: "Smoke@Farma2026!",
      },
      qaPool,
    );

    expect(qaRes.smokeEmail).toBe("qa.smoke@farmaubs.dev");
    const { rows: smokeRows } = await qaPool.query(
      `SELECT ativo, deve_trocar_senha FROM users WHERE id = $1`,
      [qaRes.smokeUserId],
    );
    expect(smokeRows[0]).toEqual({ ativo: true, deve_trocar_senha: false });

    const { rows: prodCount } = await qaPool.query(
      `SELECT count(*)::int AS total FROM produtos`,
    );
    expect(prodCount[0].total).toBeGreaterThan(10);
  }, 60_000);
});
