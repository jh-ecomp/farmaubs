import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * [RF026 / ADR-002 / ADR-016]: Desabilita Row-Level Security (RLS) na tabela 'unidades_saude'.
 *
 * Conforme manifesto TABLE_SCOPES e ADR-016:
 * 'unidades_saude' é catálogo de topologia municipal global (scope: global).
 * A coluna municipio_id é uma chave estrangeira de dados para filtragem por município
 * (utilizada em seletores em cascata e bootstrap), e não fronteira de isolamento por tenant.
 *
 * Remove a política 'unidades_saude_tenant_isolation' e desabilita o RLS,
 * permitindo a consulta de UBSs vinculadas a qualquer município selecionado.
 */
export class DisableRlsUnidadesSaude1789910000000 implements MigrationInterface {
  name = 'DisableRlsUnidadesSaude1789910000000';

  /**
   * Remove a política de isolamento e desabilita RLS na tabela unidades_saude.
   * @param queryRunner - Executor de queries do TypeORM.
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
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

  /**
   * Reativa RLS e recria a política de isolamento na tabela unidades_saude.
   * @param queryRunner - Executor de queries do TypeORM.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE unidades_saude ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE unidades_saude FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      CREATE POLICY unidades_saude_tenant_isolation ON unidades_saude
        USING (municipio_id = NULLIF(current_setting('app.municipio_id', true), '')::uuid)
        WITH CHECK (municipio_id = NULLIF(current_setting('app.municipio_id', true), '')::uuid)
    `);
  }
}
