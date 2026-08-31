import { QueryRunner } from 'typeorm';
import { CreateMunicipios } from './create-municipios-table';

describe('CreateMunicipios (migration unit)', () => {
  let migration: CreateMunicipios;
  let queryRunner: jest.Mocked<QueryRunner>;

  beforeEach(() => {
    migration = new CreateMunicipios();
    queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<QueryRunner>;
  });

  describe('up()', () => {
    it('deve executar a criação da tabela "municipios" e o comentário de escopo', async () => {
      await migration.up(queryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(2);

      const createTableQuery = (queryRunner.query as jest.Mock).mock
        .calls[0][0];
      expect(createTableQuery).toContain('CREATE TABLE municipios');
      expect(createTableQuery).toContain(
        'id uuid PRIMARY KEY DEFAULT gen_random_uuid()',
      );
      expect(createTableQuery).toContain('nome text NOT NULL');
      expect(createTableQuery).toContain('uf char(2) NOT NULL');
      expect(createTableQuery).toContain('ibge_code char(7) UNIQUE');
      expect(createTableQuery).toContain(
        'created_at timestamptz NOT NULL DEFAULT now()',
      );
      expect(createTableQuery).toContain(
        'updated_at timestamptz NOT NULL DEFAULT now()',
      );

      const commentQuery = (queryRunner.query as jest.Mock).mock.calls[1][0];
      expect(commentQuery).toContain(
        "COMMENT ON TABLE municipios IS 'scope:global | registro de tenants (ADR-002, ADR-016)'",
      );
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
    it('deve executar o drop da tabela "municipios"', async () => {
      await migration.down(queryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      const dropQuery = (queryRunner.query as jest.Mock).mock.calls[0][0];
      expect(dropQuery).toContain('DROP TABLE IF EXISTS municipios');
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
