import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

/**
 * [RF008]: Entidade TypeORM para laboratórios produtores e fabricantes farmacêuticos.
 */
@Entity("fabricantes")
export class FabricanteEntity {
  @PrimaryColumn("uuid", {
    default: () => "gen_random_uuid()",
  })
  id: string;

  @Column({
    type: "varchar",
    length: 180,
    nullable: false,
  })
  razao_social: string;

  @Index("idx_fabricantes_nome_fantasia")
  @Column({
    type: "varchar",
    length: 120,
    nullable: false,
  })
  nome_fantasia: string;

  @Column({
    type: "varchar",
    length: 14,
    unique: true,
    nullable: true,
  })
  cnpj?: string | null;

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
