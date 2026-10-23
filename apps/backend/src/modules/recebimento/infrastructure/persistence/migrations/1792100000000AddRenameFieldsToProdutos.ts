import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * [RF008 / RENAME / REMUME]:
 * Adiciona campos oficiais da Relação Nacional de Medicamentos Essenciais (RENAME/CATMAT/SUS) à tabela produtos.
 * - codigo_catmat: Código do Catálogo de Materiais do Governo Federal (Comprasnet / BNAFAR)
 * - codigo_atc: Classificação Anatômica, Terapêutica e Química (OMS)
 * - componente: Componente da Assistência Farmacêutica (BASICO, ESTRATEGICO, ESPECIALIZADO)
 * - controlado: Flag indicando se é sujeito à Portaria SVS/MS nº 344/1998 (controle especial)
 */
export class AddRenameFieldsToProdutos1792100000000 implements MigrationInterface {
  name = "AddRenameFieldsToProdutos1792100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.produtos
        ADD COLUMN IF NOT EXISTS codigo_catmat varchar(20),
        ADD COLUMN IF NOT EXISTS codigo_atc varchar(10),
        ADD COLUMN IF NOT EXISTS componente varchar(30) NOT NULL DEFAULT 'BASICO',
        ADD COLUMN IF NOT EXISTS controlado boolean NOT NULL DEFAULT false;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_produtos_codigo_catmat ON public.produtos (codigo_catmat);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_produtos_codigo_catmat;
    `);

    await queryRunner.query(`
      ALTER TABLE public.produtos
        DROP COLUMN IF EXISTS codigo_catmat,
        DROP COLUMN IF EXISTS codigo_atc,
        DROP COLUMN IF EXISTS componente,
        DROP COLUMN IF EXISTS controlado;
    `);
  }
}
