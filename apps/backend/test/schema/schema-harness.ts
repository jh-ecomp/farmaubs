/**
 * Harness de teste de integração de schema (TAREFA-13, ADR-030 camada B).
 *
 * Responsabilidades:
 *  - Reset do banco de teste dedicado (farmaubs_test): DROP + CREATE a cada
 *    execução, garantindo "do zero em banco limpo" (TC-01).
 *  - DataSource TypeORM apontando para o banco de teste, com as migrations.
 *  - Helpers de asserção de schema (tabelas, colunas, constraints, índices).
 *
 * Variáveis de ambiente (todas com default compatível com docker-compose.test.yml):
 *  - TEST_DB_HOST     (default: localhost)
 *  - TEST_DB_PORT     (default: 5435)
 *  - TEST_DB_USER     (default: farmaubs_admin)
 *  - TEST_DB_PASSWORD (default: farmaubs_test_password)
 *  - TEST_DB_NAME     (default: farmaubs_test)
 *  - TEST_DB_ADMIN    (default: farmaubs) — banco de manutenção p/ DROP/CREATE
 *  - MIGRATIONS_GLOB  (default: src/modules/<modulo>/infrastructure/persistence/migrations; /*.ts) — relativo a process.cwd()
 *
 * As migrations vivem dentro dos módulos (ex.: src/modules/<modulo>/infrastructure/persistence/migrations,
 * por isso o glob usa * para cobrir qualquer profundidade. Rode o script a partir de apps/backend.
 */
import { DataSource } from 'typeorm';
import { join } from 'node:path';

const TEST_DB_HOST = process.env.TEST_DB_HOST ?? 'localhost';
const TEST_DB_PORT = parseInt(process.env.TEST_DB_PORT ?? '5435', 10);
const TEST_DB_USER = process.env.TEST_DB_USER ?? 'farmaubs_admin';
const TEST_DB_PASSWORD =
  process.env.TEST_DB_PASSWORD ?? 'farmaubs_test_password';
const TEST_DB_NAME = process.env.TEST_DB_NAME ?? 'farmaubs_test';
const TEST_DB_ADMIN = process.env.TEST_DB_ADMIN ?? 'farmaubs';
const MIGRATIONS_GLOB =
  process.env.MIGRATIONS_GLOB ??
  join(
    'src',
    'modules',
    '*',
    'infrastructure',
    'persistence',
    'migrations',
    '!(*.spec).ts',
  );

/** Conexão ao banco de manutenção — usada apenas para DROP/CREATE do banco de teste. */
export function createAdminDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    host: TEST_DB_HOST,
    port: TEST_DB_PORT,
    database: TEST_DB_ADMIN,
    username: TEST_DB_USER,
    password: TEST_DB_PASSWORD,
    synchronize: false,
    logging: false,
  });
}

/** DataSource do banco de teste, com as migrations carregadas do glob. */
export function createTestDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    host: TEST_DB_HOST,
    port: TEST_DB_PORT,
    database: TEST_DB_NAME,
    username: TEST_DB_USER,
    password: TEST_DB_PASSWORD,
    migrations: [join(process.cwd(), MIGRATIONS_GLOB)],
    migrationsTableName: 'migrations',
    synchronize: false,
    logging: false,
  });
}

/** Recria o banco de teste do zero (DROP + CREATE). Exige conexão ao banco de manutenção. */
export async function resetTestDatabase(): Promise<void> {
  const admin = createAdminDataSource();
  await admin.initialize();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
  } finally {
    await admin.destroy();
  }
}

/** Reverte todas as migrations aplicadas (down na ordem inversa). */
export async function revertAllMigrations(ds: DataSource): Promise<void> {
  const rows = await ds.query(`SELECT count(*)::int AS total FROM migrations`);
  const total = rows[0].total;
  for (let i = 0; i < total; i++) {
    await ds.undoLastMigration();
  }
}

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
  column_default: string | null;
}

export interface ConstraintInfo {
  conname: string;
  contype: string; // p = PK, f = FK, u = UNIQUE, c = CHECK
  definition: string;
}

export interface IndexInfo {
  indexname: string;
  indexdef: string;
}

export async function tableExists(
  ds: DataSource,
  table: string,
): Promise<boolean> {
  const rows = await ds.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return rows.length > 0;
}

export async function getColumns(
  ds: DataSource,
  table: string,
): Promise<ColumnInfo[]> {
  const rows = await ds.query(
    `SELECT column_name, data_type, udt_name, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table],
  );
  return rows;
}

export async function getConstraints(
  ds: DataSource,
  table: string,
): Promise<ConstraintInfo[]> {
  const rows = await ds.query(
    `SELECT conname, contype, pg_get_constraintdef(oid) AS definition
     FROM pg_constraint
     WHERE conrelid = $1::regclass
     ORDER BY conname`,
    [table],
  );
  return rows;
}

export async function getIndexes(
  ds: DataSource,
  table: string,
): Promise<IndexInfo[]> {
  const rows = await ds.query(
    `SELECT indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = $1
     ORDER BY indexname`,
    [table],
  );
  return rows;
}
