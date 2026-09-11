import { MigrationInterface, QueryRunner } from "typeorm";

export class FixAuthBuscarSessaoExpiracao1788700000000
  implements MigrationInterface
{
  name = "FixAuthBuscarSessaoExpiracao1788700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION auth_buscar_sessao_por_token(p_token_hash text)
      RETURNS TABLE(
        id uuid, usuario_id uuid, municipio_id uuid,
        status character varying, expira_em timestamptz, criado_em timestamptz
      )
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT s.id, s.usuario_id, u.municipio_id, s.status, s.expira_em, s.criado_em
        FROM sessions s
        JOIN users u ON u.id = s.usuario_id
        WHERE s.token_hash = p_token_hash::bpchar
          AND s.expira_em > now()
          AND s.status = 'ativa'
        LIMIT 1;
      $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION auth_buscar_sessao_por_token(p_token_hash text)
      RETURNS TABLE(
        id uuid, usuario_id uuid, municipio_id uuid,
        status character varying, expira_em timestamptz, criado_em timestamptz
      )
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT s.id, s.usuario_id, u.municipio_id, s.status, s.expira_em, s.criado_em
        FROM sessions s
        JOIN users u ON u.id = s.usuario_id
        WHERE s.token_hash = p_token_hash::bpchar
        LIMIT 1;
      $$
    `);
  }
}
