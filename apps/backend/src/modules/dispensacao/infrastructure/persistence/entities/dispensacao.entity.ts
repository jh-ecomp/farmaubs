import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from "typeorm";
import { MunicipioEntity } from "../../../../administracao/infrastructure/persistence/entities/municipio.entity";
import { UnidadeSaudeEntity } from "../../../../administracao/infrastructure/persistence/entities/unidade-saude.entity";
import { User } from "../../../../administracao/infrastructure/persistence/entities/user.entity";
import { PacienteEntity } from "./paciente.entity";
import { DispensacaoItemEntity } from "./dispensacao-item.entity";

@Entity("dispensacoes")
@Index("idx_dispensacoes_unidade_periodo", ["unidade_id", "created_at"])
@Index("idx_dispensacoes_paciente", ["paciente_id", "created_at"])
export class DispensacaoEntity {
  @PrimaryColumn("uuid", { default: () => "uuidv7()" })
  id: string;

  @Column({ type: "uuid", nullable: false })
  municipio_id: string;

  @ManyToOne(() => MunicipioEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "municipio_id" })
  municipio?: MunicipioEntity;

  @Column({ type: "uuid", nullable: false })
  unidade_id: string;

  @ManyToOne(() => UnidadeSaudeEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "unidade_id" })
  unidade?: UnidadeSaudeEntity;

  @Column({ type: "uuid", nullable: false })
  paciente_id: string;

  @ManyToOne(() => PacienteEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "paciente_id" })
  paciente?: PacienteEntity;

  @Column({ type: "uuid", nullable: false })
  dispensador_id: string;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "dispensador_id" })
  dispensador?: User;

  @Column({ type: "varchar", length: 40, nullable: true })
  numero_atendimento?: string | null;

  @Column({ type: "varchar", length: 20, default: "concluida", nullable: false })
  status: "concluida" | "estornada";

  @Column({ type: "date", nullable: true })
  receita_emissao_em?: string | null;

  @Column({ type: "timestamptz", nullable: true })
  estornado_em?: Date | null;

  @Column({ type: "text", nullable: true })
  motivo_estorno?: string | null;

  @Column({ type: "uuid", nullable: true })
  estornado_por_id?: string | null;

  @ManyToOne(() => User, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "estornado_por_id" })
  estornado_por?: User | null;

  @OneToMany(() => DispensacaoItemEntity, (item) => item.dispensacao)
  itens?: DispensacaoItemEntity[];

  @CreateDateColumn({ type: "timestamptz", default: () => "now()" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz", default: () => "now()" })
  updated_at: Date;
}
