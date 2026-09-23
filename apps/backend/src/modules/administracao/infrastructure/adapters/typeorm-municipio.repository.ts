import { Injectable } from "@nestjs/common";
import type { MunicipioDto } from "@farmaubs/shared";
import { RepositorioMunicipioPort } from "../../domain/ports/municipio.repository.port";
import { MunicipioEntity } from "../persistence/entities/municipio.entity";
import { TransactionContext } from "../../../../common/transaction/transaction-context.service";

@Injectable()
export class TypeOrmMunicipioRepository implements RepositorioMunicipioPort {
  constructor(private readonly transactionContext: TransactionContext) {}

  async listarAtivos(): Promise<MunicipioDto[]> {
    const manager = this.transactionContext.getManager();
    const municipios = await manager.find(MunicipioEntity, {
      where: { ativo: true },
      order: { nome: "ASC" },
    });

    return municipios.map((m) => ({
      id: m.id,
      nome: m.nome,
      uf: m.uf,
      ibgeCode: m.codigo_ibge,
    }));
  }
}
