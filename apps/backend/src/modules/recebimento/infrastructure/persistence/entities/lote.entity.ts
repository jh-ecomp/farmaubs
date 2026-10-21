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
import { UnidadeSaudeEntity } from "../../../../administracao/infrastructure/persistence/entities/unidade-saude.entity";
import { ProdutoEntity } from "./produto.entity";
import { FabricanteEntity } from "./fabricante.entity";

/**
 * [RF008 / NF015]: Entidade TypeORM para lotes físicos de medicamentos por UBS.
 */
@Entity("lotes")
@Index("uq_lotes_ubs_produto_lote_fabricante", [
  "ubs_id",
  "produto_id",
  "numero_lote",
  "fabricante_id",
], { unique: true })
export class LoteEntity {
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

  @Index("idx_lotes_ubs_id")
  @Column({
    type: "uuid",
    nullable: false,
  })
  ubs_id: string;

  @ManyToOne(() => UnidadeSaudeEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "ubs_id" })
  unidadeSaude?: UnidadeSaudeEntity;

  @Column({
    type: "uuid",
    nullable: false,
  })
  produto_id: string;

  @ManyToOne(() => ProdutoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "produto_id" })
  produto?: ProdutoEntity;

  @Column({
    type: "uuid",
    nullable: false,
  })
  fabricante_id: string;

  @ManyToOne(() => FabricanteEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "fabricante_id" })
  fabricante?: FabricanteEntity;

  @Column({
    type: "varchar",
    length: 60,
    nullable: false,
  })
  numero_lote: string;

  @Index("idx_lotes_validade")
  @Column({
    type: "date",
    nullable: false,
  })
  data_validade: string;

  @Column({
    type: "integer",
    default: 0,
    nullable: false,
  })
  saldo_atual: number;

  @Column({
    type: "varchar",
    length: 20,
    default: "ATIVO",
    nullable: false,
  })
  status: string;

  @CreateDateColumn({
    type: "timestamptz",
    default: () => "CURRENT_TIMESTAMP",
  })
  created_at: Date;

  @UpdateDateColumn({
    type: "timestamptz",
    default: () => "CURRENT_TIMESTAMP",
  })
  updated_at: Date;
}
