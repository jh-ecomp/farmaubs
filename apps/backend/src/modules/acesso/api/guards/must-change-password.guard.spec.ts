import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  MustChangePasswordGuard,
  PERMITIR_SENHA_PROVISORIA_KEY,
} from "./must-change-password.guard";

describe("MustChangePasswordGuard", () => {
  let guard: MustChangePasswordGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new MustChangePasswordGuard(reflector);
  });

  const createMockContext = (session: any): ExecutionContext => {
    const request = { sessao: session };
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it("deve permitir a requisição se a rota possuir o decorator PermitirSenhaProvisoriaRoute", () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = createMockContext({ deveTrocarSenha: true });

    expect(guard.canActivate(context)).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      PERMITIR_SENHA_PROVISORIA_KEY,
      expect.any(Array),
    );
  });

  it("deve permitir a requisição se não houver sessão (delega para SessionAuthGuard)", () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createMockContext(undefined);

    expect(guard.canActivate(context)).toBe(true);
  });

  it("deve permitir a requisição se o usuário não possuir pendência de troca de senha (deveTrocarSenha === false)", () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createMockContext({ deveTrocarSenha: false });

    expect(guard.canActivate(context)).toBe(true);
  });

  it("deve bloquear com ForbiddenException se o usuário possuir deveTrocarSenha === true em rota restrita", () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createMockContext({ deveTrocarSenha: true });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow(
      "Troca de senha obrigatória. Acesse POST /api/v1/acesso/trocar-senha para continuar.",
    );
  });
});
