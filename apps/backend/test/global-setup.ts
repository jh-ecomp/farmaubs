import 'ts-node/register/transpile-only';
import { DataSource } from 'typeorm';
import * as path from 'node:path';
import { config as loadEnv } from 'dotenv';

export default async function globalSetup(): Promise<void> {
  loadEnv({ path: path.resolve(process.cwd(), '../../.env') });

  const password =
    process.env.TEST_ADMIN_DB_PASSWORD ?? process.env.POSTGRES_PASSWORD ?? '';
  const host = process.env.TEST_DB_HOST ?? 'localhost';
  const port = process.env.TEST_DB_PORT ?? '5435';
  const database = process.env.TEST_DB_DATABASE ?? 'farmaubs';
  const url =
    process.env.TEST_ADMIN_DATABASE_URL ??
    `postgresql://farmaubs_admin:${encodeURIComponent(password)}@${host}:${port}/${database}`;

  const dataSource = new DataSource({
    type: 'postgres',
    url,
    migrations: [
      path.join(
        __dirname,
        '../src/modules/**/infrastructure/persistence/migrations/!(*.spec).ts',
      ),
    ],
  });

  await dataSource.initialize();
  try {
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }
}
