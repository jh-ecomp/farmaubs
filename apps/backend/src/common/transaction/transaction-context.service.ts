import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';

/**
 * Contexto transacional por requisição (AC-02).
 * O TransactionInterceptor armazena o QueryRunner ativo aqui; os repositórios
 * obtêm o manager transacional pelo mesmo canal, garantindo que o SET LOCAL
 * do GUC seja aplicado na MESMA conexão em que as queries executam.
 */
@Injectable()
export class TransactionContext {
  private readonly storage = new AsyncLocalStorage<QueryRunner>();

  constructor(private readonly dataSource: DataSource) {}

  run<T>(queryRunner: QueryRunner, fn: () => Promise<T>): Promise<T> {
    return this.storage.run(queryRunner, fn);
  }

  getManager(): EntityManager {
    return this.storage.getStore()?.manager ?? this.dataSource.manager;
  }
}
