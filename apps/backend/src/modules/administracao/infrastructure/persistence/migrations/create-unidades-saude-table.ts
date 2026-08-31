import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUnidadesSaude implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE unidades_saude (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        municipio_id uuid NOT NULL REFERENCES municipios(id),
        nome text NOT NULL,
        endereco text,
        responsavel_tecnico text,
        caf_lead_time_days integer NOT NULL DEFAULT 15,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_unidades_saude_municipio_id
        ON unidades_saude (municipio_id)
    `);

    // PONTO-CHAVE: tabela global SEM RLS, mesmo tendo municipio_id.
    // Ela é lida no bootstrap de sessão (RF002/ADR-006), antes de existir
    // contexto de tenant. RLS aqui quebraria o login (fail-closed = 0 linhas).
    await queryRunner.query(
      `COMMENT ON TABLE unidades_saude IS 'scope:global | topologia (RF026); municipio_id e FK de dado, nao escopo de RLS (ADR-016)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN unidades_saude.municipio_id IS 'FK de topologia; tabela global sem RLS, lida no bootstrap de sessao pre-auth'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS unidades_saude`);
  }
}
