import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./roles.decorator";
import {
  REPOSITORIO_PERFIL_PORT,
  type RepositorioPerfilPort,
} from "../../modules/acesso/domain/ports/profile.repository.port";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(REPOSITORIO_PERFIL_PORT)
    private readonly profileRepo: RepositorioPerfilPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
    const sessao = req.session ?? req.user ?? req.sessao;

    if (!sessao) {
      throw new UnauthorizedException(
        "Token de autenticação ausente ou inválido",
      );
    }

    let perfilCodigo: string | undefined = sessao.perfilCodigo;

    if (!perfilCodigo && sessao.perfilId) {
      const perfil = await this.profileRepo.buscarPorId(sessao.perfilId);
      if (!perfil) {
        throw new ForbiddenException(
          "Acesso negado: perfil de acesso não encontrado.",
        );
      }
      perfilCodigo = perfil.codigo;
      sessao.perfilCodigo = perfilCodigo;
    }

    if (!perfilCodigo || !requiredRoles.includes(perfilCodigo)) {
      throw new ForbiddenException(
        "Acesso restrito: permissão insuficiente para este recurso.",
      );
    }

    return true;
  }
}
