import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

export const PERMITIR_SENHA_PROVISORIA_KEY = "permitirSenhaProvisoria";

export const PermitirSenhaProvisoriaRoute = () =>
  SetMetadata(PERMITIR_SENHA_PROVISORIA_KEY, true);

@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPermitida = this.reflector.getAllAndOverride<boolean>(
      PERMITIR_SENHA_PROVISORIA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPermitida) return true;

    const req = context.switchToHttp().getRequest();
    const sessao = req.sessao ?? req.session;

    // Sem sessão: responsabilidade do SessionAuthGuard
    if (!sessao) return true;

    if (sessao.deveTrocarSenha === true) {
      throw new ForbiddenException(
        "Troca de senha obrigatória. Acesse POST /api/v1/acesso/trocar-senha para continuar.",
      );
    }

    return true;
  }
}
