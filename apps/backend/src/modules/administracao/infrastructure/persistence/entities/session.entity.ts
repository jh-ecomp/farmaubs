import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum SessionStatus {
  ATIVA = 'ativa',
  PENDENTE_2FA = 'pendente_2fa',
  REVOGADA = 'revogada',
}

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'usuario_id' })
  @Index('idx_sessions_usuario_id')
  usuarioId: string;

  @Column({ type: 'char', length: 64, unique: true, name: 'token_hash' })
  tokenHash: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: SessionStatus.ATIVA,
  })
  status: SessionStatus;

  @Column({ type: 'timestamptz', nullable: true, name: 'totp_verificado_em' })
  totpVerificadoEm: Date | null;

  @Column({ type: 'inet', nullable: true, name: 'ip_origem' })
  ipOrigem: string | null;

  @Column({ type: 'text', nullable: true, name: 'user_agent' })
  userAgent: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'criado_em' })
  criadoEm: Date;

  @Column({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    name: 'ultima_atividade_em',
  })
  ultimaAtividadeEm: Date;

  @Column({ type: 'timestamptz', name: 'expira_em' })
  @Index('idx_sessions_expira_em')
  expiraEm: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'revogada_em' })
  revogadaEm: Date | null;
}
