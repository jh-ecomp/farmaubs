import { QueryRunner, Table } from 'typeorm';
import { CreateMunicipiosTable1787680710200 } from './1787680710200-create-municipios-table';

describe('CreateMunicipiosTable1787680710200 (migration unit)', () => {
  let migration: CreateMunicipiosTable1787680710200;
  let queryRunner: jest.Mocked<QueryRunner>;

  beforeEach(() => {
    migration = new CreateMunicipiosTable1787680710200();
    queryRunner = {
      createTable: jest.fn().mockResolvedValue(undefined),
      dropTable: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<QueryRunner>;
  });

  it('deve possuir o nome de migration correto', () => {
    expect(migration.name).toBe('CreateMunicipiosTable1787680710200');
  });

  describe('up()', () => {
    it('deve criar a tabela "municipios" com ifNotExist=true e a estrutura correta', async () => {
      await migration.up(queryRunner);

      expect(queryRunner.createTable).toHaveBeenCalledTimes(1);

      const [table, ifNotExist] = queryRunner.createTable.mock.calls[0] as [
        Table,
        boolean,
      ];

      expect(ifNotExist).toBe(true);
      expect(table).toBeInstanceOf(Table);
      expect(table.name).toBe('municipios');
      expect(table.columns).toHaveLength(7);

      const columnsMap = new Map(table.columns.map((c) => [c.name, c]));

      // Validação do campo 'id'
      const idCol = columnsMap.get('id');
      expect(idCol).toBeDefined();
      expect(idCol?.type).toBe('uuid');
      expect(idCol?.isPrimary).toBe(true);
      expect(idCol?.default).toBe('uuidv7()');

      // Validação do campo 'nome'
      const nomeCol = columnsMap.get('nome');
      expect(nomeCol).toBeDefined();
      expect(nomeCol?.type).toBe('varchar');
      expect(nomeCol?.length).toBe('150');
      expect(nomeCol?.isNullable).toBe(false);

      // Validação do campo 'uf'
      const ufCol = columnsMap.get('uf');
      expect(ufCol).toBeDefined();
      expect(ufCol?.type).toBe('char');
      expect(ufCol?.length).toBe('2');
      expect(ufCol?.isNullable).toBe(false);

      // Validação do campo 'codigo_ibge'
      const ibgeCol = columnsMap.get('codigo_ibge');
      expect(ibgeCol).toBeDefined();
      expect(ibgeCol?.type).toBe('varchar');
      expect(ibgeCol?.length).toBe('7');
      expect(ibgeCol?.isNullable).toBe(false);
      expect(ibgeCol?.isUnique).toBe(true);

      // Validação do campo 'ativo'
      const ativoCol = columnsMap.get('ativo');
      expect(ativoCol).toBeDefined();
      expect(ativoCol?.type).toBe('boolean');
      expect(ativoCol?.default).toBe(true);
      expect(ativoCol?.isNullable).toBe(false);

      // Validação do campo 'created_at'
      const createdAtCol = columnsMap.get('created_at');
      expect(createdAtCol).toBeDefined();
      expect(createdAtCol?.type).toBe('timestamptz');
      expect(createdAtCol?.default).toBe('now()');
      expect(createdAtCol?.isNullable).toBe(false);

      // Validação do campo 'updated_at'
      const updatedAtCol = columnsMap.get('updated_at');
      expect(updatedAtCol).toBeDefined();
      expect(updatedAtCol?.type).toBe('timestamptz');
      expect(updatedAtCol?.default).toBe('now()');
      expect(updatedAtCol?.isNullable).toBe(false);
    });

    it('deve propagar erro caso queryRunner.createTable falhe', async () => {
      queryRunner.createTable.mockRejectedValueOnce(
        new Error('Database connection lost'),
      );

      await expect(migration.up(queryRunner)).rejects.toThrow(
        'Database connection lost',
      );
    });
  });

  describe('down()', () => {
    it('deve remover a tabela "municipios" com ifExist=true', async () => {
      await migration.down(queryRunner);

      expect(queryRunner.dropTable).toHaveBeenCalledTimes(1);
      expect(queryRunner.dropTable).toHaveBeenCalledWith('municipios', true);
    });

    it('deve propagar erro caso queryRunner.dropTable falhe', async () => {
      queryRunner.dropTable.mockRejectedValueOnce(
        new Error('Permission denied'),
      );

      await expect(migration.down(queryRunner)).rejects.toThrow(
        'Permission denied',
      );
    });
  });
});
