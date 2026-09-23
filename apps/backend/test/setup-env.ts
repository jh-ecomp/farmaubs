import * as path from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(process.cwd(), '../../.env') });

// Redireciona as variáveis padrão do AppModule para o banco de teste,
// para que o NestJS (e2e) conecte no banco efêmero, não no de dev.
process.env.DB_HOST     = process.env.TEST_DB_HOST     ?? 'localhost';
process.env.DB_PORT     = process.env.TEST_DB_PORT     ?? '5435';
process.env.POSTGRES_DB = process.env.TEST_DB_DATABASE ?? 'farmaubs';
process.env.DB_USER     = process.env.TEST_APP_DB_USER ?? 'farmaubs_app';
process.env.DB_PASSWORD = process.env.TEST_APP_DB_PASSWORD ??
                          process.env.FARMAUBS_APP_DB_PASSWORD ??
                          'farmaubs_test_app_password';
