import { QueryRunner } from "typeorm";
import { CreateAuthConcluirTrocaDeSenha1789851065710 } from "./1789851065710CreateAuthConcluirTrocaDeSenha";

describe("CreateAuthConcluirTrocaDeSenha1789851065710 (migration unit)", () => {
  let migration: CreateAuthConcluirTrocaDeSenha1789851065710;
  let queryRunner: jest.Mocked<QueryRunner>;

  beforeEach(() => {
    migration = new CreateAuthConcluirTrocaDeSenha1789851065710();
    queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<QueryRunner>;
  });

  it("deve possuir o nome de migration com timestamp para o TypeORM", () => {
    expect(migration.name).toBe("CreateAuthConcluirTrocaDeSenha1789851065710");
  });

  describe("up()", () => {
    it("deve criar funções auth_concluir_troca_de_senha e auth_definir_senha_provisoria com permissões para farmaubs_app", async () => {
      await migration.up(queryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(4);

      const calls = (queryRunner.query as jest.Mock).mock.calls as [string][];
      expect(calls[0][0]).toContain("CREATE OR REPLACE FUNCTION auth_concluir_troca_de_senha");
      expect(calls[0][0]).toContain("SECURITY DEFINER");
      expect(calls[0][0]).toContain("deve_trocar_senha = false");

      expect(calls[1][0]).toContain("GRANT EXECUTE ON FUNCTION auth_concluir_troca_de_senha");
      expect(calls[1][0]).toContain("TO farmaubs_app");

      expect(calls[2][0]).toContain("CREATE OR REPLACE FUNCTION auth_definir_senha_provisoria");
      expect(calls[2][0]).toContain("SECURITY DEFINER");
      expect(calls[2][0]).toContain("deve_trocar_senha = true");

      expect(calls[3][0]).toContain("GRANT EXECUTE ON FUNCTION auth_definir_senha_provisoria");
      expect(calls[3][0]).toContain("TO farmaubs_app");
    });
  });

  describe("down()", () => {
    it("deve dropar as funções criadas", async () => {
      await migration.down(queryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(2);
      const calls = (queryRunner.query as jest.Mock).mock.calls as [string][];
      expect(calls[0][0]).toContain("DROP FUNCTION IF EXISTS auth_definir_senha_provisoria");
      expect(calls[1][0]).toContain("DROP FUNCTION IF EXISTS auth_concluir_troca_de_senha");
    });
  });
});
