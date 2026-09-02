import { QueryRunner } from 'typeorm';
import { CreateMunicipios1787680710200 } from './1787680710200create-municipios-table';

describe('CreateMunicipios1787680710200 (migration unit)', () => {
  let migration: CreateMunicipios1787680710200;
  let queryRunner: jest.Mocked<QueryRunner>;

  beforeEach(() => {
    migration = new CreateMunicipios1787680710200();
    queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<QueryRunner>;
  });

  it('deve possuir o nome de migration com timestamp para o TypeORM', () => {
    expect(migration.name).toBe('CreateMunicipios1787680710200');
  });

  describe('up()', () => {
    it('deve executar a criação da tabela "municipios" e o comentário de escopo', async () => {
      await migration.up(queryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(2);

      const calls = (queryRunner.query as jest.Mock).mock.calls as [string][];
      const createTableQuery = calls[0][0];
      expect(createTableQuery).toContain('CREATE TABLE municipios');
      expect(createTableQuery).toContain(
        'id uuid PRIMARY KEY DEFAULT uuidv7()',
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

      const commentQuery = calls[1][0];
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
      const calls = (queryRunner.query as jest.Mock).mock.calls as [string][];
      const dropQuery = calls[0][0];
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
