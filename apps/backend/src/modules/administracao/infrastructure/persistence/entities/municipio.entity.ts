import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

@Entity('municipios')
export class MunicipioEntity {
  @PrimaryColumn('uuid', {
    default: () => 'uuidv7()',
  })
  id: string;

  @Column({
    type: 'varchar',
    length: 150,
    nullable: false,
  })
  nome: string;

  @Column({
    type: 'char',
    length: 2,
    nullable: false,
  })
  uf: string;

  @Column({
    type: 'varchar',
    length: 7,
    unique: true,
    nullable: false,
  })
  codigo_ibge: string;

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
  normalizeUf(): void {
    if (this.uf) {
      this.uf = this.uf.trim().toUpperCase();
    }
  }
}
