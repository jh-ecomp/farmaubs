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
import { LoteEntity } from "../../../../recebimento/infrastructure/persistence/entities/lote.entity";
import { ProdutoEntity } from "../../../../recebimento/infrastructure/persistence/entities/produto.entity";
import { DispensacaoEntity } from "./dispensacao.entity";

@Entity("dispensacao_itens")
@Index("idx_dispensacao_itens_dispensacao", ["dispensacao_id"])
@Index("idx_dispensacao_itens_lote", ["lote_id"])
export class DispensacaoItemEntity {
  @PrimaryColumn("uuid", { default: () => "uuidv7()" })
  id: string;

  @Column({ type: "uuid", nullable: false })
  municipio_id: string;

  @ManyToOne(() => MunicipioEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "municipio_id" })
  municipio?: MunicipioEntity;

  @Column({ type: "uuid", nullable: false })
  dispensacao_id: string;

  @ManyToOne(() => DispensacaoEntity, (d) => d.itens, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "dispensacao_id" })
  dispensacao?: DispensacaoEntity;

  @Column({ type: "uuid", nullable: false })
  medicamento_id: string;

  @ManyToOne(() => ProdutoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "medicamento_id" })
  produto?: ProdutoEntity;

  @Column({ type: "uuid", nullable: false })
  lote_id: string;

  @ManyToOne(() => LoteEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "lote_id" })
  lote?: LoteEntity;

  @Column({ type: "integer", nullable: false })
  quantidade_dispensada: number;

  @Column({ type: "text", nullable: true })
  posologia?: string | null;

  @CreateDateColumn({ type: "timestamptz", default: () => "now()" })
  created_at: Date;
}
