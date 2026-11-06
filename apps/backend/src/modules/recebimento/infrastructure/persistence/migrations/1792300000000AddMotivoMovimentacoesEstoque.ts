import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * [RF009 / RF011 / RF028 / ADR-017 / ES-03]:
 * Adiciona a coluna `motivo` (nullable) em movimentacoes_estoque para registrar o motivo
 * sanitário dos ajustes manuais e revoga UPDATE de `farmaubs_app` para garantir a
 * imutabilidade do livro-razão de auditoria (append-only).
 */
export class AddMotivoMovimentacoesEstoque1792300000000 implements MigrationInterface {
  name = "AddMotivoMovimentacoesEstoque1792300000000";

  /**
   * Cria a coluna `motivo` e revoga permissão de UPDATE em `movimentacoes_estoque`.
   * @param queryRunner - Executor de queries da migração TypeORM.
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE public.movimentacoes_estoque ADD COLUMN IF NOT EXISTS motivo varchar(40)`,
    );
    await queryRunner.query(
      `REVOKE UPDATE ON TABLE public.movimentacoes_estoque FROM farmaubs_app`,
    );
  }

  /**
   * Restaura a permissão anterior e remove a coluna criada em `up`.
   * @param queryRunner - Executor de queries da migração TypeORM.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `GRANT UPDATE ON TABLE public.movimentacoes_estoque TO farmaubs_app`,
    );
    await queryRunner.query(
      `ALTER TABLE public.movimentacoes_estoque DROP COLUMN IF EXISTS motivo`,
    );
  }
}
