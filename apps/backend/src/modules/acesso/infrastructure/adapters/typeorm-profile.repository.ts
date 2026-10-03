import { Injectable } from "@nestjs/common";
import { RepositorioPerfilPort } from "../../domain/ports/profile.repository.port";
import { PerfilModeloDominio } from "../../domain/entities/user-registration.entity";
import { PerfilEntity } from "../persistence/entities/perfil.entity";
import { TransactionContext } from "../../../../common/transaction/transaction-context.service";

@Injectable()
export class TypeOrmProfileRepository implements RepositorioPerfilPort {
  constructor(private readonly transactionContext: TransactionContext) {}

  async buscarPorId(id: string): Promise<PerfilModeloDominio | null> {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id?.trim() ?? "",
      );
    if (!isUuid) {
      return null;
    }

    const manager = this.transactionContext.getManager();
    const perfil = await manager.findOne(PerfilEntity, {
      where: { id: id.trim() },
    });

    if (!perfil) {
      return null;
    }

    return this.mapearParaDominio(perfil);
  }

  async buscarPorCodigoOuNome(
    identificador: string,
  ): Promise<PerfilModeloDominio | null> {
    const manager = this.transactionContext.getManager();
    const valorNormalizado = identificador.trim();
    const codigoUpper = valorNormalizado.toUpperCase();

    const perfil = await manager
      .createQueryBuilder(PerfilEntity, "p")
      .where("p.codigo = :codigo", { codigo: codigoUpper })
      .orWhere("LOWER(p.nome) = LOWER(:nome)", { nome: valorNormalizado })
      .getOne();

    if (!perfil) {
      return null;
    }

    return this.mapearParaDominio(perfil);
  }

  private mapearParaDominio(perfil: PerfilEntity): PerfilModeloDominio {
    return {
      id: perfil.id,
      codigo: perfil.codigo,
      nome: perfil.nome,
      descricao: perfil.descricao ?? null,
      ativo: perfil.ativo,
    };
  }
}
