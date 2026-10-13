import { MigrationInterface, QueryRunner } from "typeorm";

const FUNCOES_SESSAO = [
  "auth_criar_sessao(uuid, text, timestamptz, inet, text)",
  "auth_buscar_sessao_por_token(text)",
  "auth_renovar_sessao(uuid, timestamptz)",
  "auth_revogar_sessao(uuid)",
  "auth_revogar_todas_sessoes(uuid)",
  "auth_limpar_sessoes_expiradas(int)",
];

export class HardenSessionFunctions1791416441872 implements MigrationInterface {
  name = "HardenSessionFunctions1791416441872";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Lookup: exige usuário ativo (defesa em profundidade além do revogarTodas)
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
          AND u.ativo = true
        LIMIT 1;
      $$;
    `);

    // 2. Revogação idempotente: não sobrescreve revogada_em
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
         WHERE id = p_session_id
           AND status <> 'revogada';
      END;
      $$;
    `);

    // 3. Revogação em massa cobre sessões pendentes de 2FA
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
           AND status IN ('ativa', 'pendente_2fa');
      END;
      $$;
    `);

    // 4. Limpeza: rejeita retenção nula/negativa (evitaria apagar sessões ativas)
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION auth_limpar_sessoes_expiradas(p_dias_retencao int)
      RETURNS int
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
      DECLARE
        v_total int;
      BEGIN
        IF p_dias_retencao IS NULL OR p_dias_retencao < 0 THEN
          RAISE EXCEPTION 'p_dias_retencao deve ser um inteiro >= 0';
        END IF;

        WITH deleted AS (
          DELETE FROM sessions
          WHERE expira_em < now() - make_interval(days => p_dias_retencao)
          RETURNING id
        )
        SELECT count(*)::int INTO v_total FROM deleted;

        RETURN v_total;
      END;
      $$;
    `);

    // 5. EXECUTE só para a role da aplicação
    for (const fn of FUNCOES_SESSAO) {
      await queryRunner.query(`REVOKE ALL ON FUNCTION ${fn} FROM PUBLIC`);
      await queryRunner.query(`GRANT EXECUTE ON FUNCTION ${fn} TO farmaubs_app`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const fn of FUNCOES_SESSAO) {
      await queryRunner.query(`GRANT EXECUTE ON FUNCTION ${fn} TO PUBLIC`);
    }

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION auth_limpar_sessoes_expiradas(p_dias_retencao int)
      RETURNS int
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
      DECLARE
        v_total int;
      BEGIN
        WITH deleted AS (
          DELETE FROM sessions
          WHERE expira_em < now() - make_interval(days => p_dias_retencao)
          RETURNING id
        )
        SELECT count(*)::int INTO v_total FROM deleted;

        RETURN v_total;
      END;
      $$;
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
      $$;
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
      $$;
    `);

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
  }
}
