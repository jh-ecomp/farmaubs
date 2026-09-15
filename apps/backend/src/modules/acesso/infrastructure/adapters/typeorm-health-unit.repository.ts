import { Injectable } from '@nestjs/common';
import { RepositorioUnidadeSaudePort } from '../../domain/ports/health-unit.repository.port';
import { UnidadeSaudeEntity } from '../../../administracao/infrastructure/persistence/entities/unidade-saude.entity';
import { TransactionContext } from '../../../../common/transaction/transaction-context.service';

@Injectable()
export class TypeOrmHealthUnitRepository implements RepositorioUnidadeSaudePort {
  constructor(private readonly transactionContext: TransactionContext) {}

  async buscarIdsExistentes(
    unidadesIds: string[],
    municipioId?: string,
  ): Promise<string[]> {
    if (!unidadesIds || unidadesIds.length === 0) {
      return [];
    }

    const manager = this.transactionContext.getManager();
    const query = manager
      .createQueryBuilder(UnidadeSaudeEntity, 'ubs')
      .select('ubs.id', 'id')
      .where('ubs.id IN (:...unidadesIds)', { unidadesIds });

    if (municipioId) {
      query.andWhere('ubs.municipio_id = :municipioId', { municipioId });
    }

    const resultados = await query.getRawMany<{ id: string }>();
    return resultados.map((r) => r.id);
  }
}
