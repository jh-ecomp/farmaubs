import { MigrationInterface, QueryRunner } from "typeorm";

const GUC_MUNICIPIO =
  "NULLIF(current_setting('app.municipio_id', true), '')::uuid";

/**
 * [RF008 / RF024 / RF028 / NF015 / ADR-002 / ADR-016 / ADR-017]:
 * Criação do schema de recebimento, catálogo de produtos, fabricantes, lotes de estoque,
 * documentos de entrada e livro-razão de movimentações com RLS multi-tenant e grants DML.
 */
export class CreateRecebimentoTables1792000000000 implements MigrationInterface {
  name = "CreateRecebimentoTables1792000000000";

  /**
   * Executa a criação das tabelas de catálogo, estoque, recebimento e auditoria.
   * @param queryRunner - Executor de queries da migração TypeORM.
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Catálogo Global de Produtos / Medicamentos (REMUME)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.produtos (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        nome_comercial varchar(150),
        principio_ativo varchar(150) NOT NULL,
        dosagem varchar(80),
        forma_farmaceutica varchar(80),
        apresentacao varchar(150),
        unidade_medida varchar(40),
        categoria varchar(50) NOT NULL DEFAULT 'GERAL',
        antimicrobiano boolean NOT NULL DEFAULT false,
        ativo boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_produtos_principio_ativo ON public.produtos (lower(principio_ativo))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_produtos_nome_comercial ON public.produtos (lower(nome_comercial))`,
    );

    // 2. Catálogo Global de Fabricantes / Laboratórios Farmacêuticos
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.fabricantes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        razao_social varchar(180) NOT NULL,
        nome_fantasia varchar(120) NOT NULL,
        cnpj varchar(14) UNIQUE,
        ativo boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_fabricantes_nome_fantasia ON public.fabricantes (lower(nome_fantasia))`,
    );

    // 3. Documentos de Entrada (Guias CAF, Notas Fiscais, etc.)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.documentos_entrada (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE RESTRICT,
        ubs_id uuid NOT NULL REFERENCES public.unidades_saude(id) ON DELETE RESTRICT,
        numero_documento varchar(100) NOT NULL,
        tipo_documento varchar(40) NOT NULL DEFAULT 'GUIA_CAF',
        fornecedor_origem varchar(180) NOT NULL,
        data_recebimento timestamptz NOT NULL DEFAULT now(),
        usuario_recebedor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
        status varchar(20) NOT NULL DEFAULT 'CONCLUIDO',
        estornado_em timestamptz,
        estornado_por_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
        motivo_estorno text,
        observacoes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_documentos_entrada_numero CHECK (length(trim(numero_documento)) >= 2),
        CONSTRAINT chk_documentos_entrada_status CHECK (status IN ('CONCLUIDO', 'ESTORNADO'))
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_documentos_entrada_ubs_periodo ON public.documentos_entrada (ubs_id, data_recebimento DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_documentos_entrada_status ON public.documentos_entrada (status)`,
    );

    // 4. Tabela de Lotes de Estoque por UBS
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.lotes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE RESTRICT,
        ubs_id uuid NOT NULL REFERENCES public.unidades_saude(id) ON DELETE RESTRICT,
        produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
        fabricante_id uuid NOT NULL REFERENCES public.fabricantes(id) ON DELETE RESTRICT,
        numero_lote varchar(60) NOT NULL,
        data_validade date NOT NULL,
        saldo_atual integer NOT NULL DEFAULT 0,
        status varchar(20) NOT NULL DEFAULT 'ATIVO',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_lotes_saldo_nao_negativo CHECK (saldo_atual >= 0),
        CONSTRAINT uq_lotes_ubs_produto_lote_fabricante UNIQUE (ubs_id, produto_id, numero_lote, fabricante_id)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_lotes_ubs_produto_saldo ON public.lotes (ubs_id, produto_id, saldo_atual)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_lotes_validade ON public.lotes (data_validade ASC)`,
    );

    // 5. Linhas de Itens do Recebimento (Carga Física)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.recebimento_itens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE RESTRICT,
        documento_entrada_id uuid NOT NULL REFERENCES public.documentos_entrada(id) ON DELETE CASCADE,
        produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
        fabricante_id uuid NOT NULL REFERENCES public.fabricantes(id) ON DELETE RESTRICT,
        lote_id uuid NOT NULL REFERENCES public.lotes(id) ON DELETE RESTRICT,
        numero_lote varchar(60) NOT NULL,
        data_validade date NOT NULL,
        quantidade_recebida integer NOT NULL,
        observacoes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_recebimento_itens_qtd_positiva CHECK (quantidade_recebida > 0)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_recebimento_itens_doc ON public.recebimento_itens (documento_entrada_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_recebimento_itens_lote ON public.recebimento_itens (lote_id)`,
    );

    // 6. Livro-Razão de Movimentações de Estoque (Auditoria e Rastreabilidade RF028 / ADR-017)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.movimentacoes_estoque (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE RESTRICT,
        ubs_id uuid NOT NULL REFERENCES public.unidades_saude(id) ON DELETE RESTRICT,
        lote_id uuid NOT NULL REFERENCES public.lotes(id) ON DELETE RESTRICT,
        tipo_movimentacao varchar(40) NOT NULL,
        quantidade integer NOT NULL,
        saldo_anterior integer NOT NULL,
        saldo_posterior integer NOT NULL,
        documento_referencia_id uuid,
        tipo_documento_referencia varchar(40),
        usuario_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
        justificativa text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_movimentacoes_ubs_created ON public.movimentacoes_estoque (ubs_id, created_at DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_movimentacoes_lote_created ON public.movimentacoes_estoque (lote_id, created_at DESC)`,
    );

    // 7. Configuração de Row-Level Security (RLS) Multi-Tenant
    // --- documentos_entrada ---
    await queryRunner.query(
      `ALTER TABLE public.documentos_entrada ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE public.documentos_entrada FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      CREATE POLICY documentos_entrada_tenant_isolation ON public.documentos_entrada
        USING (municipio_id = ${GUC_MUNICIPIO})
        WITH CHECK (municipio_id = ${GUC_MUNICIPIO})
    `);

    // --- lotes ---
    await queryRunner.query(`ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE public.lotes FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY lotes_tenant_isolation ON public.lotes
        USING (municipio_id = ${GUC_MUNICIPIO})
        WITH CHECK (municipio_id = ${GUC_MUNICIPIO})
    `);

    // --- recebimento_itens ---
    await queryRunner.query(
      `ALTER TABLE public.recebimento_itens ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE public.recebimento_itens FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      CREATE POLICY recebimento_itens_tenant_isolation ON public.recebimento_itens
        USING (municipio_id = ${GUC_MUNICIPIO})
        WITH CHECK (municipio_id = ${GUC_MUNICIPIO})
    `);

    // --- movimentacoes_estoque ---
    await queryRunner.query(
      `ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE public.movimentacoes_estoque FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      CREATE POLICY movimentacoes_estoque_tenant_isolation ON public.movimentacoes_estoque
        USING (municipio_id = ${GUC_MUNICIPIO})
        WITH CHECK (municipio_id = ${GUC_MUNICIPIO})
    `);

    // 8. Permissões DML para a role de aplicação 'farmaubs_app'
    await queryRunner.query(
      `GRANT SELECT ON TABLE public.produtos TO farmaubs_app`,
    );
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE ON TABLE public.fabricantes TO farmaubs_app`,
    );
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE ON TABLE public.documentos_entrada, public.lotes, public.recebimento_itens, public.movimentacoes_estoque TO farmaubs_app`,
    );
    await queryRunner.query(
      `REVOKE DELETE ON TABLE public.produtos, public.fabricantes, public.documentos_entrada, public.lotes, public.recebimento_itens, public.movimentacoes_estoque FROM farmaubs_app`,
    );
  }

  /**
   * Reverte todas as políticas, índices e tabelas em ordem reversa estrita.
   * @param queryRunner - Executor de queries da migração TypeORM.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS movimentacoes_estoque_tenant_isolation ON public.movimentacoes_estoque`,
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS recebimento_itens_tenant_isolation ON public.recebimento_itens`,
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS lotes_tenant_isolation ON public.lotes`,
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS documentos_entrada_tenant_isolation ON public.documentos_entrada`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS public.movimentacoes_estoque`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.recebimento_itens`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.lotes`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.documentos_entrada`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.fabricantes`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.produtos`);
  }
}
