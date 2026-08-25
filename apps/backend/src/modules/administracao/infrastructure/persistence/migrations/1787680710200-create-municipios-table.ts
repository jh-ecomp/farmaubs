import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateMunicipiosTable1787680710200 implements MigrationInterface {
  name = 'CreateMunicipiosTable1787680710200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'municipios',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuidv7()',
          },
          {
            name: 'nome',
            type: 'varchar',
            length: '150',
            isNullable: false,
          },
          {
            name: 'uf',
            type: 'char',
            length: '2',
            isNullable: false,
          },
          {
            name: 'codigo_ibge',
            type: 'varchar',
            length: '7',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'ativo',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('municipios', true);
  }
}
