import { Injectable } from '@nestjs/common';
import type { UnidadeSaudeDto } from '@farmaubs/shared';
import { RepositorioUnidadeSaudePort } from '../../domain/ports/health-unit.repository.port';
import { RepositorioUnidadeSaudePort as RepositorioUnidadeSaudeAdminPort } from '../../../administracao/domain/ports/unidade-saude.repository.port';
import { UnidadeSaudeEntity } from '../../../administracao/infrastructure/persistence/entities/unidade-saude.entity';
import { TransactionContext } from '../../../../common/transaction/transaction-context.service';

@Injectable()
export class TypeOrmHealthUnitRepository implements RepositorioUnidadeSaudePort {
export class TypeOrmHealthUnitRepository
  implements RepositorioUnidadeSaudePort, RepositorioUnidadeSaudeAdminPort
{
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

  async buscarPorMunicipio(municipioId: string): Promise<UnidadeSaudeDto[]> {
    const manager = this.transactionContext.getManager();
    const unidades = await manager.find(UnidadeSaudeEntity, {
      where: { municipio_id: municipioId },
      order: { nome: 'ASC' },
    });

    return unidades.map((u) => ({
      id: u.id,
      municipioId: u.municipio_id,
      nome: u.nome,
      endereco: u.endereco ?? '',
      responsavelTecnico: u.responsavel_tecnico ?? null,
      cafLeadTimeDays: u.caf_lead_time_days,
    }));
  }
}

