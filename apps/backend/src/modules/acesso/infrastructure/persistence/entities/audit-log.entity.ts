import { Entity, PrimaryColumn, Column, CreateDateColumn } from "typeorm";

@Entity("audit_logs")
export class AuditLogEntity {
  @PrimaryColumn("uuid", {
    default: () => "uuidv7()",
  })
  id: string;

  @Column({ name: "usuario_executor_id", type: "uuid" })
  usuarioExecutorId: string;

  @Column({ name: "usuario_alvo_id", type: "uuid" })
  usuarioAlvoId: string;

  @Column({ name: "tipo_operacao", type: "varchar", length: 50 })
  tipoOperacao: string;

  @Column({ type: "jsonb", default: {} })
  detalhes: Record<string, unknown>;

  @CreateDateColumn({
    name: "created_at",
    type: "timestamptz",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date;
}
