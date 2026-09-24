import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserDataToBuscarUsuarioPorEmail1789851065700 implements MigrationInterface {
  name = "AddUserDataToBuscarUsuarioPorEmail1789851065700";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Atualizar auth_buscar_usuario_por_email para retornar perfil_codigo e unidade_ids
    // de forma atômica e SECURITY DEFINER (bypass controlado de RLS no pré-auth).
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS auth_buscar_usuario_por_email(text)
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION auth_buscar_usuario_por_email(p_email text)
      RETURNS TABLE (
        id uuid,
        municipio_id uuid,
        nome_completo character varying,
        email character varying,
        senha_hash character varying,
        perfil_id uuid,
        perfil_codigo character varying,
        unidade_ids uuid[],
        ativo boolean,
        deve_trocar_senha boolean,
        tentativas_login_falhas smallint,
        bloqueado_ate timestamptz
      )
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT
          u.id,
          u.municipio_id,
          u.nome_completo,
          u.email,
          u.senha_hash,
          u.perfil_id,
          p.codigo AS perfil_codigo,
          COALESCE(
            (SELECT array_agg(uu.unidade_id) FROM user_units uu WHERE uu.usuario_id = u.id AND uu.ativo = true),
            ARRAY[]::uuid[]
          ) AS unidade_ids,
          u.ativo,
          u.deve_trocar_senha,
          u.tentativas_login_falhas,
          u.bloqueado_ate
        FROM users u
        LEFT JOIN perfis p ON p.id = u.perfil_id
        WHERE lower(u.email) = lower(p_email)
        LIMIT 1;
      $$;
    `);

    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION auth_buscar_usuario_por_email(text) TO farmaubs_app
    `);

    // 2. Criar auth_buscar_escopo_usuario com SECURITY DEFINER e GRANT
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION auth_buscar_escopo_usuario(p_usuario_id uuid)
      RETURNS TABLE (
        perfil_id uuid,
        unidade_ids uuid[]
      )
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT
          u.perfil_id,
          COALESCE(
            (SELECT array_agg(uu.unidade_id) FROM user_units uu WHERE uu.usuario_id = u.id AND uu.ativo = true),
            ARRAY[]::uuid[]
          ) AS unidade_ids
        FROM users u
        WHERE u.id = p_usuario_id
        LIMIT 1;
      $$;
    `);

    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION auth_buscar_escopo_usuario(uuid) TO farmaubs_app
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS auth_buscar_escopo_usuario(uuid)
    `);

    await queryRunner.query(`
      DROP FUNCTION IF EXISTS auth_buscar_usuario_por_email(text)
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION auth_buscar_usuario_por_email(p_email text)
      RETURNS TABLE (
        id uuid,
        municipio_id uuid,
        nome_completo character varying,
        email character varying,
        senha_hash character varying,
        perfil_id uuid,
        ativo boolean,
        deve_trocar_senha boolean,
        tentativas_login_falhas smallint,
        bloqueado_ate timestamptz
      )
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT
          id,
          municipio_id,
          nome_completo,
          email,
          senha_hash,
          perfil_id,
          ativo,
          deve_trocar_senha,
          tentativas_login_falhas,
          bloqueado_ate
        FROM users
        WHERE lower(email) = lower(p_email)
        LIMIT 1;
      $$;
    `);

    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION auth_buscar_usuario_por_email(text) TO farmaubs_app
    `);
  }
}
