import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameIbgeCodeAndAddAtivoToMunicipios1789851065800
  implements MigrationInterface
{
  name = 'RenameIbgeCodeAndAddAtivoToMunicipios1789851065800';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE municipios RENAME COLUMN ibge_code TO codigo_ibge;
    `);

    await queryRunner.query(`
      ALTER TABLE municipios ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'municipios_ibge_code_key'
        ) THEN
          ALTER TABLE municipios RENAME CONSTRAINT municipios_ibge_code_key TO municipios_codigo_ibge_key;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'municipios_codigo_ibge_key'
        ) THEN
          ALTER TABLE municipios RENAME CONSTRAINT municipios_codigo_ibge_key TO municipios_ibge_code_key;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE municipios DROP COLUMN IF EXISTS ativo;
    `);

    await queryRunner.query(`
      ALTER TABLE municipios RENAME COLUMN codigo_ibge TO ibge_code;
    `);
  }
}
