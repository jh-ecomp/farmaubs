import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AC-02 #39 — GRANTs de DML para a role de aplicação farmaubs_app (ADR-016).
 *
 * A API conecta como farmaubs_app (DML, não-dona das tabelas); as migrations
 * rodam como owner. Sem estes GRANTs, a role não executa nenhuma operação —
 * fail-closed, mas inoperante.
 *
 * - Catálogos (municipios, perfis): somente leitura.
 * - Tabelas tenant-scoped (users, unidades_saude, user_units, sessions): DML.
 * - Funções de bypass pré-autenticação (#38): EXECUTE.
 * - Default privileges: tabelas/funções criadas em migrations futuras pelo
 *   owner recebem os mesmos grants automaticamente.
 */
export class GrantDmlFarmaubsApp1788525896383 implements MigrationInterface {
  name = 'GrantDmlFarmaubsApp1788525896383';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Acesso ao schema — defensivo: em PG 15+ o PUBLIC já tem USAGE, mas o
    // grant explícito documenta a intenção e sobrevive a hardening futuro.
    await queryRunner.query(`GRANT USAGE ON SCHEMA public TO farmaubs_app`);

    // Catálogos globais — somente leitura
    await queryRunner.query(`GRANT SELECT ON TABLE municipios TO farmaubs_app`);
    await queryRunner.query(`GRANT SELECT ON TABLE perfis TO farmaubs_app`);

    // Tabelas tenant-scoped — DML completo (RLS restringe ao município)
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users TO farmaubs_app`,
    );
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE unidades_saude TO farmaubs_app`,
    );
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_units TO farmaubs_app`,
    );
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sessions TO farmaubs_app`,
    );

    // Funções de bypass pré-autenticação (#38)
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION auth_buscar_usuario_por_email(text) TO farmaubs_app`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION auth_registrar_falha_login(uuid) TO farmaubs_app`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION auth_buscar_sessao_por_token(text) TO farmaubs_app`,
    );

    // Default privileges — sem FOR ROLE explícito, valem para o papel que
    // executa a migration (o owner), independente do nome em cada ambiente.
    await queryRunner.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public
         GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO farmaubs_app`,
    );
    await queryRunner.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public
         GRANT EXECUTE ON FUNCTIONS TO farmaubs_app`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public
         REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM farmaubs_app`,
    );
    await queryRunner.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public
         REVOKE EXECUTE ON FUNCTIONS FROM farmaubs_app`,
    );

    await queryRunner.query(
      `REVOKE EXECUTE ON FUNCTION auth_buscar_sessao_por_token(text) FROM farmaubs_app`,
    );
    await queryRunner.query(
      `REVOKE EXECUTE ON FUNCTION auth_registrar_falha_login(uuid) FROM farmaubs_app`,
    );
    await queryRunner.query(
      `REVOKE EXECUTE ON FUNCTION auth_buscar_usuario_por_email(text) FROM farmaubs_app`,
    );

    await queryRunner.query(
      `REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE sessions FROM farmaubs_app`,
    );
    await queryRunner.query(
      `REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE user_units FROM farmaubs_app`,
    );
    await queryRunner.query(
      `REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE unidades_saude FROM farmaubs_app`,
    );
    await queryRunner.query(
      `REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE users FROM farmaubs_app`,
    );

    await queryRunner.query(`REVOKE SELECT ON TABLE perfis FROM farmaubs_app`);
    await queryRunner.query(
      `REVOKE SELECT ON TABLE municipios FROM farmaubs_app`,
    );

    // Remove apenas o grant explícito; o USAGE via PUBLIC (default em PG 15+)
    // permanece, então a role não perde acesso ao schema.
    await queryRunner.query(`REVOKE USAGE ON SCHEMA public FROM farmaubs_app`);
  }
}
