import { defineFeature, loadFeature } from "jest-cucumber";
import * as path from "path";
import * as crypto from "crypto";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { SessionAuthGuard } from "../../../../common/guards/session-auth.guard";
import { RenewSessionUseCase } from "./renew-session.use-case";
import type {
  ISessionRepository,
  SessionRecord,
  RenovarSessaoParams,
} from "../../domain/ports/session.repository.port";

const feature = loadFeature(path.resolve(__dirname, "renew-session.feature"));

defineFeature(feature, (test) => {
  let sessionRepoMock: jest.Mocked<ISessionRepository>;
  let reflectorMock: jest.Mocked<Reflector>;
  let configServiceMock: jest.Mocked<ConfigService>;
  let guard: SessionAuthGuard;
  let useCase: RenewSessionUseCase;

  let executionError: Error | null = null;
  let guardResult: boolean | null = null;
  let renewResult: any = null;

  const validToken = "token-secreto-super-seguro-1234567890";
  const validTokenHash = crypto
    .createHash("sha256")
    .update(validToken)
    .digest("hex");

  const setupMocks = () => {
    executionError = null;
    guardResult = null;
    renewResult = null;

    sessionRepoMock = {
      buscarPorTokenHash: jest.fn(),
      renovarAtividade: jest.fn().mockResolvedValue(undefined),
      revogar: jest.fn().mockResolvedValue(undefined),
      revogarTodas: jest.fn().mockResolvedValue(undefined),
    };

    reflectorMock = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as jest.Mocked<Reflector>;

    configServiceMock = {
      get: jest.fn((key: string, def?: string) => {
        if (key === "SESSION_TTL_MINUTES") return "60";
        if (key === "SESSION_WARNING_MINUTES") return "5";
        if (key === "SESSION_THROTTLE_SECONDS") return "30";
        return def;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    guard = new SessionAuthGuard(
      reflectorMock,
      sessionRepoMock,
      configServiceMock,
    );
    useCase = new RenewSessionUseCase(sessionRepoMock, configServiceMock);
  };

  const createMockContext = (headers: Record<string, string>) => {
    const req: any = { headers };
    const context = {
      getType: () => "http",
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    return { context, req };
  };

  test("Requisição autenticada prorroga o prazo da sessão", ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      "que existe uma sessão ativa com expira_em para daqui a 20 minutos",
      () => {
        setupMocks();
        const sessaoAtiva: SessionRecord = {
          id: "sessao-1",
          usuarioId: "user-1",
          municipioId: "mun-1",
          perfilCodigo: "FARMACEUTICO_RESPONSAVEL",
          unidadeIds: ["ubs-1"],
          nomeCompleto: "Usuário de Teste",
          email: "teste@farmaubs.local",
          deveTrocarSenha: false,
          status: "ativa",
          expiraEm: new Date(Date.now() + 20 * 60_000),
          criadoEm: new Date(Date.now() - 40 * 60_000),
          ultimaAtividadeEm: new Date(Date.now() - 60_000),
        };
        sessionRepoMock.buscarPorTokenHash.mockResolvedValue(sessaoAtiva);
      },
    );

    when(
      "o SessionAuthGuard processar a requisição com o token correspondente",
      async () => {
        const { context, req } = createMockContext({
          authorization: `Bearer ${validToken}`,
        });
        try {
          guardResult = await guard.canActivate(context);
        } catch (err: any) {
          executionError = err;
        }
      },
    );

    then("o método renovarAtividade do repositório deve ser acionado", () => {
      expect(executionError).toBeNull();
      expect(sessionRepoMock.renovarAtividade).toHaveBeenCalledTimes(1);
    });

    and("o novo expira_em deve ser postergado para 60 minutos à frente", () => {
      const callArgs = (sessionRepoMock.renovarAtividade as jest.Mock).mock
        .calls[0][0] as RenovarSessaoParams;
      expect(callArgs.sessionId).toBe("sessao-1");
      const diffMin = (callArgs.expiraEm.getTime() - Date.now()) / 60_000;
      expect(diffMin).toBeGreaterThanOrEqual(59);
      expect(diffMin).toBeLessThanOrEqual(61);
    });

    and("a requisição prossegue com sucesso", () => {
      expect(guardResult).toBe(true);
    });
  });

  test("Sessão expirada é barrada pelo guard", ({ given, when, then }) => {
    given(
      "que existe uma sessão com expira_em no passado (expirada há 1 minuto)",
      () => {
        setupMocks();
        const sessaoExpirada: SessionRecord = {
          id: "sessao-exp",
          usuarioId: "user-1",
          municipioId: "mun-1",
          perfilCodigo: "FARMACEUTICO_RESPONSAVEL",
          unidadeIds: [],
          nomeCompleto: "Usuário de Teste",
          email: "teste@farmaubs.local",
          deveTrocarSenha: false,
          status: "ativa",
          expiraEm: new Date(Date.now() - 60_000), // expirada há 1 min
          criadoEm: new Date(Date.now() - 120 * 60_000),
          ultimaAtividadeEm: new Date(Date.now() - 61_000),
        };
        sessionRepoMock.buscarPorTokenHash.mockResolvedValue(sessaoExpirada);
      },
    );

    when("o SessionAuthGuard interceptar a requisição", async () => {
      const { context } = createMockContext({
        authorization: `Bearer ${validToken}`,
      });
      try {
        guardResult = await guard.canActivate(context);
      } catch (err: any) {
        executionError = err;
      }
    });

    then(
      "deve interromper a execução e retornar status HTTP 401 Unauthorized",
      () => {
        expect(executionError).toBeInstanceOf(UnauthorizedException);
        expect((executionError as UnauthorizedException).getStatus()).toBe(401);
      },
    );
  });

  test("Requisição dentro da janela de throttle não dispara update no banco", ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      "que existe uma sessão ativa com última atividade há menos de 30 segundos",
      () => {
        setupMocks();
        const sessaoRecente: SessionRecord = {
          id: "sessao-recente",
          usuarioId: "user-1",
          municipioId: "mun-1",
          perfilCodigo: "FARMACEUTICO_RESPONSAVEL",
          unidadeIds: [],
          nomeCompleto: "Usuário de Teste",
          email: "teste@farmaubs.local",
          deveTrocarSenha: false,
          status: "ativa",
          expiraEm: new Date(Date.now() + 50 * 60_000),
          criadoEm: new Date(Date.now() - 10 * 60_000),
          ultimaAtividadeEm: new Date(Date.now() - 10_000), // 10s atrás (< 30s)
        };
        sessionRepoMock.buscarPorTokenHash.mockResolvedValue(sessaoRecente);
      },
    );

    when(
      "o SessionAuthGuard processar a requisição com o token correspondente",
      async () => {
        const { context } = createMockContext({
          authorization: `Bearer ${validToken}`,
        });
        try {
          guardResult = await guard.canActivate(context);
        } catch (err: any) {
          executionError = err;
        }
      },
    );

    then(
      "o método renovarAtividade do repositório não deve ser acionado",
      () => {
        expect(executionError).toBeNull();
        expect(sessionRepoMock.renovarAtividade).not.toHaveBeenCalled();
      },
    );

    and("a requisição prossegue com sucesso", () => {
      expect(guardResult).toBe(true);
    });
  });

  test("Renovação explícita da sessão via caso de uso", ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      'que um usuário possui uma sessão ativa identificada por "sessao-123"',
      () => {
        setupMocks();
      },
    );

    when("o caso de uso de renovação de sessão for executado", async () => {
      renewResult = await useCase.executar("sessao-123");
    });

    then("deve persistir a nova data de expiração no repositório", () => {
      expect(sessionRepoMock.renovarAtividade).toHaveBeenCalledTimes(1);
      const callArgs = (sessionRepoMock.renovarAtividade as jest.Mock).mock
        .calls[0][0] as RenovarSessaoParams;
      expect(callArgs.sessionId).toBe("sessao-123");
    });

    and(
      "deve retornar os metadados de expiração com ttl de 3600 segundos e aviso de 300 segundos",
      () => {
        expect(renewResult).toMatchObject({
          ttlSeconds: 3600,
          warningSeconds: 300,
          expiresAt: expect.any(String),
        });
        const diffMs = new Date(renewResult.expiresAt).getTime() - Date.now();
        expect(diffMs).toBeGreaterThanOrEqual(3590 * 1000);
      },
    );
  });
});
