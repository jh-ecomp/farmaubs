import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * [RF009 / RF011 / RF028 / ES-03]:
 * Adiciona a coluna `motivo` (nullable) em movimentacoes_estoque para registrar o motivo
 * sanitário dos ajustes manuais, preservando as movimentações já existentes.
 */
export class AddMotivoMovimentacoesEstoque1792300000000 implements MigrationInterface {
  name = "AddMotivoMovimentacoesEstoque1792300000000";

  /**
   * Cria a coluna `motivo`.
   * @param queryRunner - Executor de queries da migração TypeORM.
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE public.movimentacoes_estoque ADD COLUMN IF NOT EXISTS motivo varchar(40)`,
    );
  }

  /**
   * Remove a coluna criada em `up`.
   * @param queryRunner - Executor de queries da migração TypeORM.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE public.movimentacoes_estoque DROP COLUMN IF EXISTS motivo`,
    );
  }
}
