import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, defer } from 'rxjs';
import { TenantContextService } from './tenant-context.service';

export interface SessionScope {
  municipioId?: string | null;
}

/**
 * #41 — Interceptor de tenant: lê o escopo da sessão (ADR-006) e propaga o
 * municipio_id para o contexto de tenant da requisição.
 *
 * Deve ser registrado como interceptor EXTERNO (antes do TransactionInterceptor),
 * para o escopo estar disponível quando a transação aplicar o GUC.
 *
 * Rotas públicas (login, recuperação de senha) não têm sessão autenticada:
 * o escopo fica null e a transação aplica fail-closed (0 linhas).
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const municipioId = this.resolveMunicipioId(context);
    return defer(() =>
      this.tenantContext.run({ municipioId }, () => next.handle()),
    );
  }

  private resolveMunicipioId(context: ExecutionContext): string | null {
    if (context.getType() !== 'http') {
      return null;
    }
    const request = context.switchToHttp().getRequest();
    const session: SessionScope | undefined = request.session ?? request.user;
    return session?.municipioId ?? null;
  }
}
