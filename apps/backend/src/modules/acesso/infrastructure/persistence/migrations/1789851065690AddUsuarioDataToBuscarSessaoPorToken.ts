import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUsuarioDataToBuscarSessaoPorToken1789851065690 implements MigrationInterface {
  name = "AddUsuarioDataToBuscarSessaoPorToken1789851065690";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS auth_buscar_sessao_por_token(text)`,
    );
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION auth_buscar_sessao_por_token(p_token_hash text)
      RETURNS TABLE(
        id uuid,
        usuario_id uuid,
        municipio_id uuid,
        perfil_codigo character varying,
        unidade_ids uuid[],
        nome_completo character varying,
        email character varying,
        deve_trocar_senha boolean,
        status character varying,
        expira_em timestamptz,
        criado_em timestamptz,
        ultima_atividade_em timestamptz
      )
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT
          s.id,
          s.usuario_id,
          u.municipio_id,
          p.codigo AS perfil_codigo,
          COALESCE(
            (SELECT array_agg(uu.unidade_id) FROM user_units uu WHERE uu.usuario_id = s.usuario_id AND uu.ativo = true),
            ARRAY[]::uuid[]
          ) AS unidade_ids,
          u.nome_completo,
          u.email,
          u.deve_trocar_senha,
          s.status,
          s.expira_em,
          s.criado_em,
          s.ultima_atividade_em
        FROM sessions s
        JOIN users u ON u.id = s.usuario_id
        JOIN perfis p ON p.id = u.perfil_id
        WHERE s.token_hash = p_token_hash::bpchar
          AND s.expira_em > now()
          AND s.status = 'ativa'
        LIMIT 1;
      $$;
    `);
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION auth_buscar_sessao_por_token(text) TO farmaubs_app`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS auth_buscar_sessao_por_token(text)`,
    );
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION auth_buscar_sessao_por_token(p_token_hash text)
      RETURNS TABLE(
        id uuid,
        usuario_id uuid,
        municipio_id uuid,
        perfil_id uuid,
        unidade_ids uuid[],
        status character varying,
        expira_em timestamptz,
        criado_em timestamptz,
        ultima_atividade_em timestamptz
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
            (SELECT array_agg(uu.unidade_id) FROM user_units uu WHERE uu.usuario_id = s.usuario_id AND uu.ativo = true),
            ARRAY[]::uuid[]
          ) AS unidade_ids,
          s.status,
          s.expira_em,
          s.criado_em,
          s.ultima_atividade_em
        FROM sessions s
        JOIN users u ON u.id = s.usuario_id
        WHERE s.token_hash = p_token_hash::bpchar
          AND s.expira_em > now()
          AND s.status = 'ativa'
        LIMIT 1;
      $$;
    `);
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION auth_buscar_sessao_por_token(text) TO farmaubs_app`,
    );
  }
}
