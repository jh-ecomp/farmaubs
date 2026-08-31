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
    default: () => 'gen_random_uuid()',
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
  municipio?: MunicipioEntity;

  @Column({
    type: 'text',
    nullable: false,
  })
  nome: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  endereco?: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  responsavel_tecnico?: string;

  @Column({
    type: 'integer',
    default: 15,
    nullable: false,
  })
  caf_lead_time_days: number;

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
