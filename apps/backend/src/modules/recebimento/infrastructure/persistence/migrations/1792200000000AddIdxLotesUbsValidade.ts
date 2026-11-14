import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * [RF005 / RF022 / NF007 / ES-02]:
 * Índice composto (ubs_id, data_validade) em lotes para os filtros de validade da
 * consulta de saldos. Mantém a leitura limitada aos lotes da própria UBS, em vez de
 * varrer o índice global idx_lotes_validade de toda a rede.
 */
export class AddIdxLotesUbsValidade1792200000000 implements MigrationInterface {
  name = "AddIdxLotesUbsValidade1792200000000";

  /**
   * Cria o índice composto de validade por UBS.
   * @param queryRunner - Executor de queries da migração TypeORM.
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_lotes_ubs_validade ON public.lotes (ubs_id, data_validade)`,
    );
  }

  /**
   * Remove o índice criado em `up`.
   * @param queryRunner - Executor de queries da migração TypeORM.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS public.idx_lotes_ubs_validade`,
    );
  }
}
