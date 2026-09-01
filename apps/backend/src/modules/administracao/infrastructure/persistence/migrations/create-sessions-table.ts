import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSessionsTable1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        usuario_id UUID NOT NULL,
        token_hash CHAR(64) NOT NULL UNIQUE,
        status VARCHAR(20) NOT NULL DEFAULT 'ativa',
        totp_verificado_em TIMESTAMPTZ NULL,
        ip_origem INET NULL,
        user_agent TEXT NULL,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ultima_atividade_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expira_em TIMESTAMPTZ NOT NULL,
        revogada_em TIMESTAMPTZ NULL,
        CONSTRAINT fk_sessions_usuario FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT chk_sessions_status CHECK (status IN ('ativa', 'pendente_2fa', 'revogada'))
      );

      CREATE INDEX idx_sessions_usuario_id ON sessions(usuario_id);
      CREATE INDEX idx_sessions_expira_em ON sessions(expira_em);

      COMMENT ON TABLE sessions IS 'scope:global | ADR-006 sessão server-side e controle de revogação/2FA';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS sessions;`);
  }
}
