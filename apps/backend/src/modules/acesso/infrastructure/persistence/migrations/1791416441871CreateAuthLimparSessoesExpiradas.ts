import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAuthLimparSessoesExpiradas1791416441871 implements MigrationInterface {
  name = "CreateAuthLimparSessoesExpiradas1791416441871";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION auth_limpar_sessoes_expiradas(p_dias_retencao int)
      RETURNS int
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
      DECLARE
        v_total int;
      BEGIN
        WITH deleted AS (
          DELETE FROM sessions
          WHERE expira_em < now() - make_interval(days => p_dias_retencao)
          RETURNING id
        )
        SELECT count(*)::int INTO v_total FROM deleted;

        RETURN v_total;
      END;
      $$;
    `);

    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION auth_limpar_sessoes_expiradas(int) TO farmaubs_app;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS auth_limpar_sessoes_expiradas(int);
    `);
  }
}

