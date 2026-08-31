import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePerfis1787681200000 implements MigrationInterface {
  name = 'CreatePerfis1787681200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE perfis (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        codigo varchar(50) NOT NULL UNIQUE,
        nome varchar(100) NOT NULL,
        descricao text,
        ativo boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Marcação de escopo: documento no próprio banco
    // Tabela global sem escopo de tenant (ADR-006, NF009)
    await queryRunner.query(
      `COMMENT ON TABLE perfis IS 'scope:global | catalogo de perfis RBAC (ADR-006, NF009)'`,
    );

    // Seed idempotente com os 4 perfis do ADR-006
    await queryRunner.query(`
      INSERT INTO perfis (codigo, nome, descricao) VALUES
        ('ADMINISTRADOR', 'Administrador', 'Acesso total ao sistema e configurações globais'),
        ('GESTOR', 'Gestor/Coordenador', 'Gestor ou coordenador da assistência farmacêutica municipal'),
        ('FARMACEUTICO_RESPONSAVEL', 'Farmacêutico Responsável', 'Farmacêutico responsável técnico pela farmácia/UBS'),
        ('FARMACEUTICO_RESIDENTE', 'Farmacêutico Residente', 'Farmacêutico residente em atuação na UBS')
      ON CONFLICT (codigo) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS perfis`);
  }
}
