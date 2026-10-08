import * as crypto from "crypto";
import type { DataSource } from "typeorm";
import { SessionPgRepository } from "./session-pg.repository";

describe("SessionPgRepository.criarSessao — token e hash (Camada A)", () => {
  const query = jest.fn();
  const repo = new SessionPgRepository({ query } as unknown as DataSource);

  beforeEach(() => {
    query.mockReset().mockResolvedValue([]);
  });

  it("grava sha256(token) em minúsculas e nunca o token em texto puro", async () => {
    const token = await repo.criarSessao({
      usuarioId: "user-1",
      expiraEm: new Date(Date.now() + 60_000),
    });

    const [, params] = query.mock.calls[0] as [string, unknown[]];
    const hashEsperado = crypto.createHash("sha256").update(token).digest("hex");

    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(params[1]).toBe(hashEsperado);
    expect(params[1]).toMatch(/^[0-9a-f]{64}$/);
    expect(params).not.toContain(token);
  });

  it("gera um token diferente a cada chamada", async () => {
    const expiraEm = new Date(Date.now() + 60_000);
    const t1 = await repo.criarSessao({ usuarioId: "user-1", expiraEm });
    const t2 = await repo.criarSessao({ usuarioId: "user-1", expiraEm });

    expect(t1).not.toBe(t2);
  });
});
