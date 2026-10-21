import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { MunicipioEntity } from "../../../administracao/infrastructure/persistence/entities/municipio.entity";
import { DocumentoEntradaEntity } from "./documento-entrada.entity";
import { ProdutoEntity } from "./produto.entity";
import { FabricanteEntity } from "./fabricante.entity";
import { LoteEntity } from "./lote.entity";

/**
 * [RF008]: Entidade TypeORM para as linhas individuais de itens recebidos.
 */
@Entity("recebimento_itens")
export class RecebimentoItemEntity {
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

  @Index("idx_recebimento_itens_doc_id")
  @Column({
    type: "uuid",
    nullable: false,
  })
  documento_entrada_id: string;

  @ManyToOne(() => DocumentoEntradaEntity, (doc) => doc.itens, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "documento_entrada_id" })
  documentoEntrada?: DocumentoEntradaEntity;

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

  @Index("idx_recebimento_itens_lote_id")
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
    length: 60,
    nullable: false,
  })
  numero_lote: string;

  @Column({
    type: "date",
    nullable: false,
  })
  data_validade: string;

  @Column({
    type: "integer",
    nullable: false,
  })
  quantidade_recebida: number;

  @Column({
    type: "text",
    nullable: true,
  })
  observacoes?: string | null;

  @CreateDateColumn({
    type: "timestamptz",
    default: () => "CURRENT_TIMESTAMP",
  })
  created_at: Date;
}
