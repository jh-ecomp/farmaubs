import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { SKIP_AUTH_KEY } from "./skip-auth.decorator";
import {
  REPOSITORIO_PERFIL_PORT,
  type RepositorioPerfilPort,
} from "../../modules/acesso/domain/ports/profile.repository.port";

/**
 * [RF025 / AC-13]: Autorização declarativa RBAC em memória sem queries secundárias (NF010).
 * @param context - Contexto de execução da requisição HTTP do NestJS.
 * @returns Promise<boolean> true se o perfil do usuário satisfizer a anotação @Roles.
 * @throws {UnauthorizedException} Se o token ou sessão não estiver presente no request.
 * @throws {ForbiddenException} Se o perfil não possuir permissão para o recurso solicitado.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional()
    @Inject(REPOSITORIO_PERFIL_PORT)
    private readonly profileRepo?: RepositorioPerfilPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    if (context.getType() !== "http") {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const sessao = req.user ?? req.session ?? req.sessao;

    if (!sessao) {
      throw new UnauthorizedException(
        "Token de autenticação ausente ou inválido",
      );
    }

    let perfilCodigo: string | undefined = sessao.perfilCodigo;

    // Fallback defensivo caso o perfilCodigo não tenha sido propagado no snapshot (NF010)
    if (!perfilCodigo && sessao.perfilId && this.profileRepo) {
      const perfil = await this.profileRepo.buscarPorId(sessao.perfilId);
      if (!perfil) {
        throw new ForbiddenException("Acesso negado para o perfil do usuário");
      }
      perfilCodigo = perfil.codigo;
      sessao.perfilCodigo = perfilCodigo;
    }

    if (!perfilCodigo || !requiredRoles.includes(perfilCodigo)) {
      throw new ForbiddenException("Acesso negado para o perfil do usuário");
    }

    return true;
  }
}


