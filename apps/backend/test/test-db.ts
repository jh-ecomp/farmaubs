import * as path from 'node:path';
import { config as loadEnv } from 'dotenv';
/**
 * Helper de conexão dos testes de integração (camada B, ADR-030).
 *
 * Carrega o .env da raiz do monorepo — mesmo caminho do ConfigModule do
 * AppModule — e monta as URLs do banco efêmero de teste.
 *
 * Precedência das senhas:
 *   1. TEST_ADMIN_DB_PASSWORD / TEST_APP_DB_PASSWORD (explícitas de teste)
 *   2. POSTGRES_PASSWORD / DB_PASSWORD (senhas de dev — quando o compose
 *      de teste reusa o .env)
 *   3. vazio (último recurso)
 */

export function loadTestEnv(): void {
  loadEnv({ path: path.resolve(process.cwd(), '../../.env') });
}

export function adminDatabaseUrl(): string {
  return (
    process.env.TEST_ADMIN_DATABASE_URL ??
    buildUrl(
      'farmaubs_admin',
      process.env.TEST_ADMIN_DB_PASSWORD ?? process.env.POSTGRES_PASSWORD ?? '',
    )
  );
}

export function appDatabaseUrl(): string {
  return (
    process.env.TEST_APP_DATABASE_URL ??
    buildUrl(
      'farmaubs_app',
      process.env.TEST_APP_DB_PASSWORD ?? process.env.DB_PASSWORD ?? '',
    )
  );
}

function buildUrl(user: string, password: string): string {
  const host = process.env.TEST_DB_HOST ?? 'localhost';
  const port = process.env.TEST_DB_PORT ?? '5435';
  const database = process.env.TEST_DB_DATABASE ?? 'farmaubs';
  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}
