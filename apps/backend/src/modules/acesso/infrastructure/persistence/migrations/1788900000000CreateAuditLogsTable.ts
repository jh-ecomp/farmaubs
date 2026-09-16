import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAuditLogsTable1788900000000 implements MigrationInterface {
  name = "CreateAuditLogsTable1788900000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT uuidv7(),
        usuario_executor_id UUID NOT NULL,
        usuario_alvo_id UUID NOT NULL,
        tipo_operacao VARCHAR(50) NOT NULL,
        detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_audit_logs_executor FOREIGN KEY (usuario_executor_id) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT fk_audit_logs_alvo FOREIGN KEY (usuario_alvo_id) REFERENCES users(id) ON DELETE RESTRICT
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_usuario_alvo_id ON audit_logs(usuario_alvo_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

      COMMENT ON TABLE audit_logs IS 'scope:global | RF028, NF018 Trilha de auditoria transacional e imutável';

      GRANT SELECT, INSERT ON TABLE audit_logs TO farmaubs_app;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_audit_logs_created_at;
      DROP INDEX IF EXISTS idx_audit_logs_usuario_alvo_id;
      DROP TABLE IF EXISTS audit_logs;
    `);
  }
}
