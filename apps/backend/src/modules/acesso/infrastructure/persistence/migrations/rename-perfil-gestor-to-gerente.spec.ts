import { QueryRunner } from 'typeorm';
import { RenamePerfilGestorToGerente1789920000000 } from './1789920000000RenamePerfilGestorToGerente';

describe('RenamePerfilGestorToGerente1789920000000 (migration unit)', () => {
  let migration: RenamePerfilGestorToGerente1789920000000;
  let queryRunner: jest.Mocked<QueryRunner>;

  beforeEach(() => {
    migration = new RenamePerfilGestorToGerente1789920000000();
    queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<QueryRunner>;
  });

  it('deve possuir o nome de migration com timestamp para o TypeORM', () => {
    expect(migration.name).toBe('RenamePerfilGestorToGerente1789920000000');
  });

  describe('up()', () => {
    it('deve executar o UPDATE de GESTOR para GERENTE', async () => {
      await migration.up(queryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      const sql = (queryRunner.query as jest.Mock).mock.calls[0][0];
      expect(sql).toContain("SET codigo = 'GERENTE'");
      expect(sql).toContain("WHERE codigo = 'GESTOR'");
    });
  });

  describe('down()', () => {
    it('deve reverter o UPDATE de GERENTE para GESTOR', async () => {
      await migration.down(queryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      const sql = (queryRunner.query as jest.Mock).mock.calls[0][0];
      expect(sql).toContain("SET codigo = 'GESTOR'");
      expect(sql).toContain("WHERE codigo = 'GERENTE'");
    });
  });
});
