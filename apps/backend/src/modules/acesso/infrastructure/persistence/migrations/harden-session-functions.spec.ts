import { QueryRunner } from "typeorm";
import { HardenSessionFunctions1791416441872 } from "./1791416441872HardenSessionFunctions";

describe("HardenSessionFunctions1791416441872 (migration unit)", () => {
  let migration: HardenSessionFunctions1791416441872;
  let queryRunner: jest.Mocked<QueryRunner>;

  const sqls = () =>
    ((queryRunner.query as jest.Mock).mock.calls as [string][]).map((c) => c[0]);

  beforeEach(() => {
    migration = new HardenSessionFunctions1791416441872();
    queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<QueryRunner>;
  });

  it("deve possuir o nome de migration com timestamp para o TypeORM", () => {
    expect(migration.name).toBe("HardenSessionFunctions1791416441872");
  });

  describe("up()", () => {
    it("lookup exige usuário ativo", async () => {
      await migration.up(queryRunner);
      const lookup = sqls().find((s) => s.includes("FUNCTION auth_buscar_sessao_por_token"))!;
      expect(lookup).toContain("u.ativo = true");
      expect(lookup).toContain("SECURITY DEFINER");
    });

    it("revogar é idempotente e revogarTodas cobre pendente_2fa", async () => {
      await migration.up(queryRunner);
      const revogar = sqls().find((s) => s.includes("FUNCTION auth_revogar_sessao"))!;
      const todas = sqls().find((s) => s.includes("FUNCTION auth_revogar_todas_sessoes"))!;
      expect(revogar).toContain("status <> 'revogada'");
      expect(todas).toContain("'pendente_2fa'");
    });

    it("limpeza rejeita retenção nula ou negativa", async () => {
      await migration.up(queryRunner);
      const limpar = sqls().find((s) => s.includes("FUNCTION auth_limpar_sessoes_expiradas"))!;
      expect(limpar).toContain("p_dias_retencao < 0");
      expect(limpar).toContain("RAISE EXCEPTION");
    });

    it("revoga EXECUTE de PUBLIC e concede a farmaubs_app nas 6 funções", async () => {
      await migration.up(queryRunner);
      expect(sqls().filter((s) => s.includes("FROM PUBLIC"))).toHaveLength(6);
      expect(sqls().filter((s) => s.includes("TO farmaubs_app"))).toHaveLength(6);
    });
  });

  describe("down()", () => {
    it("restaura EXECUTE para PUBLIC e as definições anteriores", async () => {
      await migration.down(queryRunner);
      expect(sqls().filter((s) => s.includes("TO PUBLIC"))).toHaveLength(6);
      const lookup = sqls().find((s) => s.includes("FUNCTION auth_buscar_sessao_por_token"))!;
      expect(lookup).not.toContain("u.ativo = true");
    });
  });
});
