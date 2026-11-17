// O app Expo não instala @types/node. Este módulo existe só para os arquivos *.check.ts.
declare module "node:assert/strict" {
  interface Assert {
    equal(actual: unknown, expected: unknown, message?: string | Error): void;
    deepEqual(actual: unknown, expected: unknown, message?: string | Error): void;
    rejects(
      block: Promise<unknown> | (() => Promise<unknown>),
      error?: unknown,
      message?: string,
    ): Promise<void>;
  }
  const assert: Assert;
  export default assert;
}
