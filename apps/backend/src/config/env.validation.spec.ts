import { isThrottlerEnabled, validateEnv } from "./env.validation";

describe("validateEnv (Camada A — RL-01)", () => {
  const validProdEnv = {
    NODE_ENV: "production",
    DB_HOST: "postgres",
    DB_PORT: "5432",
    DB_USER: "farmaubs_app",
    DB_PASSWORD: "super-secret-password",
    POSTGRES_DB: "farmaubs_prod",
    CORS_ORIGIN: "https://app.farmaubs.com.br,https://hml.farmaubs.com.br",
    DB_POOL_MAX: "25",
  };

  it("permite inicialização em development/test mesmo sem variáveis exclusivas de produção", () => {
    const parsed = validateEnv({
      NODE_ENV: "development",
      CUSTOM_EXTRA_VAR: "mantida",
    });

    expect(parsed.NODE_ENV).toBe("development");
    expect(parsed.CUSTOM_EXTRA_VAR).toBe("mantida");
  });

  it("aprova configuração completa válida em NODE_ENV=production", () => {
    const parsed = validateEnv(validProdEnv);
    expect(parsed.DB_HOST).toBe("postgres");
    expect(parsed.DB_POOL_MAX).toBe("25");
  });

  it.each([
    "DB_HOST",
    "DB_USER",
    "DB_PASSWORD",
    "POSTGRES_DB",
    "CORS_ORIGIN",
  ])(
    "lança erro fail-fast indicando %s quando ausente ou vazia em produção",
    (missingKey) => {
      expect(() =>
        validateEnv({
          ...validProdEnv,
          [missingKey]: "   ",
        }),
      ).toThrow(missingKey);
    },
  );

  it("rejeita valores não numéricos ou inválidos em DB_POOL_MAX e DB_PORT", () => {
    expect(() =>
      validateEnv({
        ...validProdEnv,
        DB_POOL_MAX: "abc",
      }),
    ).toThrow("DB_POOL_MAX");

    expect(() =>
      validateEnv({
        ...validProdEnv,
        DB_PORT: "0",
      }),
    ).toThrow("DB_PORT");
  });

  it("controla ativação do throttler por ambiente e override explícito", () => {
    expect(isThrottlerEnabled({ NODE_ENV: "test" })).toBe(false);
    expect(
      isThrottlerEnabled({ NODE_ENV: "test", THROTTLER_ENABLED: "true" }),
    ).toBe(true);
    expect(isThrottlerEnabled({ NODE_ENV: "production" })).toBe(true);
    expect(
      isThrottlerEnabled({
        NODE_ENV: "production",
        THROTTLER_ENABLED: "false",
      }),
    ).toBe(false);
  });
});
