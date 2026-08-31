import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMunicipios1787680710200 implements MigrationInterface {
  name = 'CreateMunicipios1787680710200';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE municipios (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        nome text NOT NULL,
        uf char(2) NOT NULL,
        ibge_code char(7) UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Marcação de escopo: documentação no próprio banco (fonte de verdade
    // é o manifesto tenant-scope.ts, validado pelo guard test)
    await queryRunner.query(
      `COMMENT ON TABLE municipios IS 'scope:global | registro de tenants (ADR-002, ADR-016)'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS municipios`);
  }
}
