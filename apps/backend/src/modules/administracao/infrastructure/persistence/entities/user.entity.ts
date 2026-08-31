import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index('idx_users_municipio_id')
  @Column({ type: 'uuid', nullable: false })
  municipio_id!: string;

  @Column({ type: 'varchar', length: 150, nullable: false })
  nome_completo!: string;

  @Index('idx_users_email_lower', { unique: true })
  @Column({ type: 'varchar', length: 255, nullable: false })
  email!: string;

  @Column({ type: 'varchar', length: 60, nullable: false, select: false })
  senha_hash!: string;

  @Index('idx_users_perfil_id')
  @Column({ type: 'uuid', nullable: false })
  perfil_id!: string;

  @Column({ type: 'boolean', default: true, nullable: false })
  ativo!: boolean;

  @Column({ type: 'boolean', default: true, nullable: false })
  deve_trocar_senha!: boolean;

  @Column({ type: 'smallint', default: 0, nullable: false })
  tentativas_login_falhas!: number;

  @Column({ type: 'timestamptz', nullable: true })
  bloqueado_ate!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  senha_atualizada_em!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  ultimo_login_em!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updated_at!: Date;
}
