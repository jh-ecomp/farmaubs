import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthenticatedUserPayload } from "@farmaubs/shared";

/**
 * [AC-13 / NF009]: Extrai o usuário autenticado ou uma propriedade específica da requisição HTTP.
 * @param data - Propriedade específica do payload do usuário a ser extraída (opcional).
 * @param ctx - Contexto de execução do NestJS.
 * @returns O objeto completo do usuário ou o valor da propriedade solicitada.
 */
export const CurrentUser = createParamDecorator(
  (
    data: keyof AuthenticatedUserPayload | undefined,
    ctx: ExecutionContext,
  ) => {
    const request = ctx.switchToHttp().getRequest();
    const raw = request.user ?? request.session ?? request.sessao;
    if (!raw) return undefined;
    const user = {
      ...raw,
      id: raw.usuarioId ?? raw.id,
    };
    return data ? user?.[data] : user;
  },
);


