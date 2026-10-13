import { QueryRunner } from 'typeorm';
import { GrantDmlFarmaubsApp1788525896383 } from './1788525896383GrantDmlFarmaubsApp';

describe('GrantDmlFarmaubsApp1788525896383 (migration unit - AC-28)', () => {
  let migration: GrantDmlFarmaubsApp1788525896383;
  let queryRunner: jest.Mocked<QueryRunner>;

  const sqls = () =>
    ((queryRunner.query as jest.Mock).mock.calls as [string][]).map((c) => c[0]);

  beforeEach(() => {
    migration = new GrantDmlFarmaubsApp1788525896383();
    queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<QueryRunner>;
  });

  it('deve possuir o nome da migration com timestamp canônico para o TypeORM', () => {
    expect(migration.name).toBe('GrantDmlFarmaubsApp1788525896383');
  });

  describe('up()', () => {
    it('deve conceder privilégios estritos de DML, catálogos e funções para farmaubs_app', async () => {
      await migration.up(queryRunner);

      const executedSqls = sqls();
      expect(executedSqls.some((s) => s.includes('GRANT USAGE ON SCHEMA public TO farmaubs_app'))).toBe(true);

      // Catálogos - apenas SELECT
      expect(executedSqls.some((s) => s.includes('GRANT SELECT ON TABLE municipios TO farmaubs_app'))).toBe(true);
      expect(executedSqls.some((s) => s.includes('GRANT SELECT ON TABLE perfis TO farmaubs_app'))).toBe(true);

      // Tabelas de domínio - DML completo
      expect(executedSqls.some((s) => s.includes('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users TO farmaubs_app'))).toBe(true);
      expect(executedSqls.some((s) => s.includes('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE unidades_saude TO farmaubs_app'))).toBe(true);
      expect(executedSqls.some((s) => s.includes('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_units TO farmaubs_app'))).toBe(true);
      expect(executedSqls.some((s) => s.includes('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sessions TO farmaubs_app'))).toBe(true);

      // Funções de autenticação
      expect(executedSqls.some((s) => s.includes('GRANT EXECUTE ON FUNCTION auth_buscar_usuario_por_email(text) TO farmaubs_app'))).toBe(true);
      expect(executedSqls.some((s) => s.includes('GRANT EXECUTE ON FUNCTION auth_registrar_falha_login(uuid) TO farmaubs_app'))).toBe(true);
      expect(executedSqls.some((s) => s.includes('GRANT EXECUTE ON FUNCTION auth_buscar_sessao_por_token(text) TO farmaubs_app'))).toBe(true);

      // Default privileges
      expect(executedSqls.some((s) => s.includes('ALTER DEFAULT PRIVILEGES IN SCHEMA public') && s.includes('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO farmaubs_app'))).toBe(true);
      expect(executedSqls.some((s) => s.includes('ALTER DEFAULT PRIVILEGES IN SCHEMA public') && s.includes('GRANT EXECUTE ON FUNCTIONS TO farmaubs_app'))).toBe(true);
    });
  });

  describe('down()', () => {
    it('deve revogar permissões de funções de forma defensiva com tratamento de undefined_function (AC-28)', async () => {
      await migration.down(queryRunner);

      const executedSqls = sqls();

      // Revogação de privilégios padrão
      expect(executedSqls.some((s) => s.includes('ALTER DEFAULT PRIVILEGES IN SCHEMA public') && s.includes('REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM farmaubs_app'))).toBe(true);
      expect(executedSqls.some((s) => s.includes('ALTER DEFAULT PRIVILEGES IN SCHEMA public') && s.includes('REVOKE EXECUTE ON FUNCTIONS FROM farmaubs_app'))).toBe(true);

      // As 3 funções de autenticação devem ser protegidas por blocos defensivos PL/pgSQL
      const defensivos = executedSqls.filter(
        (s) => s.includes('DO $$') && s.includes('WHEN undefined_function THEN NULL;'),
      );
      expect(defensivos).toHaveLength(3);

      expect(defensivos.some((s) => s.includes('auth_buscar_sessao_por_token(text)'))).toBe(true);
      expect(defensivos.some((s) => s.includes('auth_registrar_falha_login(uuid)'))).toBe(true);
      expect(defensivos.some((s) => s.includes('auth_buscar_usuario_por_email(text)'))).toBe(true);

      // Revogação de tabelas e schema
      expect(executedSqls.some((s) => s.includes('REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE sessions FROM farmaubs_app'))).toBe(true);
      expect(executedSqls.some((s) => s.includes('REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE user_units FROM farmaubs_app'))).toBe(true);
      expect(executedSqls.some((s) => s.includes('REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE unidades_saude FROM farmaubs_app'))).toBe(true);
      expect(executedSqls.some((s) => s.includes('REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE users FROM farmaubs_app'))).toBe(true);
      expect(executedSqls.some((s) => s.includes('REVOKE SELECT ON TABLE perfis FROM farmaubs_app'))).toBe(true);
      expect(executedSqls.some((s) => s.includes('REVOKE SELECT ON TABLE municipios FROM farmaubs_app'))).toBe(true);
      expect(executedSqls.some((s) => s.includes('REVOKE USAGE ON SCHEMA public FROM farmaubs_app'))).toBe(true);
    });
  });
});
