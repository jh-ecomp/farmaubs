import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

/**
 * [RF008 / ADR-016]: Entidade TypeORM representando um medicamento ou produto da REMUME.
 */
@Entity("produtos")
export class ProdutoEntity {
  @PrimaryColumn("uuid", {
    default: () => "gen_random_uuid()",
  })
  id: string;

  @Index("idx_produtos_nome_comercial")
  @Column({
    type: "varchar",
    length: 150,
    nullable: true,
  })
  nome_comercial?: string | null;

  @Index("idx_produtos_principio_ativo")
  @Column({
    type: "varchar",
    length: 150,
    nullable: false,
  })
  principio_ativo: string;

  @Column({
    type: "varchar",
    length: 80,
    nullable: true,
  })
  dosagem?: string | null;

  @Column({
    type: "varchar",
    length: 80,
    nullable: true,
  })
  forma_farmaceutica?: string | null;

  @Column({
    type: "varchar",
    length: 150,
    nullable: true,
  })
  apresentacao?: string | null;

  @Column({
    type: "varchar",
    length: 40,
    nullable: true,
  })
  unidade_medida?: string | null;

  @Column({
    type: "varchar",
    length: 50,
    default: "GERAL",
    nullable: false,
  })
  categoria: string;

  @Column({
    type: "boolean",
    default: false,
    nullable: false,
  })
  antimicrobiano: boolean;

  @Column({
    type: "boolean",
    default: true,
    nullable: false,
  })
  ativo: boolean;

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
