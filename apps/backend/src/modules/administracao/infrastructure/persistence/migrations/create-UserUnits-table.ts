import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUserUnits1788180807000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_units (
        id UUID PRIMARY KEY DEFAULT uuidv7(),
        usuario_id UUID NOT NULL,
        unidade_id UUID NOT NULL,
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT fk_user_units_usuario FOREIGN KEY (usuario_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_user_units_unidade FOREIGN KEY (unidade_id) REFERENCES unidades_saude (id) ON DELETE RESTRICT,
        CONSTRAINT uq_user_units_usuario_unidade UNIQUE (usuario_id, unidade_id)
      );

      CREATE INDEX IF NOT EXISTS idx_user_units_usuario_id ON user_units (usuario_id);
      CREATE INDEX IF NOT EXISTS idx_user_units_unidade_id ON user_units (unidade_id);
    `);

    await queryRunner.query(`
     COMMENT ON TABLE user_units IS 'scope:global | associação usuário-UBS (NF015, RF001); define o escopo, não é escopada'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_user_units_unidade_id;
      DROP INDEX IF EXISTS idx_user_units_usuario_id;
      DROP TABLE IF EXISTS user_units;
    `);
  }
}
