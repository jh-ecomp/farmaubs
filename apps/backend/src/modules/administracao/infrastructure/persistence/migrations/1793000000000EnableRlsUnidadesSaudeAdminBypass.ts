import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * [RF026 / ADR-002 / ADR-016]: Reativa Row-Level Security (RLS) na tabela `unidades_saude`
 * com bypass exclusivo para o administrador global (`app.is_admin = 'true'`).
 *
 * - Usuários operacionais e anônimos: enxergam apenas unidades do próprio `app.municipio_id` (fail-closed sem GUC).
 * - Administrador (`app.is_admin = 'true'`): acessa unidades de todos os municípios.
 * - Fluxo de login pré-autenticação continua operando via funções `SECURITY DEFINER`.
 */
export class EnableRlsUnidadesSaudeAdminBypass1793000000000
  implements MigrationInterface
{
  name = "EnableRlsUnidadesSaudeAdminBypass1793000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE unidades_saude ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE unidades_saude FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS unidades_saude_tenant_isolation ON unidades_saude`,
    );
    await queryRunner.query(`
      CREATE POLICY unidades_saude_tenant_isolation ON unidades_saude
        USING (
          current_setting('app.is_admin', true) = 'true'
          OR municipio_id = NULLIF(current_setting('app.municipio_id', true), '')::uuid
        )
        WITH CHECK (
          current_setting('app.is_admin', true) = 'true'
          OR municipio_id = NULLIF(current_setting('app.municipio_id', true), '')::uuid
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS unidades_saude_tenant_isolation ON unidades_saude`,
    );
    await queryRunner.query(
      `ALTER TABLE unidades_saude NO FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE unidades_saude DISABLE ROW LEVEL SECURITY`,
    );
  }
}
