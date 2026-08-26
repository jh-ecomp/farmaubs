import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MunicipioEntity } from './municipio.entity';

@Entity('unidades_saude')
export class UnidadeSaudeEntity {
  @PrimaryColumn('uuid', {
    default: () => 'uuidv7()',
  })
  id: string;

  @Index('idx_unidades_saude_municipio_id')
  @Column({
    type: 'uuid',
    nullable: false,
  })
  municipio_id: string;

  @ManyToOne(() => MunicipioEntity, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'municipio_id' })
  municipio: MunicipioEntity;

  @Column({
    type: 'varchar',
    length: 200,
    nullable: false,
  })
  nome: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  endereco: string;

  @Column({
    type: 'varchar',
    length: 150,
    nullable: false,
  })
  responsavel_tecnico: string;

  @Column({
    type: 'integer',
    default: 15,
    nullable: false,
  })
  caf_lead_time_days: number;

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
}
