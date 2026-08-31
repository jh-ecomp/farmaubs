import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1788180806000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuidv7(),
        municipio_id UUID NOT NULL,
        nome_completo VARCHAR(150) NOT NULL,
        email VARCHAR(255) NOT NULL,
        senha_hash VARCHAR(60) NOT NULL,
        perfil_id UUID NOT NULL,
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        deve_trocar_senha BOOLEAN NOT NULL DEFAULT TRUE,
        tentativas_login_falhas SMALLINT NOT NULL DEFAULT 0,
        bloqueado_ate TIMESTAMPTZ NULL,
        senha_atualizada_em TIMESTAMPTZ NULL,
        ultimo_login_em TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_users_municipio FOREIGN KEY (municipio_id) REFERENCES municipios (id) ON DELETE RESTRICT,
        CONSTRAINT fk_users_perfil FOREIGN KEY (perfil_id) REFERENCES perfis (id) ON DELETE RESTRICT
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
      CREATE INDEX IF NOT EXISTS idx_users_municipio_id ON users (municipio_id);
      CREATE INDEX IF NOT EXISTS idx_users_perfil_id ON users (perfil_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_users_perfil_id;
      DROP INDEX IF EXISTS idx_users_municipio_id;
      DROP INDEX IF EXISTS idx_users_email_lower;
      DROP TABLE IF EXISTS users;
    `);
  }
}
