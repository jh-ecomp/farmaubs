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
import { RecebimentoItemEntity } from "./recebimento-item.entity";

/**
 * [RF008 / RF028]: Entidade TypeORM para guias de remessa e notas fiscais de recebimento.
 */
@Entity("documentos_entrada")
export class DocumentoEntradaEntity {
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

  @Index("idx_documentos_entrada_ubs_id")
  @Column({
    type: "uuid",
    nullable: false,
  })
  ubs_id: string;

  @ManyToOne(() => UnidadeSaudeEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "ubs_id" })
  unidadeSaude?: UnidadeSaudeEntity;

  @Column({
    type: "varchar",
    length: 100,
    nullable: false,
  })
  numero_documento: string;

  @Column({
    type: "varchar",
    length: 40,
    default: "GUIA_CAF",
    nullable: false,
  })
  tipo_documento: string;

  @Column({
    type: "varchar",
    length: 180,
    nullable: false,
  })
  fornecedor_origem: string;

  @Column({
    type: "timestamptz",
    default: () => "CURRENT_TIMESTAMP",
    nullable: false,
  })
  data_recebimento: Date;

  @Column({
    type: "uuid",
    nullable: false,
  })
  usuario_recebedor_id: string;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "usuario_recebedor_id" })
  usuarioRecebedor?: User;

  @Index("idx_documentos_entrada_status")
  @Column({
    type: "varchar",
    length: 20,
    default: "CONCLUIDO",
    nullable: false,
  })
  status: string;

  @Column({
    type: "timestamptz",
    nullable: true,
  })
  estornado_em?: Date | null;

  @Column({
    type: "uuid",
    nullable: true,
  })
  estornado_por_id?: string | null;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "estornado_por_id" })
  estornadoPor?: User | null;

  @Column({
    type: "text",
    nullable: true,
  })
  motivo_estorno?: string | null;

  @Column({
    type: "text",
    nullable: true,
  })
  observacoes?: string | null;

  @OneToMany(() => RecebimentoItemEntity, (item) => item.documentoEntrada)
  itens?: RecebimentoItemEntity[];

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
