import { MigrationInterface, QueryRunner } from "typeorm";

export class AddScopeToAuthFunctions1788978574884 implements MigrationInterface {
  name = "AddScopeToAuthFunctions1788978574884";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // DROP obrigatório: PostgreSQL não permite CREATE OR REPLACE quando o tipo
    // de retorno muda (novos campos perfil_id e unidade_ids).
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS acesso_buscar_sessao_por_token(text)
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION acesso_buscar_sessao_por_token(p_token_hash text)
      RETURNS TABLE(
        id          uuid,
        usuario_id  uuid,
        municipio_id uuid,
        perfil_id   uuid,
        unidade_ids uuid[],
        status      character varying,
        expira_em   timestamptz,
        criado_em   timestamptz
      )
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT
          s.id,
          s.usuario_id,
          u.municipio_id,
          u.perfil_id,
          COALESCE(
            ARRAY_AGG(uu.unidade_id) FILTER (WHERE uu.unidade_id IS NOT NULL AND uu.ativo = true),
            '{}'::uuid[]
          ) AS unidade_ids,
          s.status,
          s.expira_em,
          s.criado_em
        FROM sessions s
        JOIN users u ON u.id = s.usuario_id
        LEFT JOIN user_units uu ON uu.usuario_id = s.usuario_id AND uu.ativo = true
        WHERE s.token_hash = p_token_hash::bpchar
          AND s.expira_em > now()
          AND s.status = 'ativa'
        GROUP BY s.id, s.usuario_id, u.municipio_id, u.perfil_id, s.status, s.expira_em, s.criado_em
        LIMIT 1;
      $$
    `);

    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION acesso_buscar_sessao_por_token(text) TO farmaubs_app
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS acesso_buscar_sessao_por_token(text)
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION acesso_buscar_sessao_por_token(p_token_hash text)
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

    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION acesso_buscar_sessao_por_token(text) TO farmaubs_app
    `);
  }
}
