import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * [RF028 / ES-04]:
 * Garante na camada de banco que `movimentacoes_estoque.tipo_movimentacao` aceite apenas
 * os tipos canônicos suportados pelo livro-razão e pela rastreabilidade de lote.
 */
export class AddCheckTipoMovimentacaoEstoque1792400000000 implements MigrationInterface {
  name = "AddCheckTipoMovimentacaoEstoque1792400000000";

  /**
   * Adiciona a constraint CHECK `chk_movimentacoes_estoque_tipo_movimentacao`.
   * @param queryRunner - Executor de queries da migração TypeORM.
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.movimentacoes_estoque
      DROP CONSTRAINT IF EXISTS chk_movimentacoes_estoque_tipo_movimentacao
    `);
    await queryRunner.query(`
      ALTER TABLE public.movimentacoes_estoque
      ADD CONSTRAINT chk_movimentacoes_estoque_tipo_movimentacao
      CHECK (
        tipo_movimentacao IN (
          'ENTRADA_RECEBIMENTO',
          'ESTORNO_RECEBIMENTO',
          'SAIDA_DISPENSACAO',
          'ENTRADA_ESTORNO_DISPENSACAO',
          'AJUSTE_ENTRADA',
          'AJUSTE_SAIDA'
        )
      )
    `);
  }

  /**
   * Remove a constraint CHECK criada em `up`.
   * @param queryRunner - Executor de queries da migração TypeORM.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.movimentacoes_estoque
      DROP CONSTRAINT IF EXISTS chk_movimentacoes_estoque_tipo_movimentacao
    `);
  }
}
