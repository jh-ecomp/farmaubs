import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAuthConcluirTrocaDeSenha1789851065710 implements MigrationInterface {
  name = "CreateAuthConcluirTrocaDeSenha1789851065710";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Cria a função de segurança para concluir a troca de senha (RF003)
    // Permite que o próprio usuário autenticado altere sua senha e limpe a flag
    // deve_trocar_senha sem ser barrado por isolamento de tenant / RLS de pré-troca.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION auth_concluir_troca_de_senha(
        p_usuario_id uuid,
        p_senha_hash text,
        p_atualizado_em timestamptz
      )
      RETURNS boolean
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
      DECLARE
        v_affected integer;
      BEGIN
        UPDATE users
           SET senha_hash = p_senha_hash,
               deve_trocar_senha = false,
               senha_atualizada_em = p_atualizado_em,
               tentativas_login_falhas = 0,
               bloqueado_ate = NULL,
               updated_at = now()
         WHERE id = p_usuario_id;

        GET DIAGNOSTICS v_affected = ROW_COUNT;
        RETURN v_affected > 0;
      END;
      $$;
    `);

    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION auth_concluir_troca_de_senha(uuid, text, timestamptz) TO farmaubs_app;
    `);

    // 2. Cria a função de segurança para emitir/redefinir senha provisória (RF003, AC-23)
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION auth_definir_senha_provisoria(
        p_usuario_id uuid,
        p_senha_hash text
      )
      RETURNS boolean
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
      DECLARE
        v_affected integer;
      BEGIN
        UPDATE users
           SET senha_hash = p_senha_hash,
               deve_trocar_senha = true,
               tentativas_login_falhas = 0,
               bloqueado_ate = NULL,
               senha_atualizada_em = now(),
               updated_at = now()
         WHERE id = p_usuario_id;

        GET DIAGNOSTICS v_affected = ROW_COUNT;
        RETURN v_affected > 0;
      END;
      $$;
    `);

    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION auth_definir_senha_provisoria(uuid, text) TO farmaubs_app;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS auth_definir_senha_provisoria(uuid, text);
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS auth_concluir_troca_de_senha(uuid, text, timestamptz);
    `);
  }
}
