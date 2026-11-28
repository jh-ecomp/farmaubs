import * as path from "node:path";
import * as bcrypt from "bcrypt";
import * as dotenv from "dotenv";
import { Pool } from "pg";
import { executarSeedSinteticoBase } from "./seed-dev";

/**
 * [ADR-025 / NF010 / RL-02]: Impõe trava estrita impedindo seed sintético de QA em produção.
 * @param env - Variáveis de ambiente ativas.
 * @throws {Error} Caso APP_ENV seja production, diferente de hml, ou ALLOW_QA_SEED !== 'true'.
 */
export function assertQaSeedAllowed(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (env.APP_ENV === "production") {
    throw new Error(
      "Execução bloqueada: seed-qa é estritamente proibido quando APP_ENV=production (ADR-025).",
    );
  }
  if (env.APP_ENV !== "hml" || env.ALLOW_QA_SEED !== "true") {
    throw new Error(
      "Execução bloqueada: seed-qa exige explicitamente APP_ENV=hml e ALLOW_QA_SEED=true.",
    );
  }
}

/**
 * [ADR-025 / RL-02 / RL-08]: Popula homologação (farmaubs-hml) com massa sintética RENAME/REMUME
 * e garante a conta sintética QA_SMOKE_EMAIL para os testes de Smoke, Load e Stress.
 * @param env - Variáveis de ambiente ativas.
 * @param externalPool - Pool opcional (para testes automatizados).
 */
export async function runSeedQa(
  env: NodeJS.ProcessEnv = process.env,
  externalPool?: Pool,
): Promise<{ smokeUserId: string; smokeEmail: string }> {
  assertQaSeedAllowed(env);

  const smokeEmail =
    env.QA_SMOKE_EMAIL?.trim().toLowerCase() || "qa.smoke@farmaubs.dev";
  const smokePassword = env.QA_SMOKE_PASSWORD ?? "";
  if (smokePassword.trim().length < 8) {
    throw new Error(
      "QA_SMOKE_PASSWORD é obrigatório em HML e deve ter ao menos 8 caracteres.",
    );
  }

  const ownsPool = !externalPool;
  const pool =
    externalPool ??
    new Pool({
      host: env.DB_HOST ?? "localhost",
      port: parseInt(env.DB_PORT ?? "5432", 10),
      database: env.POSTGRES_DB ?? "farmaubs_hml",
      user: env.MIGRATION_DB_USER ?? env.POSTGRES_USER ?? "farmaubs_admin",
      password: env.MIGRATION_DB_PASSWORD ?? env.POSTGRES_PASSWORD ?? "",
    });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { perfilIds, municipioIds, unidadeIds } =
      await executarSeedSinteticoBase(client);

    const perfilId = perfilIds.get("FARMACEUTICO_RESPONSAVEL");
    const municipioId = municipioIds.get("2207702");
    const unidadeId = unidadeIds.get("UBS Centro - Dr. João Silva Filho");
    if (!perfilId || !municipioId || !unidadeId) {
      throw new Error(
        "Falha ao resolver chaves naturais de Parnaíba no seed sintético de QA.",
      );
    }

    const senhaHash = await bcrypt.hash(smokePassword, 10);
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`,
      [smokeEmail],
    );

    let smokeUserId: string;
    if (existing.rows.length > 0) {
      smokeUserId = existing.rows[0].id;
      await client.query(
        `UPDATE users
            SET municipio_id = $1,
                perfil_id = $2,
                senha_hash = $3,
                ativo = true,
                deve_trocar_senha = false,
                tentativas_login_falhas = 0,
                bloqueado_ate = NULL,
                updated_at = now()
          WHERE id = $4`,
        [municipioId, perfilId, senhaHash, smokeUserId],
      );
    } else {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO users
           (municipio_id, nome_completo, email, senha_hash, perfil_id,
            ativo, deve_trocar_senha, tentativas_login_falhas, senha_atualizada_em)
         VALUES ($1, 'Conta Sintética QA Smoke', $2, $3, $4, true, false, 0, now())
         RETURNING id`,
        [municipioId, smokeEmail, senhaHash, perfilId],
      );
      smokeUserId = inserted.rows[0].id;
    }

    await client.query(
      `INSERT INTO user_units (usuario_id, unidade_id, ativo)
       VALUES ($1, $2, true)
       ON CONFLICT (usuario_id, unidade_id) DO UPDATE
         SET ativo = true, updated_at = now()`,
      [smokeUserId, unidadeId],
    );

    await client.query("COMMIT");
    return { smokeUserId, smokeEmail };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    if (ownsPool) {
      await pool.end();
    }
  }
}

if (require.main === module) {
  if (process.env.NODE_ENV !== "production") {
    dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
  }
  runSeedQa()
    .then((res) => {
      console.log(
        `[seed-qa] Massa sintética e conta ${res.smokeEmail} (${res.smokeUserId}) aplicadas com sucesso.`,
      );
    })
    .catch((err) => {
      console.error("[seed-qa] Falha:", err);
      process.exit(1);
    });
}
