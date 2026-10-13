import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import * as crypto from "node:crypto";
import { SessionAuthGuard } from "./session-auth.guard";
import { ISessionRepository } from "../../modules/acesso/domain/ports/session.repository.port";

describe("SessionAuthGuard (Camada A — Teste Unitário AC-29)", () => {
  let guard: SessionAuthGuard;
  let reflectorMock: jest.Mocked<Reflector>;
  let sessionRepoMock: jest.Mocked<ISessionRepository>;
  let configServiceMock: jest.Mocked<ConfigService>;

  const hashToken = (token: string) =>
    crypto.createHash("sha256").update(token).digest("hex");

  const buildContext = (req: Record<string, any>): ExecutionContext =>
    ({
      getType: () => "http",
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
        getNext: () => jest.fn(),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflectorMock = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as jest.Mocked<Reflector>;

    sessionRepoMock = {
      buscarPorTokenHash: jest.fn(),
      renovarAtividade: jest.fn().mockResolvedValue(undefined),
      revogar: jest.fn(),
      salvar: jest.fn(),
    } as unknown as jest.Mocked<ISessionRepository>;

    configServiceMock = {
      get: jest.fn().mockImplementation((key: string, def?: string) => {
        if (key === "SESSION_TTL_MINUTES") return "60";
        if (key === "SESSION_THROTTLE_SECONDS") return "30";
        return def;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    guard = new SessionAuthGuard(reflectorMock, sessionRepoMock, configServiceMock);
  });

  it("deve permitir rotas públicas marcadas com @SkipAuth()", async () => {
    reflectorMock.getAllAndOverride.mockReturnValueOnce(true);
    const context = buildContext({});
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("deve autenticar prioritariamente via cookie HttpOnly farmaubs_session (AC-29)", async () => {
    const token = "token-cookie-secreto-123";
    const tokenHash = hashToken(token);
    const expiraEm = new Date(Date.now() + 3600 * 1000);
    const ultimaAtividade = new Date(Date.now() - 5000); // 5s atrás (< throttle)

    sessionRepoMock.buscarPorTokenHash.mockResolvedValueOnce({
      id: "sess-1",
      usuarioId: "u-1",
      tokenHash,
      status: "ativa",
      expiraEm,
      ultimaAtividadeEm: ultimaAtividade,
      criadoEm: new Date(),
    } as any);

    const req: Record<string, any> = {
      cookies: { farmaubs_session: token },
      headers: {},
    };
    const context = buildContext(req);

    const allowed = await guard.canActivate(context);
    expect(allowed).toBe(true);
    expect(sessionRepoMock.buscarPorTokenHash).toHaveBeenCalledWith(tokenHash);
    expect(req.sessao).toBeDefined();
    expect(req.sessao.id).toBe("sess-1");
  });

  it("deve autenticar via cabeçalho Authorization Bearer como fallback transparente para Mobile e Swagger (AC-29)", async () => {
    const token = "token-bearer-mobile-456";
    const tokenHash = hashToken(token);
    const expiraEm = new Date(Date.now() + 3600 * 1000);

    sessionRepoMock.buscarPorTokenHash.mockResolvedValueOnce({
      id: "sess-mobile-1",
      usuarioId: "u-mobile",
      tokenHash,
      status: "ativa",
      expiraEm,
      ultimaAtividadeEm: new Date(),
      criadoEm: new Date(),
    } as any);

    const req: Record<string, any> = {
      cookies: {},
      headers: { authorization: `Bearer ${token}` },
    };
    const context = buildContext(req);

    const allowed = await guard.canActivate(context);
    expect(allowed).toBe(true);
    expect(sessionRepoMock.buscarPorTokenHash).toHaveBeenCalledWith(tokenHash);
    expect(req.sessao.id).toBe("sess-mobile-1");
  });

  it("deve preferir o cookie quando ambos cookie e cabeçalho Authorization forem fornecidos", async () => {
    const cookieToken = "token-cookie-preferido";
    const cookieHash = hashToken(cookieToken);
    const expiraEm = new Date(Date.now() + 3600 * 1000);

    sessionRepoMock.buscarPorTokenHash.mockResolvedValueOnce({
      id: "sess-cookie",
      usuarioId: "u-cookie",
      tokenHash: cookieHash,
      status: "ativa",
      expiraEm,
      ultimaAtividadeEm: new Date(),
      criadoEm: new Date(),
    } as any);

    const req: Record<string, any> = {
      cookies: { farmaubs_session: cookieToken },
      headers: { authorization: "Bearer outro-token" },
    };
    const context = buildContext(req);

    await guard.canActivate(context);
    expect(sessionRepoMock.buscarPorTokenHash).toHaveBeenCalledWith(cookieHash);
    expect(req.sessao.id).toBe("sess-cookie");
  });

  it("deve lançar UnauthorizedException quando nem cookie nem cabeçalho forem informados", async () => {
    const req = { cookies: {}, headers: {} };
    const context = buildContext(req);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow(
      "Token de autenticação ausente ou inválido",
    );
  });

  it("deve lançar UnauthorizedException quando o token do cookie não for localizado no repositório", async () => {
    sessionRepoMock.buscarPorTokenHash.mockResolvedValueOnce(null);

    const req = {
      cookies: { farmaubs_session: "token-inexistente" },
      headers: {},
    };
    const context = buildContext(req);

    await expect(guard.canActivate(context)).rejects.toThrow("Sessão inválida ou expirada");
  });

  it("deve lançar UnauthorizedException quando a sessão estiver revogada", async () => {
    const token = "token-revogado";
    sessionRepoMock.buscarPorTokenHash.mockResolvedValueOnce({
      id: "sess-revogada",
      tokenHash: hashToken(token),
      status: "revogada",
      expiraEm: new Date(Date.now() + 3600 * 1000),
      ultimaAtividadeEm: new Date(),
    } as any);

    const req = {
      cookies: { farmaubs_session: token },
      headers: {},
    };
    const context = buildContext(req);

    await expect(guard.canActivate(context)).rejects.toThrow("Sessão revogada ou inativa");
  });

  it("deve lançar UnauthorizedException quando a sessão estiver expirada", async () => {
    const token = "token-expirado";
    sessionRepoMock.buscarPorTokenHash.mockResolvedValueOnce({
      id: "sess-expirada",
      tokenHash: hashToken(token),
      status: "ativa",
      expiraEm: new Date(Date.now() - 1000), // expirou no passado
      ultimaAtividadeEm: new Date(),
    } as any);

    const req = {
      cookies: { farmaubs_session: token },
      headers: {},
    };
    const context = buildContext(req);

    await expect(guard.canActivate(context)).rejects.toThrow("Sessão expirada");
  });
});
