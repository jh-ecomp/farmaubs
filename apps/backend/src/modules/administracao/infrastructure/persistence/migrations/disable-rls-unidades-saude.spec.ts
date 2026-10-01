import { QueryRunner } from 'typeorm';
import { DisableRlsUnidadesSaude1789910000000 } from './1789910000000disable-rls-unidades-saude';

describe('DisableRlsUnidadesSaude1789910000000 (migration unit)', () => {
  let migration: DisableRlsUnidadesSaude1789910000000;
  let queryRunner: jest.Mocked<QueryRunner>;

  beforeEach(() => {
    migration = new DisableRlsUnidadesSaude1789910000000();
    queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<QueryRunner>;
  });

  it('deve possuir o nome de migration com timestamp para o TypeORM', () => {
    expect(migration.name).toBe('DisableRlsUnidadesSaude1789910000000');
  });

  describe('up()', () => {
    it('deve executar o drop da policy de tenant isolation e desabilitar RLS em unidades_saude', async () => {
      await migration.up(queryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(3);

      const calls = (queryRunner.query as jest.Mock).mock.calls as [string][];
      expect(calls[0][0]).toContain('DROP POLICY IF EXISTS unidades_saude_tenant_isolation ON unidades_saude');
      expect(calls[1][0]).toContain('ALTER TABLE unidades_saude NO FORCE ROW LEVEL SECURITY');
      expect(calls[2][0]).toContain('ALTER TABLE unidades_saude DISABLE ROW LEVEL SECURITY');
    });

    it('deve propagar erro caso queryRunner.query falhe no up', async () => {
      (queryRunner.query as jest.Mock).mockRejectedValueOnce(
        new Error('Database connection lost'),
      );

      await expect(migration.up(queryRunner)).rejects.toThrow(
        'Database connection lost',
      );
    });
  });

  describe('down()', () => {
    it('deve reativar RLS, habilitar FORCE e recriar policy de isolamento em unidades_saude', async () => {
      await migration.down(queryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(3);

      const calls = (queryRunner.query as jest.Mock).mock.calls as [string][];
      expect(calls[0][0]).toContain('ALTER TABLE unidades_saude ENABLE ROW LEVEL SECURITY');
      expect(calls[1][0]).toContain('ALTER TABLE unidades_saude FORCE ROW LEVEL SECURITY');
      expect(calls[2][0]).toContain('CREATE POLICY unidades_saude_tenant_isolation ON unidades_saude');
      expect(calls[2][0]).toContain("app.municipio_id");
    });

    it('deve propagar erro caso queryRunner.query falhe no down', async () => {
      (queryRunner.query as jest.Mock).mockRejectedValueOnce(
        new Error('Permission denied'),
      );

      await expect(migration.down(queryRunner)).rejects.toThrow(
        'Permission denied',
      );
    });
  });
});
