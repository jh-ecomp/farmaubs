import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateUnidadesSaudeTable1787681100000 implements MigrationInterface {
  name = 'CreateUnidadesSaudeTable1787681100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'unidades_saude',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuidv7()',
          },
          {
            name: 'municipio_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'nome',
            type: 'varchar',
            length: '200',
            isNullable: false,
          },
          {
            name: 'endereco',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'responsavel_tecnico',
            type: 'varchar',
            length: '150',
            isNullable: false,
          },
          {
            name: 'caf_lead_time_days',
            type: 'integer',
            default: 15,
            isNullable: false,
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
        foreignKeys: [
          new TableForeignKey({
            name: 'fk_unidades_saude_municipio_id',
            columnNames: ['municipio_id'],
            referencedTableName: 'municipios',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
          }),
        ],
        indices: [
          new TableIndex({
            name: 'idx_unidades_saude_municipio_id',
            columnNames: ['municipio_id'],
          }),
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('unidades_saude', true);
  }
}
