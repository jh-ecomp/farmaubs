import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenamePerfilGestorToGerente1789920000000 implements MigrationInterface {
  name = 'RenamePerfilGestorToGerente1789920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE perfis
         SET codigo = 'GERENTE',
             nome = 'Gerente/Coordenador'
       WHERE codigo = 'GESTOR';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE perfis
         SET codigo = 'GESTOR',
             nome = 'Gestor/Coordenador'
       WHERE codigo = 'GERENTE';
    `);
  }
}
