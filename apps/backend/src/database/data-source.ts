import * as path from "node:path";
import * as dotenv from "dotenv";
import { DataSource } from "typeorm";

// Carrega .env apenas fora de produção ou quando variáveis de migração não vieram do ambiente (RL-02).
if (
  process.env.NODE_ENV !== "production" &&
  !process.env.MIGRATION_DB_PASSWORD &&
  !process.env.POSTGRES_PASSWORD
) {
  dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
}

const isCompiledJs = __filename.endsWith(".js");
const fileExt = isCompiledJs ? "js" : "ts";
const modulesDir = path.resolve(__dirname, "../modules").replace(/\\/g, "/");

/**
 * [NF004 / ADR-015 / RL-02]: DataSource TypeORM compatível tanto com src/ (dev/ts-node)
 * quanto com dist/ (container de produção usando node puro, ignorando arquivos .d.ts).
 */
export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST ?? "localhost",
  port: parseInt(process.env.DB_PORT ?? "5434", 10),
  username:
    process.env.MIGRATION_DB_USER ??
    process.env.POSTGRES_USER ??
    "farmaubs_admin",
  password:
    process.env.MIGRATION_DB_PASSWORD ?? process.env.POSTGRES_PASSWORD ?? "",
  database: process.env.POSTGRES_DB ?? "farmaubs",
  schema: process.env.DB_SCHEMA ?? "public",
  entities: [
    `${modulesDir}/**/infrastructure/persistence/entities/*.entity.${fileExt}`,
  ],
  migrations: [
    `${modulesDir}/**/infrastructure/persistence/migrations/!(*.spec|*.test|*.d).${fileExt}`,
  ],
  synchronize: false,
});
