import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { MunicipioEntity } from "../../../../administracao/infrastructure/persistence/entities/municipio.entity";

@Entity("pacientes")
@Index("idx_pacientes_municipio_cpf", ["municipio_id", "cpf"], { unique: true })
@Index("idx_pacientes_municipio_cns", ["municipio_id", "cns"], { unique: true })
export class PacienteEntity {
  @PrimaryColumn("uuid", { default: () => "uuidv7()" })
  id: string;

  @Column({ type: "uuid", nullable: false })
  municipio_id: string;

  @ManyToOne(() => MunicipioEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "municipio_id" })
  municipio?: MunicipioEntity;

  @Column({ type: "varchar", length: 15, nullable: false })
  cns: string;

  @Column({ type: "varchar", length: 11, nullable: false })
  cpf: string;

  @Column({ type: "varchar", length: 150, nullable: false })
  nome_completo: string;

  @Column({ type: "date", nullable: false })
  data_nascimento: string;

  @Column({ type: "boolean", default: true, nullable: false })
  ativo: boolean;

  @CreateDateColumn({ type: "timestamptz", default: () => "now()" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz", default: () => "now()" })
  updated_at: Date;
}
