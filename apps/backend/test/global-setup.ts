import * as path from "node:path";
import { register } from "ts-node";

register({
  transpileOnly: true,
  project: path.resolve(__dirname, "../tsconfig.json"),
});

import { DataSource } from "typeorm";
import { config as loadEnv } from "dotenv";
import { Pool } from "pg";
import * as bcrypt from "bcrypt";

export default async function globalSetup(): Promise<void> {
  loadEnv({ path: path.resolve(process.cwd(), "../../.env") });

  const password =
    process.env.TEST_ADMIN_DB_PASSWORD ??
    process.env.TEST_DB_PASSWORD ??
    "farmaubs_test_password";
  const host = process.env.TEST_DB_HOST ?? "localhost";
  const port = process.env.TEST_DB_PORT ?? "5435";
  const database = process.env.TEST_DB_DATABASE ?? "farmaubs";
  const url =
    process.env.TEST_ADMIN_DATABASE_URL ??
    `postgresql://farmaubs_admin:${encodeURIComponent(password)}@${host}:${port}/${database}`;

  const dataSource = new DataSource({
    type: "postgres",
    url,
    migrations: [
      path.join(
        __dirname,
        "../src/modules/**/infrastructure/persistence/migrations/!(*.spec).ts",
      ),
    ],
  });

  await dataSource.initialize();
  try {
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }

  // Seed de teste — dados mínimos para os testes passarem
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Perfis
    const perfis = [
      { codigo: "ADMINISTRADOR", nome: "Administrador", descricao: "Acesso total" },
      { codigo: "GESTOR", nome: "Gestor", descricao: "Gestor municipal" },
      { codigo: "FARMACEUTICO_RESPONSAVEL", nome: "Farmacêutico Responsável", descricao: "RT" },
      { codigo: "FARMACEUTICO_RESIDENTE", nome: "Farmacêutico Residente", descricao: "Residente" },
    ];
    const perfilIds = new Map<string, string>();
    for (const p of perfis) {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO perfis (codigo, nome, descricao, ativo)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome
         RETURNING id`,
        [p.codigo, p.nome, p.descricao],
      );
      perfilIds.set(p.codigo, rows[0].id);
    }

    // Município
    const { rows: [mun] } = await client.query<{ id: string }>(
      `INSERT INTO municipios (nome, uf, ibge_code)
       VALUES ('São Paulo', 'SP', '3550308')
       ON CONFLICT (ibge_code) DO UPDATE SET nome = EXCLUDED.nome
       RETURNING id`,
    );
    const municipioId = mun.id;

    // Unidade de saúde
    const { rows: [uni] } = await client.query<{ id: string }>(
      `INSERT INTO unidades_saude (municipio_id, nome, endereco, responsavel_tecnico, caf_lead_time_days)
       VALUES ($1, 'UBS Jardim Primavera', 'Rua das Flores, 100', 'Dra. Ana', 15)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [municipioId],
    );
    const unidadeId = uni?.id ?? (await client.query<{ id: string }>(
      `SELECT id FROM unidades_saude WHERE municipio_id = $1 AND nome = 'UBS Jardim Primavera'`,
      [municipioId],
    )).rows[0].id;

    // Usuários
    const usuarios = [
      { email: "admin@farmaubs.dev", nome: "Admin Sistema", senha: "Admin@123456", perfil: "ADMINISTRADOR", ativo: true },
      { email: "gestor@farmaubs.dev", nome: "Gestor SP", senha: "Gestor@123456", perfil: "GESTOR", ativo: true },
      { email: "inativo@farmaubs.dev", nome: "Inativo", senha: "Inativ@123456", perfil: "GESTOR", ativo: false },
    ];
    const usuarioIds = new Map<string, string>();
    for (const u of usuarios) {
      const senhaHash = await bcrypt.hash(u.senha, 4); // custo baixo para testes
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM users WHERE email = $1`, [u.email],
      );
      let id: string;
      if (existing.rowCount && existing.rowCount > 0) {
        id = existing.rows[0].id;
        await client.query(
          `UPDATE users SET senha_hash = $1, ativo = $2, tentativas_login_falhas = 0, bloqueado_ate = NULL WHERE id = $3`,
          [senhaHash, u.ativo, id],
        );
      } else {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO users (municipio_id, nome_completo, email, senha_hash, perfil_id, ativo, deve_trocar_senha, tentativas_login_falhas, senha_atualizada_em)
           VALUES ($1, $2, $3, $4, $5, $6, false, 0, now())
           RETURNING id`,
          [municipioId, u.nome, u.email, senhaHash, perfilIds.get(u.perfil), u.ativo],
        );
        id = rows[0].id;
      }
      usuarioIds.set(u.email, id);
    }

    // Vínculos user_units
    for (const email of ["admin@farmaubs.dev", "gestor@farmaubs.dev"]) {
      await client.query(
        `INSERT INTO user_units (usuario_id, unidade_id, ativo)
         VALUES ($1, $2, true)
         ON CONFLICT (usuario_id, unidade_id) DO UPDATE SET ativo = true`,
        [usuarioIds.get(email), unidadeId],
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}
