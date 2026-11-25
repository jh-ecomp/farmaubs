import * as path from "node:path";
import * as bcrypt from "bcrypt";
import * as dotenv from "dotenv";
import { Pool } from "pg";
import { PERFIS } from "./seed-dev";

export interface BootstrapProdResult {
  municipioId: string;
  unidadeId: string;
  adminId: string;
  adminCreated: boolean;
}

/**
 * [NF004 / NF011 / ADR-025 / RL-02]: Inicializa de forma idempotente o banco de produção.
 * Garante os perfis RBAC, o município/UBS inicial e o 1º Administrador com deve_trocar_senha=true,
 * sem inserir pacientes/lotes fictícios e sem sobrescrever credenciais existentes em reexecuções.
 * @param env - Dicionário de variáveis de ambiente.
 * @param externalPool - Pool opcional (usado em testes de integração).
 * @returns Identificadores garantidos e indicador se o admin foi criado nesta execução.
 * @throws {Error} Caso faltem BOOTSTRAP_ADMIN_EMAIL ou BOOTSTRAP_ADMIN_PASSWORD válidos.
 */
export async function runBootstrapProd(
  env: NodeJS.ProcessEnv = process.env,
  externalPool?: Pool,
): Promise<BootstrapProdResult> {
  const adminEmail = env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const adminPassword = env.BOOTSTRAP_ADMIN_PASSWORD ?? "";

  if (!adminEmail || !adminEmail.includes("@")) {
    throw new Error(
      "BOOTSTRAP_ADMIN_EMAIL é obrigatório e deve ser um e-mail válido.",
    );
  }
  if (adminPassword.trim().length < 8) {
    throw new Error(
      "BOOTSTRAP_ADMIN_PASSWORD é obrigatório e deve ter ao menos 8 caracteres.",
    );
  }

  const municipioNome = env.BOOTSTRAP_MUNICIPIO_NOME?.trim() || "Parnaíba";
  const municipioUf = (env.BOOTSTRAP_MUNICIPIO_UF?.trim() || "PI")
    .toUpperCase()
    .slice(0, 2);
  const municipioIbge = env.BOOTSTRAP_MUNICIPIO_IBGE?.trim() || "2207702";
  const ubsNome = env.BOOTSTRAP_UBS_NOME?.trim() || "UBS Piloto FarmaUBS";
  const bcryptCost = Math.max(12, parseInt(env.BCRYPT_COST ?? "12", 10) || 12);

  const ownsPool = !externalPool;
  const pool =
    externalPool ??
    new Pool({
      host: env.DB_HOST ?? "localhost",
      port: parseInt(env.DB_PORT ?? "5432", 10),
      database: env.POSTGRES_DB ?? "farmaubs",
      user: env.MIGRATION_DB_USER ?? env.POSTGRES_USER ?? "farmaubs_admin",
      password: env.MIGRATION_DB_PASSWORD ?? env.POSTGRES_PASSWORD ?? "",
    });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let adminPerfilId = "";
    for (const p of PERFIS) {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO perfis (codigo, nome, descricao, ativo)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (codigo) DO UPDATE
           SET nome = EXCLUDED.nome,
               descricao = EXCLUDED.descricao,
               updated_at = now()
         RETURNING id`,
        [p.codigo, p.nome, p.descricao],
      );
      if (p.codigo === "ADMINISTRADOR") {
        adminPerfilId = rows[0].id;
      }
    }

    const { rows: munRows } = await client.query<{ id: string }>(
      `INSERT INTO municipios (nome, uf, codigo_ibge, ativo)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (codigo_ibge) DO UPDATE
         SET nome = municipios.nome
       RETURNING id`,
      [municipioNome, municipioUf, municipioIbge],
    );
    const municipioId = munRows[0].id;

    const existingUbs = await client.query<{ id: string }>(
      `SELECT id FROM unidades_saude WHERE municipio_id = $1 AND nome = $2 LIMIT 1`,
      [municipioId, ubsNome],
    );

    let unidadeId: string;
    if (existingUbs.rows.length > 0) {
      unidadeId = existingUbs.rows[0].id;
    } else {
      const insertedUbs = await client.query<{ id: string }>(
        `INSERT INTO unidades_saude
           (municipio_id, nome, endereco, responsavel_tecnico, caf_lead_time_days)
         VALUES ($1, $2, $3, $4, 15)
         RETURNING id`,
        [municipioId, ubsNome, `${municipioNome}/${municipioUf}`, "Responsável Técnico"],
      );
      unidadeId = insertedUbs.rows[0].id;
    }

    const existingAdmin = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`,
      [adminEmail],
    );

    let adminId: string;
    let adminCreated = false;
    if (existingAdmin.rows.length > 0) {
      adminId = existingAdmin.rows[0].id;
    } else {
      const senhaHash = await bcrypt.hash(adminPassword, bcryptCost);
      const insertedAdmin = await client.query<{ id: string }>(
        `INSERT INTO users
           (municipio_id, nome_completo, email, senha_hash, perfil_id,
            ativo, deve_trocar_senha, tentativas_login_falhas, senha_atualizada_em)
         VALUES ($1, $2, $3, $4, $5, true, true, 0, now())
         RETURNING id`,
        [
          municipioId,
          "Administrador Inicial FarmaUBS",
          adminEmail,
          senhaHash,
          adminPerfilId,
        ],
      );
      adminId = insertedAdmin.rows[0].id;
      adminCreated = true;
    }

    await client.query(
      `INSERT INTO user_units (usuario_id, unidade_id, ativo)
       VALUES ($1, $2, true)
       ON CONFLICT (usuario_id, unidade_id) DO NOTHING`,
      [adminId, unidadeId],
    );

    await client.query("COMMIT");

    return { municipioId, unidadeId, adminId, adminCreated };
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
  runBootstrapProd()
    .then((res) => {
      console.log(
        `[bootstrap-prod] Concluído (adminCreated=${res.adminCreated}, adminId=${res.adminId}, unidadeId=${res.unidadeId}).`,
      );
    })
    .catch((err) => {
      console.error("[bootstrap-prod] Falha:", err);
      process.exit(1);
    });
}
