import { QueryRunner } from 'typeorm';
import { CreateUsersTable1788180806000 } from './1788180806000create-users-table';

describe('CreateUsersTable1788180806000 (migration unit)', () => {
  let migration: CreateUsersTable1788180806000;
  let queryRunnerMock: jest.Mocked<QueryRunner>;

  beforeEach(() => {
    migration = new CreateUsersTable1788180806000();
    queryRunnerMock = {
      query: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<QueryRunner>;
  });

  describe('up()', () => {
    it('deve executar a criação da tabela "users", FKs e índices', async () => {
      await migration.up(queryRunnerMock);

      expect(queryRunnerMock.query).toHaveBeenCalledTimes(1);
      const queryText = queryRunnerMock.query.mock.calls[0][0] as string;

      expect(queryText).toContain('CREATE TABLE IF NOT EXISTS users');
      expect(queryText).toContain('municipio_id UUID NOT NULL');
      expect(queryText).toContain('nome_completo VARCHAR(150) NOT NULL');
      expect(queryText).toContain('senha_hash VARCHAR(60) NOT NULL');
      expect(queryText).toContain('perfil_id UUID NOT NULL');
      expect(queryText).toContain(
        'deve_trocar_senha BOOLEAN NOT NULL DEFAULT TRUE',
      );
      expect(queryText).toContain(
        'tentativas_login_falhas SMALLINT NOT NULL DEFAULT 0',
      );
      expect(queryText).toContain(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email))',
      );
    });

    it('deve propagar erro caso queryRunner.query falhe no up', async () => {
      const error = new Error('Database execution failed');
      queryRunnerMock.query.mockRejectedValueOnce(error);

      await expect(migration.up(queryRunnerMock)).rejects.toThrow(error);
    });
  });

  describe('down()', () => {
    it('deve executar o drop da tabela "users" e seus índices', async () => {
      await migration.down(queryRunnerMock);

      expect(queryRunnerMock.query).toHaveBeenCalledTimes(1);
      const queryText = queryRunnerMock.query.mock.calls[0][0] as string;

      expect(queryText).toContain('DROP TABLE IF EXISTS users');
      expect(queryText).toContain('DROP INDEX IF EXISTS idx_users_email_lower');
    });

    it('deve propagar erro caso queryRunner.query falhe no down', async () => {
      const error = new Error('Database execution failed');
      queryRunnerMock.query.mockRejectedValueOnce(error);

      await expect(migration.down(queryRunnerMock)).rejects.toThrow(error);
    });
  });
});
