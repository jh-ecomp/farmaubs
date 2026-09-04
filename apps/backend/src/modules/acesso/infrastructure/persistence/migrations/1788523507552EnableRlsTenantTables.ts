/*
 * No login bem-sucedido, o caso de uso já conhece o municipio_id → faz SET LOCAL app.municipio_id
 * e então o UPDATE users (reset de falhas, ultimo_login_em) roda sob RLS normalmente.
 * Só o pré-auth precisa das funções.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

const GUC = "NULLIF(current_setting('app.municipio_id', true), '')::uuid";

export class EnableRlsTenantTables1788523507552 implements MigrationInterface {
  name = 'EnableRlsTenantTables1788523507552';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- users ---
    await queryRunner.query(`ALTER TABLE users ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE users FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY users_tenant_isolation ON users
        USING (municipio_id = ${GUC})
        WITH CHECK (municipio_id = ${GUC})
    `);

    // --- unidades_saude ---
    await queryRunner.query(
      `ALTER TABLE unidades_saude ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE unidades_saude FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      CREATE POLICY unidades_saude_tenant_isolation ON unidades_saude
        USING (municipio_id = ${GUC})
        WITH CHECK (municipio_id = ${GUC})
    `);

    // --- user_units (escopo via unidade_id -> unidades_saude.municipio_id) ---
    await queryRunner.query(`ALTER TABLE user_units ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE user_units FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY user_units_tenant_isolation ON user_units
        USING (
          EXISTS (
            SELECT 1 FROM unidades_saude us
            WHERE us.id = user_units.unidade_id
              AND us.municipio_id = ${GUC}
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM unidades_saude us
            WHERE us.id = user_units.unidade_id
              AND us.municipio_id = ${GUC}
          )
        )
    `);

    // --- sessions (escopo via usuario_id -> users.municipio_id) ---
    await queryRunner.query(`ALTER TABLE sessions ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE sessions FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY sessions_tenant_isolation ON sessions
        USING (
          EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = sessions.usuario_id
              AND u.municipio_id = ${GUC}
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = sessions.usuario_id
              AND u.municipio_id = ${GUC}
          )
        )
    `);

    // --- bypass controlado para rotas públicas (login / sessão) ---
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION auth_buscar_usuario_por_email(p_email text)
      RETURNS TABLE (
        id uuid, municipio_id uuid, nome_completo character varying,
        email character varying, senha_hash character varying, perfil_id uuid,
        ativo boolean, deve_trocar_senha boolean,
        tentativas_login_falhas smallint, bloqueado_ate timestamptz
      )
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT id, municipio_id, nome_completo, email, senha_hash, perfil_id,
               ativo, deve_trocar_senha, tentativas_login_falhas, bloqueado_ate
        FROM users
        WHERE lower(email) = lower(p_email)
        LIMIT 1;
      $$
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION auth_registrar_falha_login(p_user_id uuid)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
      BEGIN
        UPDATE users
           SET tentativas_login_falhas = tentativas_login_falhas + 1,
               bloqueado_ate = CASE
                 WHEN tentativas_login_falhas + 1 >= 5
                   THEN now() + interval '15 minutes'
                 ELSE bloqueado_ate
               END
         WHERE id = p_user_id;
      END;
      $$
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION auth_buscar_sessao_por_token(p_token_hash text)
      RETURNS TABLE (
        id uuid, usuario_id uuid, municipio_id uuid, status character varying,
        expira_em timestamptz, criado_em timestamptz
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS sessions_tenant_isolation ON sessions`,
    );
    await queryRunner.query(`ALTER TABLE sessions NO FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE sessions DISABLE ROW LEVEL SECURITY`);

    await queryRunner.query(
      `DROP POLICY IF EXISTS user_units_tenant_isolation ON user_units`,
    );
    await queryRunner.query(
      `ALTER TABLE user_units NO FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE user_units DISABLE ROW LEVEL SECURITY`,
    );

    await queryRunner.query(
      `DROP POLICY IF EXISTS unidades_saude_tenant_isolation ON unidades_saude`,
    );
    await queryRunner.query(
      `ALTER TABLE unidades_saude NO FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE unidades_saude DISABLE ROW LEVEL SECURITY`,
    );

    await queryRunner.query(
      `DROP POLICY IF EXISTS users_tenant_isolation ON users`,
    );
    await queryRunner.query(`ALTER TABLE users NO FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE users DISABLE ROW LEVEL SECURITY`);

    await queryRunner.query(
      `DROP FUNCTION IF EXISTS auth_buscar_sessao_por_token(text)`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS auth_registrar_falha_login(uuid)`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS auth_buscar_usuario_por_email(text)`,
    );
  }
}
