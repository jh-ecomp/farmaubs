import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { MunicipioEntity } from "../../../../administracao/infrastructure/persistence/entities/municipio.entity";
import { UnidadeSaudeEntity } from "../../../../administracao/infrastructure/persistence/entities/unidade-saude.entity";
import { User } from "../../../../administracao/infrastructure/persistence/entities/user.entity";
import { LoteEntity } from "./lote.entity";

/**
 * [RF028 / ADR-017]: Entidade TypeORM para o livro-razão imutável de movimentações de estoque.
 */
@Entity("movimentacoes_estoque")
export class MovimentacaoEstoqueEntity {
  @PrimaryColumn("uuid", {
    default: () => "gen_random_uuid()",
  })
  id: string;

  @Column({
    type: "uuid",
    nullable: false,
  })
  municipio_id: string;

  @ManyToOne(() => MunicipioEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "municipio_id" })
  municipio?: MunicipioEntity;

  @Index("idx_movimentacoes_ubs_id")
  @Column({
    type: "uuid",
    nullable: false,
  })
  ubs_id: string;

  @ManyToOne(() => UnidadeSaudeEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "ubs_id" })
  unidadeSaude?: UnidadeSaudeEntity;

  @Index("idx_movimentacoes_lote_id")
  @Column({
    type: "uuid",
    nullable: false,
  })
  lote_id: string;

  @ManyToOne(() => LoteEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "lote_id" })
  lote?: LoteEntity;

  @Column({
    type: "varchar",
    length: 40,
    nullable: false,
  })
  tipo_movimentacao: string;

  @Column({
    type: "integer",
    nullable: false,
  })
  quantidade: number;

  @Column({
    type: "integer",
    nullable: false,
  })
  saldo_anterior: number;

  @Column({
    type: "integer",
    nullable: false,
  })
  saldo_posterior: number;

  @Column({
    type: "uuid",
    nullable: true,
  })
  documento_referencia_id?: string | null;

  @Column({
    type: "varchar",
    length: 40,
    nullable: true,
  })
  tipo_documento_referencia?: string | null;

  @Column({
    type: "uuid",
    nullable: false,
  })
  usuario_id: string;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "usuario_id" })
  usuario?: User;

  @Column({
    type: "text",
    nullable: true,
  })
  justificativa?: string | null;

  @Index("idx_movimentacoes_created_at")
  @CreateDateColumn({
    type: "timestamptz",
    default: () => "CURRENT_TIMESTAMP",
  })
  created_at: Date;
}
