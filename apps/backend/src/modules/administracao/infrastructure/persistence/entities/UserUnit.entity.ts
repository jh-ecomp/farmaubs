import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from "typeorm";
import { User } from "./User"; // Ajuste o caminho conforme sua estrutura
import { UnidadeSaude } from "./UnidadeSaude"; // Ajuste o caminho conforme sua estrutura

@Entity("user_units")
@Unique("uq_user_units_usuario_unidade", ["usuarioId", "unidadeId"])
@Index("idx_user_units_usuario_id", ["usuarioId"])
@Index("idx_user_units_unidade_id", ["unidadeId"])
export class UserUnit {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "usuario_id", type: "uuid" })
  usuarioId!: string;

  @Column({ name: "unidade_id", type: "uuid" })
  unidadeId!: string;

  @Column({ type: "boolean", default: true })
  ativo!: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  // --- Relacionamentos ---

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "usuario_id", referencedColumnName: "id" })
  usuario!: User;

  @ManyToOne(() => UnidadeSaude, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "unidade_id", referencedColumnName: "id" })
  unidade!: UnidadeSaude;
}
