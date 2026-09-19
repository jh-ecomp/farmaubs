import { MigrationInterface, QueryRunner } from "typeorm";

/*
 * buscarEscopoUsuario (acesso-pg.repository.ts) fazia SELECT raw direto em
 * `users`, que tem FORCE ROW LEVEL SECURITY. No momento em que essa query
 * roda, o GUC app.municipio_id ainda está vazio (SET LOCAL do
 * TransactionInterceptor seta '' no início da requisição, pois o
 * municipio_id do usuário só é conhecido depois da autenticação). Resultado:
 * policy users_tenant_isolation bloqueia a linha e a busca de escopo falha
 * com "Usuário não encontrado" mesmo para credenciais válidas.
 *
 * Fix: função SECURITY DEFINER, no mesmo padrão de
 * acesso_buscar_usuario_por_email / acesso_registrar_falha_login /
 * acesso_buscar_sessao_por_token (ver EnableRlsTenantTables1788523507552),
 * para que o pré-auth tenha um caminho explícito que ignora RLS.
 */
export class AddAuthBuscarEscopoUsuarioFunction1788981962916 implements MigrationInterface {
  name = "AddAuthBuscarEscopoUsuarioFunction1788981962916";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION acesso_buscar_escopo_usuario(p_usuario_id uuid)
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
            ARRAY_AGG(uu.unidade_id) FILTER (WHERE uu.unidade_id IS NOT NULL AND uu.ativo = true),
            '{}'::uuid[]
          ) AS unidade_ids
        FROM users u
        LEFT JOIN user_units uu ON uu.usuario_id = u.id AND uu.ativo = true
        WHERE u.id = p_usuario_id
        GROUP BY u.perfil_id
      $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS acesso_buscar_escopo_usuario(uuid)`,
    );
  }
}
