import { z } from "zod";

const PRODUCTION_REQUIRED_KEYS = [
  "DB_HOST",
  "DB_USER",
  "DB_PASSWORD",
  "POSTGRES_DB",
  "CORS_ORIGIN",
] as const;

const optionalPositiveIntString = (field: string) =>
  z
    .string()
    .trim()
    .regex(/^[1-9]\d*$/, { message: `${field} deve ser um inteiro positivo` })
    .optional()
    .or(z.literal("").transform(() => undefined));

const envValidationSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .optional()
      .default("development"),
    API_PORT: optionalPositiveIntString("API_PORT"),
    DB_PORT: optionalPositiveIntString("DB_PORT"),
    DB_POOL_MAX: optionalPositiveIntString("DB_POOL_MAX"),
    DB_HOST: z.string().optional(),
    DB_USER: z.string().optional(),
    DB_PASSWORD: z.string().optional(),
    POSTGRES_DB: z.string().optional(),
    CORS_ORIGIN: z.string().optional(),
    SWAGGER_ENABLED: z
      .enum(["true", "false"])
      .optional()
      .or(z.literal("").transform(() => undefined)),
    THROTTLER_ENABLED: z
      .enum(["true", "false"])
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== "production") return;

    for (const key of PRODUCTION_REQUIRED_KEYS) {
      const value = data[key];
      if (typeof value !== "string" || value.trim().length === 0) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `Variável obrigatória ausente ou vazia em produção: ${key}`,
        });
      }
    }
  });

/**
 * [NF004 / NF009 / ADR-027 / RL-01]: Valida de forma fail-fast as variáveis de ambiente no boot da API.
 * Em produção, bloqueia a inicialização caso variáveis críticas de banco ou CORS estejam ausentes/vazias.
 * @param config - Dicionário bruto de variáveis carregadas pelo ConfigModule.
 * @returns Dicionário validado preservando as demais chaves do ambiente.
 * @throws {Error} Caso alguma variável obrigatória ou formato numérico seja inválido.
 */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const result = envValidationSchema.safeParse(config);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Falha na validação de variáveis de ambiente — ${details}`);
  }

  return {
    ...config,
    ...Object.fromEntries(
      Object.entries(result.data).filter(([, value]) => value !== undefined),
    ),
  };
}

/**
 * [NF009 / RL-01]: Determina se o rate limiting (@nestjs/throttler) deve atuar no ambiente atual.
 * Ativo por padrão fora de NODE_ENV=test, podendo ser forçado via THROTTLER_ENABLED=true|false.
 * @param env - Variáveis de ambiente em execução.
 * @returns Verdadeiro quando o throttler deve limitar requisições.
 */
export function isThrottlerEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.THROTTLER_ENABLED === "true") return true;
  if (env.THROTTLER_ENABLED === "false") return false;
  return env.NODE_ENV !== "test";
}
