import { ConfigService } from "@nestjs/config";
import * as crypto from "node:crypto";
import { DataSource } from "typeorm";
import { MaintenanceCleanupService } from "../../src/common/maintenance/maintenance-cleanup.service";
import { adminDatabaseUrl, appDatabaseUrl } from "../test-db";

describe("Limpeza Automática de Sessões Expiradas (Camada B — RL-03)", () => {
  let adminDs: DataSource;
  let appDs: DataSource;
  let usuarioId: string;

  beforeAll(async () => {
    adminDs = new DataSource({ type: "postgres", url: adminDatabaseUrl() });
    appDs = new DataSource({ type: "postgres", url: appDatabaseUrl() });
    await adminDs.initialize();
    await appDs.initialize();

    const rows = await adminDs.query<Array<{ id: string }>>(
      `SELECT id FROM users WHERE email = 'admin@farmaubs.dev' LIMIT 1`,
    );
    usuarioId = rows[0].id;
  });

  afterAll(async () => {
    await appDs?.destroy();
    await adminDs?.destroy();
  });

  it("remove apenas sessões expiradas há mais de 24h preservando sessões ativas (via role farmaubs_app)", async () => {
    const hashExpirada1 = crypto.randomBytes(32).toString("hex");
    const hashExpirada2 = crypto.randomBytes(32).toString("hex");
    const hashAtiva = crypto.randomBytes(32).toString("hex");

    await adminDs.query(
      `INSERT INTO sessions (usuario_id, token_hash, status, expira_em)
       VALUES
         ($1, $2, 'ativa', now() - interval '30 hours'),
         ($1, $3, 'revogada', now() - interval '48 hours'),
         ($1, $4, 'ativa', now() + interval '1 hour')`,
      [usuarioId, hashExpirada1, hashExpirada2, hashAtiva],
    );

    const service = new MaintenanceCleanupService(
      appDs,
      new ConfigService({ MAINTENANCE_JOBS_ENABLED: "false" }),
    );
    const removidas = await service.limparSessoesExpiradas(1);
    expect(removidas).toBeGreaterThanOrEqual(2);

    const remaining = await adminDs.query<Array<{ token_hash: string }>>(
      `SELECT token_hash FROM sessions WHERE token_hash = ANY($1::text[])`,
      [[hashExpirada1, hashExpirada2, hashAtiva]],
    );

    expect(remaining).toEqual([{ token_hash: hashAtiva }]);

    await adminDs.query(`DELETE FROM sessions WHERE token_hash = $1`, [
      hashAtiva,
    ]);
  });
});
