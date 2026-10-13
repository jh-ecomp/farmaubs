import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PerfilCodigo, type TenantScopeContext } from "@farmaubs/shared";
import {
  TENANT_SCOPED_KEY,
  type TenantScopeOptions,
} from "../decorators/tenant-scoped.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { SKIP_AUTH_KEY } from "./skip-auth.decorator";


/**
 * [RF001 / ADR-002 / AC-13]: Validação de escopo municipal e de UBSs com bypass de Administrador.
 * @param context - Contexto de execução da requisição HTTP do NestJS.
 * @returns true se município e UBS estiverem estritamente dentro do escopo do usuário.
 * @throws {UnauthorizedException} Se o usuário/sessão não estiver presente no request.
 * @throws {ForbiddenException} Se houver tentativa de acesso fora do município ou UBSs vinculadas.
 */
@Injectable()
export class TenantScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic =
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ||
      this.reflector.getAllAndOverride<boolean>(SKIP_AUTH_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

    if (isPublic) {
      return true;
    }

    if (context.getType() !== "http") {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const user = req.user ?? req.session ?? req.sessao;

    if (!user) {
      throw new UnauthorizedException(
        "Token de autenticação ausente ou inválido",
      );
    }

    const options = this.reflector.getAllAndOverride<TenantScopeOptions>(
      TENANT_SCOPED_KEY,
      [context.getHandler(), context.getClass()],
    ) ?? { checkUbs: false };

    // 1. Bypass Global do Administrador (ADR-002)
    if (user.perfilCodigo === PerfilCodigo.ADMINISTRADOR) {
      const tenantScope: TenantScopeContext = {
        municipioId: user.municipioId,
        unidadeIds: user.unidadeIds ?? [],
        isGlobalAdmin: true,
      };
      req.tenantScope = tenantScope;
      return true;
    }

    // 2. Validação de Escopo Municipal para Perfis Operacionais
    const reqMunicipioId =
      req.params?.municipioId ??
      req.query?.municipioId ??
      req.body?.municipioId;

    if (reqMunicipioId && reqMunicipioId !== user.municipioId) {
      throw new ForbiddenException(
        "Acesso negado: município fora do escopo do usuário",
      );
    }

    // 3. Validação de Escopo de UBS (quando anotado com checkUbs ou parâmetro explícito)
    const paramName = options.paramName || "unidadeId";
    const reqUnidadeId =
      req.params?.[paramName] ??
      req.params?.ubsId ??
      req.params?.unidadeId ??
      req.query?.[paramName] ??
      req.query?.ubsId ??
      req.query?.unidadeId ??
      req.body?.[paramName] ??
      req.body?.ubsId ??
      req.body?.unidadeId;

    if (options.checkUbs && !reqUnidadeId) {
      throw new ForbiddenException(
        "Acesso negado: unidade de saúde obrigatória não informada",
      );
    }

    if (reqUnidadeId) {
      const userUnidades: string[] = user.unidadeIds ?? [];
      if (!userUnidades.includes(reqUnidadeId)) {
        throw new ForbiddenException(
          "Acesso negado: unidade de saúde fora do escopo do usuário",
        );
      }
    }

    // 4. Injeção do escopo validado para interceptores de transação e RLS
    const tenantScope: TenantScopeContext = {
      municipioId: user.municipioId,
      unidadeIds: user.unidadeIds ?? [],
      isGlobalAdmin: false,
    };
    req.tenantScope = tenantScope;

    return true;
  }
}

