import { QueryRunner } from 'typeorm';
import { CreatePerfis1787681200000 } from './1787681200000create-perfis-table';

describe('CreatePerfis1787681200000 (migration unit)', () => {
  let migration: CreatePerfis1787681200000;
  let queryRunner: jest.Mocked<QueryRunner>;

  beforeEach(() => {
    migration = new CreatePerfis1787681200000();
    queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<QueryRunner>;
  });

  it('deve possuir o nome de migration com timestamp para o TypeORM', () => {
    expect(migration.name).toBe('CreatePerfis1787681200000');
  });

  describe('up()', () => {
    it('deve executar a criação da tabela "perfis", comentário de escopo e seed idempotente', async () => {
      await migration.up(queryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(3);

      const calls = (queryRunner.query as jest.Mock).mock.calls as [string][];
      const createTableQuery = calls[0][0];
      expect(createTableQuery).toContain('CREATE TABLE perfis');
      expect(createTableQuery).toContain(
        'id uuid PRIMARY KEY DEFAULT gen_random_uuid()',
      );
      expect(createTableQuery).toContain('codigo varchar(50) NOT NULL UNIQUE');
      expect(createTableQuery).toContain('nome varchar(100) NOT NULL');
      expect(createTableQuery).toContain('descricao text');
      expect(createTableQuery).toContain('ativo boolean NOT NULL DEFAULT true');
      expect(createTableQuery).toContain(
        'created_at timestamptz NOT NULL DEFAULT now()',
      );
      expect(createTableQuery).toContain(
        'updated_at timestamptz NOT NULL DEFAULT now()',
      );

      const commentQuery = calls[1][0];
      expect(commentQuery).toContain(
        "COMMENT ON TABLE perfis IS 'scope:global | catalogo de perfis RBAC (ADR-006, NF009)'",
      );

      const seedQuery = calls[2][0];
      expect(seedQuery).toContain(
        'INSERT INTO perfis (codigo, nome, descricao) VALUES',
      );
      expect(seedQuery).toContain('ADMINISTRADOR');
      expect(seedQuery).toContain('Administrador');
      expect(seedQuery).toContain('GESTOR');
      expect(seedQuery).toContain('Gestor/Coordenador');
      expect(seedQuery).toContain('FARMACEUTICO_RESPONSAVEL');
      expect(seedQuery).toContain('Farmacêutico Responsável');
      expect(seedQuery).toContain('FARMACEUTICO_RESIDENTE');
      expect(seedQuery).toContain('Farmacêutico Residente');
      expect(seedQuery).toContain('ON CONFLICT (codigo) DO NOTHING');
    });

    it('deve propagar erro caso queryRunner.query falhe no up', async () => {
      (queryRunner.query as jest.Mock).mockRejectedValueOnce(
        new Error('Database connection error'),
      );

      await expect(migration.up(queryRunner)).rejects.toThrow(
        'Database connection error',
      );
    });
  });

  describe('down()', () => {
    it('deve executar o drop da tabela "perfis"', async () => {
      await migration.down(queryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      const calls = (queryRunner.query as jest.Mock).mock.calls as [string][];
      const dropQuery = calls[0][0];
      expect(dropQuery).toContain('DROP TABLE IF EXISTS perfis');
    });

    it('deve propagar erro caso queryRunner.query falhe no down', async () => {
      (queryRunner.query as jest.Mock).mockRejectedValueOnce(
        new Error('Drop table error'),
      );

      await expect(migration.down(queryRunner)).rejects.toThrow(
        'Drop table error',
      );
    });
  });
});
