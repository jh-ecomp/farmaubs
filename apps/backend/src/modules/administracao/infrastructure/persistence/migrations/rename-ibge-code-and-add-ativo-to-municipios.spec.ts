import { QueryRunner } from 'typeorm';
import { RenameIbgeCodeAndAddAtivoToMunicipios1789851065800 } from './1789851065800RenameIbgeCodeAndAddAtivoToMunicipios';

describe('RenameIbgeCodeAndAddAtivoToMunicipios1789851065800 (migration unit)', () => {
  let migration: RenameIbgeCodeAndAddAtivoToMunicipios1789851065800;
  let queryRunner: jest.Mocked<QueryRunner>;

  beforeEach(() => {
    migration = new RenameIbgeCodeAndAddAtivoToMunicipios1789851065800();
    queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<QueryRunner>;
  });

  it('deve possuir o nome de migration com timestamp para o TypeORM', () => {
    expect(migration.name).toBe(
      'RenameIbgeCodeAndAddAtivoToMunicipios1789851065800',
    );
  });

  describe('up()', () => {
    it('deve executar o rename da coluna ibge_code para codigo_ibge e adicionar ativo', async () => {
      await migration.up(queryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(3);

      const calls = (queryRunner.query as jest.Mock).mock.calls as [string][];
      expect(calls[0][0]).toContain(
        'ALTER TABLE municipios RENAME COLUMN ibge_code TO codigo_ibge',
      );
      expect(calls[1][0]).toContain(
        'ALTER TABLE municipios ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true',
      );
      expect(calls[2][0]).toContain('municipios_ibge_code_key');
    });

    it('deve propagar erro caso queryRunner.query falhe no up', async () => {
      (queryRunner.query as jest.Mock).mockRejectedValueOnce(
        new Error('Database error'),
      );

      await expect(migration.up(queryRunner)).rejects.toThrow('Database error');
    });
  });

  describe('down()', () => {
    it('deve reverter o rename e dropar a coluna ativo', async () => {
      await migration.down(queryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(3);

      const calls = (queryRunner.query as jest.Mock).mock.calls as [string][];
      expect(calls[0][0]).toContain('municipios_codigo_ibge_key');
      expect(calls[1][0]).toContain(
        'ALTER TABLE municipios DROP COLUMN IF EXISTS ativo',
      );
      expect(calls[2][0]).toContain(
        'ALTER TABLE municipios RENAME COLUMN codigo_ibge TO ibge_code',
      );
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
