import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthenticatedUserPayload } from "@farmaubs/shared";

export const CurrentUser = createParamDecorator(
  (
    data: keyof AuthenticatedUserPayload | undefined,
    ctx: ExecutionContext,
  ) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user ?? request.session ?? request.sessao;
    return data ? user?.[data] : user;
  },
);

