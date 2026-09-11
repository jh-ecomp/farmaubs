import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAuthFunctions1788600000000 implements MigrationInterface {
  name = "CreateAuthFunctions1788600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION auth_resetar_estado_login(p_user_id uuid)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
      BEGIN
        UPDATE users
           SET tentativas_login_falhas = 0,
               bloqueado_ate = NULL,
               ultimo_login_em = now()
         WHERE id = p_user_id;
      END;
      $$
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION auth_criar_sessao(
        p_usuario_id uuid,
        p_token_hash  text,
        p_expira_em   timestamptz,
        p_ip_origem   inet,
        p_user_agent  text
      )
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
      BEGIN
        INSERT INTO sessions (usuario_id, token_hash, status, expira_em, ip_origem, user_agent)
        VALUES (p_usuario_id, p_token_hash, 'ativa', p_expira_em, p_ip_origem, p_user_agent);
      END;
      $$
    `);

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

    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION auth_resetar_estado_login(uuid) TO farmaubs_app
    `);

    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION auth_criar_sessao(uuid, text, timestamptz, inet, text) TO farmaubs_app
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION auth_renovar_sessao(p_session_id uuid, p_expira_em timestamptz)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
      BEGIN
        UPDATE sessions
           SET ultima_atividade_em = now(),
               expira_em = p_expira_em
         WHERE id = p_session_id
           AND status = 'ativa';
      END;
      $$
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION auth_revogar_sessao(p_session_id uuid)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
      BEGIN
        UPDATE sessions
           SET status = 'revogada',
               revogada_em = now()
         WHERE id = p_session_id;
      END;
      $$
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION auth_revogar_todas_sessoes(p_usuario_id uuid)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
      BEGIN
        UPDATE sessions
           SET status = 'revogada',
               revogada_em = now()
         WHERE usuario_id = p_usuario_id
           AND status = 'ativa';
      END;
      $$
    `);

    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION auth_renovar_sessao(uuid, timestamptz) TO farmaubs_app
    `);

    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION auth_revogar_sessao(uuid) TO farmaubs_app
    `);

    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION auth_revogar_todas_sessoes(uuid) TO farmaubs_app
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS auth_criar_sessao(uuid, text, timestamptz, inet, text)`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS auth_resetar_estado_login(uuid)`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS auth_buscar_sessao_por_token(text)`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS auth_renovar_sessao(uuid, timestamptz)`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS auth_revogar_sessao(uuid)`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS auth_revogar_todas_sessoes(uuid)`,
    );
  }
}
