import { MigrationInterface, QueryRunner } from "typeorm";

const GUC_MUNICIPIO =
  "NULLIF(current_setting('app.municipio_id', true), '')::uuid";
const GUC_UNIDADE = "NULLIF(current_setting('app.unidade_id', true), '')::uuid";

/**
 * [RF010 / RF012 / RF028 / NF015 / ADR-002 / ADR-016]: Cria as tabelas do módulo de dispensação
 * (pacientes, dispensacoes, dispensacao_itens) com índices, constraints e RLS multi-tenant.
 */
export class CreateDispensacaoTables1790000000000 implements MigrationInterface {
  name = "CreateDispensacaoTables1790000000000";

  /**
   * [RF010 / NF015]: Aplica DDL das tabelas de dispensação, índices e políticas de RLS.
   * @param queryRunner - Executor de queries da migração TypeORM.
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE pacientes (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        municipio_id uuid NOT NULL REFERENCES municipios(id) ON DELETE RESTRICT,
        cns varchar(15) NOT NULL,
        cpf varchar(11) NOT NULL,
        nome_completo varchar(150) NOT NULL,
        data_nascimento date NOT NULL,
        ativo boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_pacientes_cns_length CHECK (length(cns) = 15),
        CONSTRAINT chk_pacientes_cpf_length CHECK (length(cpf) = 11),
        CONSTRAINT chk_pacientes_data_nascimento_passado CHECK (data_nascimento <= CURRENT_DATE)
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX idx_pacientes_municipio_cpf ON pacientes (municipio_id, cpf)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX idx_pacientes_municipio_cns ON pacientes (municipio_id, cns)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_pacientes_nome ON pacientes (municipio_id, lower(nome_completo))`,
    );

    await queryRunner.query(`
      CREATE TABLE dispensacoes (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        municipio_id uuid NOT NULL REFERENCES municipios(id) ON DELETE RESTRICT,
        unidade_id uuid NOT NULL REFERENCES unidades_saude(id) ON DELETE RESTRICT,
        paciente_id uuid NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
        dispensador_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        numero_atendimento varchar(40),
        status varchar(20) NOT NULL DEFAULT 'concluida',
        receita_emissao_em date,
        estornado_em timestamptz,
        motivo_estorno text,
        estornado_por_id uuid REFERENCES users(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_dispensacoes_status CHECK (status IN ('concluida', 'estornada'))
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_dispensacoes_unidade_periodo ON dispensacoes (unidade_id, created_at DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_dispensacoes_paciente ON dispensacoes (paciente_id, created_at DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE dispensacao_itens (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        municipio_id uuid NOT NULL REFERENCES municipios(id) ON DELETE RESTRICT,
        dispensacao_id uuid NOT NULL REFERENCES dispensacoes(id) ON DELETE RESTRICT,
        medicamento_id uuid NOT NULL,
        lote_id uuid NOT NULL,
        quantidade_dispensada integer NOT NULL CHECK (quantidade_dispensada > 0),
        posologia text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_dispensacao_itens_dispensacao ON dispensacao_itens (dispensacao_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_dispensacao_itens_lote ON dispensacao_itens (lote_id)`,
    );

    // RLS: pacientes
    await queryRunner.query(`ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE pacientes FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY pacientes_tenant_isolation ON pacientes
        USING (municipio_id = ${GUC_MUNICIPIO})
        WITH CHECK (municipio_id = ${GUC_MUNICIPIO})
    `);

    // RLS: dispensacoes (municipio_id obrigatório + unidade_id quando app.unidade_id estiver definido)
    await queryRunner.query(
      `ALTER TABLE dispensacoes ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE dispensacoes FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      CREATE POLICY dispensacoes_tenant_isolation ON dispensacoes
        USING (
          municipio_id = ${GUC_MUNICIPIO}
          AND (${GUC_UNIDADE} IS NULL OR unidade_id = ${GUC_UNIDADE})
        )
        WITH CHECK (
          municipio_id = ${GUC_MUNICIPIO}
          AND (${GUC_UNIDADE} IS NULL OR unidade_id = ${GUC_UNIDADE})
        )
    `);

    // RLS: dispensacao_itens
    await queryRunner.query(
      `ALTER TABLE dispensacao_itens ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE dispensacao_itens FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      CREATE POLICY dispensacao_itens_tenant_isolation ON dispensacao_itens
        USING (municipio_id = ${GUC_MUNICIPIO})
        WITH CHECK (municipio_id = ${GUC_MUNICIPIO})
    `);

    // Permissões DML para farmaubs_app (sem DELETE permanente — Soft Delete / Auditoria)
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE ON TABLE pacientes, dispensacoes, dispensacao_itens TO farmaubs_app`,
    );
    await queryRunner.query(
      `REVOKE DELETE ON TABLE pacientes, dispensacoes, dispensacao_itens FROM farmaubs_app`,
    );
  }

  /**
   * [RF010 / NF015]: Reverte políticas de RLS, índices e tabelas de dispensação em ordem reversa.
   * @param queryRunner - Executor de queries da migração TypeORM.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS dispensacao_itens_tenant_isolation ON dispensacao_itens`,
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS dispensacoes_tenant_isolation ON dispensacoes`,
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS pacientes_tenant_isolation ON pacientes`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS dispensacao_itens`);
    await queryRunner.query(`DROP TABLE IF EXISTS dispensacoes`);
    await queryRunner.query(`DROP TABLE IF EXISTS pacientes`);
  }
}
