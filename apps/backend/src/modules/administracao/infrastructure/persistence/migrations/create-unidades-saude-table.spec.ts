import { QueryRunner } from 'typeorm';
import { CreateUnidadesSaude } from './create-unidades-saude-table';

describe('CreateUnidadesSaude (migration unit)', () => {
  let migration: CreateUnidadesSaude;
  let queryRunner: jest.Mocked<QueryRunner>;

  beforeEach(() => {
    migration = new CreateUnidadesSaude();
    queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<QueryRunner>;
  });

  describe('up()', () => {
    it('deve executar a criação da tabela "unidades_saude", índice e comentários de escopo', async () => {
      await migration.up(queryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(4);

      const createTableQuery = (queryRunner.query as jest.Mock).mock
        .calls[0][0];
      expect(createTableQuery).toContain('CREATE TABLE unidades_saude');
      expect(createTableQuery).toContain(
        'id uuid PRIMARY KEY DEFAULT gen_random_uuid()',
      );
      expect(createTableQuery).toContain(
        'municipio_id uuid NOT NULL REFERENCES municipios(id)',
      );
      expect(createTableQuery).toContain('nome text NOT NULL');
      expect(createTableQuery).toContain('endereco text');
      expect(createTableQuery).toContain('responsavel_tecnico text');
      expect(createTableQuery).toContain(
        'caf_lead_time_days integer NOT NULL DEFAULT 15',
      );
      expect(createTableQuery).toContain(
        'created_at timestamptz NOT NULL DEFAULT now()',
      );
      expect(createTableQuery).toContain(
        'updated_at timestamptz NOT NULL DEFAULT now()',
      );

      const createIndexQuery = (queryRunner.query as jest.Mock).mock
        .calls[1][0];
      expect(createIndexQuery).toContain(
        'CREATE INDEX idx_unidades_saude_municipio_id',
      );
      expect(createIndexQuery).toContain('ON unidades_saude (municipio_id)');

      const commentTableQuery = (queryRunner.query as jest.Mock).mock
        .calls[2][0];
      expect(commentTableQuery).toContain(
        "COMMENT ON TABLE unidades_saude IS 'scope:global | topologia (RF026); municipio_id e FK de dado, nao escopo de RLS (ADR-016)'",
      );

      const commentColQuery = (queryRunner.query as jest.Mock).mock.calls[3][0];
      expect(commentColQuery).toContain(
        "COMMENT ON COLUMN unidades_saude.municipio_id IS 'FK de topologia; tabela global sem RLS, lida no bootstrap de sessao pre-auth'",
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
    it('deve executar o drop da tabela "unidades_saude"', async () => {
      await migration.down(queryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      const dropQuery = (queryRunner.query as jest.Mock).mock.calls[0][0];
      expect(dropQuery).toContain('DROP TABLE IF EXISTS unidades_saude');
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
