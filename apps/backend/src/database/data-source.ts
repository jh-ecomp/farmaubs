import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

// O pnpm executa os scripts com CWD em apps/backend. A raiz do monorepo
// fica dois níveis acima (../../), onde mora o .env que o compose também lê.
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5434', 10),
  username: process.env.POSTGRES_USER ?? 'farmaubs_admin',
  password: process.env.POSTGRES_PASSWORD ?? '',
  database: process.env.POSTGRES_DB ?? 'farmaubs',
  schema: process.env.DB_SCHEMA ?? 'public',
  entities: [
    'src/modules/**/infrastructure/persistence/entities/*.entity{.ts,.js}',
  ],
  migrations: [
    'src/modules/**/infrastructure/persistence/migrations/!(*.spec|*.test){.ts,.js}',
  ],
  synchronize: false,
});
