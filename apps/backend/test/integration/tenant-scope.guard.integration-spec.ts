/**
 * Guarda de escopo de tenant (ADR-002/ADR-016) — camada B (ADR-030).
 * Valida o schema REAL do banco contra o manifesto TABLE_SCOPES.
 * Falha em qualquer desvio: tabela não declarada, tenant sem RLS,
 * tenant sem municipio_id, global com municipio_id.
 */
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { TABLE_SCOPES } from '../../src/database/tenant-scope';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const pool = new Pool({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  database: process.env.TEST_DB_NAME ?? 'farmaubs_test',
  user: process.env.POSTGRES_USER ?? 'farmaubs_admin',
  password: process.env.POSTGRES_PASSWORD ?? '',
});

const GUC = 'app.municipio_id';

describe('Guarda de escopo de tenant (ADR-002/ADR-016)', () => {
  afterAll(async () => {
    await pool.end();
  });

  it('toda tabela de domínio está declarada no manifesto', async () => {
    const { rows } = await pool.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename <> 'migrations'
      ORDER BY tablename
    `);
    const declaradas = new Set(TABLE_SCOPES.map((t) => t.table));
    const naoDeclaradas = rows
      .map((r) => r.tablename)
      .filter((t) => !declaradas.has(t));
    expect(naoDeclaradas).toEqual([]);
  });

  describe('tabelas tenant-scoped (scope: municipio)', () => {
    const tenantTables = TABLE_SCOPES.filter((t) => t.scope === 'municipio');

    it.each(tenantTables.map((t) => [t.table, t.justification]))(
      '%s: municipio_id NOT NULL, RLS forcado e policy com GUC (%s)',
      async (table: string) => {
        const col = await pool.query(
          `SELECT is_nullable FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'municipio_id'`,
          [table],
        );
        expect(col.rows).toHaveLength(1);
        expect(col.rows[0].is_nullable).toBe('NO');

        const rls = await pool.query(
          `SELECT relrowsecurity, relforcerowsecurity
             FROM pg_class WHERE relname = $1`,
          [table],
        );
        expect(rls.rows[0].relrowsecurity).toBe(true);
        expect(rls.rows[0].relforcerowsecurity).toBe(true);

        const policy = await pool.query(
          `SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = $1
              AND (qual ILIKE '%current_setting%' OR with_check ILIKE '%current_setting%')
              AND (qual ILIKE '%' || $2 || '%' OR with_check ILIKE '%' || $2 || '%')`,
          [table, GUC],
        );
        expect(policy.rows.length).toBeGreaterThan(0);
      },
    );
  });

  describe('tabelas globais', () => {
    const globalTables = TABLE_SCOPES.filter((t) => t.scope === 'global');

    // O que define global é RLS desabilitado, NÃO a ausência da coluna
    // municipio_id: unidades_saude tem a coluna como FK e é global.
    it.each(globalTables.map((t) => [t.table, t.justification]))(
      '%s: RLS desabilitado (%s)',
      async (table: string) => {
        const { rows } = await pool.query(
          `SELECT relrowsecurity, relforcerowsecurity
           FROM pg_class
          WHERE relname = $1
            AND relnamespace = 'public'::regnamespace
            AND relkind = 'r'`,
          [table],
        );
        expect(rows).toHaveLength(1);
        expect(rows[0].relrowsecurity).toBe(false);
        expect(rows[0].relforcerowsecurity).toBe(false);
      },
    );

    // Endurecimento adicional: tabelas de identidade não podem carregar a
    // coluna de escopo. Exceção consciente: unidades_saude (FK de topologia).
    const TABELAS_SEM_MUNICIPIO_ID = [
      'users',
      'user_units',
      'sessions',
      'profiles',
    ];

    it.each(TABELAS_SEM_MUNICIPIO_ID)(
      '%s: sem coluna municipio_id (identidade multi-UBS, RF001)',
      async (table: string) => {
        const { rows } = await pool.query(
          `SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = 'municipio_id'`,
          [table],
        );
        expect(rows).toHaveLength(0);
      },
    );
  });
});
