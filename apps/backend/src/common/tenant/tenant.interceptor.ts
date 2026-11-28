import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { PerfilCodigo } from "@farmaubs/shared";
import { Observable, defer } from "rxjs";
import { TenantContextService } from "./tenant-context.service";

export interface SessionScope {
  municipioId?: string | null;
  perfilCodigo?: string;
}

/**
 * #41 — Interceptor de tenant: lê o escopo da sessão (ADR-006) e propaga o
 * municipio_id e o indicador de administrador global para o contexto da requisição.
 *
 * Deve ser registrado como interceptor EXTERNO (antes do TransactionInterceptor),
 * para o escopo estar disponível quando a transação aplicar os GUCs.
 *
 * Rotas públicas (login, recuperação de senha) não têm sessão autenticada:
 * o escopo fica null/false e a transação aplica fail-closed (0 linhas).
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return defer(() => {
      const scope = this.resolveScope(context);
      return new Observable((subscriber) => {
        return this.tenantContext.run(scope, () =>
          next.handle().subscribe(subscriber),
        );
      });
    });
  }

  private resolveScope(context: ExecutionContext): {
    municipioId: string | null;
    isAdmin: boolean;
  } {
    if (context.getType() !== "http") {
      return { municipioId: null, isAdmin: false };
    }
    const request = context.switchToHttp().getRequest();
    const session: SessionScope | undefined =
      request.session ?? request.user ?? request.sessao;
    const municipioId =
      request.tenantScope?.municipioId ?? session?.municipioId ?? null;
    const isAdmin = Boolean(
      request.tenantScope?.isGlobalAdmin ??
        session?.perfilCodigo === PerfilCodigo.ADMINISTRADOR,
    );
    return { municipioId, isAdmin };
  }
}
