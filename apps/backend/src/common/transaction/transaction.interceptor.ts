import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { Observable, defer, lastValueFrom } from 'rxjs';
import { SKIP_TRANSACTION_KEY } from './skip-transaction.decorator';
import { TenantContextService } from '../tenant/tenant-context.service';
import { TransactionContext } from './transaction-context.service';

const GUC_TENANT = 'app.municipio_id';

/**
 * #40 — TransactionInterceptor: abre transação, aplica SET LOCAL do GUC de
 * tenant, executa o caso de uso e faz commit/rollback (AC-02, ADR-016).
 *
 * - set_config(..., true) equivale a SET LOCAL: escopo da transação, resetado
 *   no commit/rollback — não vaza para requisições seguintes no pool.
 * - Sem escopo de tenant, aplica o GUC vazio (fail-closed: 0 linhas).
 * - Nenhuma chamada a serviço externo dentro da transação (ADR-008);
 *   efeitos assíncronos vão para o outbox (ADR-004).
 */
@Injectable()
export class TransactionInterceptor implements NestInterceptor {
  constructor(
    private readonly dataSource: DataSource,
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContextService,
    private readonly transactionContext: TransactionContext,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_TRANSACTION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) {
      return next.handle();
    }
    return defer(() => this.runInTransaction(next));
  }

  private async runInTransaction(next: CallHandler): Promise<unknown> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const municipioId = this.tenantContext.getMunicipioId();
      await queryRunner.query(`SELECT set_config($1, $2, true)`, [
        GUC_TENANT,
        municipioId ?? '',
      ]);

      const result = await this.transactionContext.run(queryRunner, () =>
        lastValueFrom(next.handle()),
      );

      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction().catch(() => undefined);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
