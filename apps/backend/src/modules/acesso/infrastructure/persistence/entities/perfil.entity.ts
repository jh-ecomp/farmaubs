import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

@Entity('perfis')
export class PerfilEntity {
  @PrimaryColumn('uuid', {
    default: () => 'uuidv7()',
  })
  id: string;

  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
    nullable: false,
  })
  codigo: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: false,
  })
  nome: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  descricao?: string;

  @Column({
    type: 'boolean',
    default: true,
    nullable: false,
  })
  ativo: boolean;

  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'now()',
    nullable: false,
  })
  created_at: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    default: () => 'now()',
    nullable: false,
  })
  updated_at: Date;

  @BeforeInsert()
  @BeforeUpdate()
  normalizeCodigo(): void {
    if (this.codigo) {
      this.codigo = this.codigo.trim().toUpperCase();
    }
  }
}
