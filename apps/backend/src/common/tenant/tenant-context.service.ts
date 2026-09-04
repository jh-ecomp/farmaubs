import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantScope {
  municipioId: string | null;
}

/**
 * Contexto de tenant por requisição (ADR-006, ADR-016).
 * Populado pelo TenantInterceptor a partir do escopo da sessão autenticada.
 */
@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantScope>();

  run<T>(scope: TenantScope, fn: () => T): T {
    return this.storage.run(scope, fn);
  }

  getMunicipioId(): string | null {
    return this.storage.getStore()?.municipioId ?? null;
  }
}
