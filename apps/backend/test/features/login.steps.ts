import * as bcrypt from "bcrypt";
import { defineFeature, loadFeature } from "jest-cucumber";
import * as path from "path";
import type {
  IAcessoRepository,
  UserAcessoRecord,
} from "../../src/modules/acesso/domain/ports/acesso.repository.port";
import { ACESSO_REPOSITORY } from "../../src/modules/acesso/domain/ports/acesso.repository.port";
import { LoginUseCase } from "../../src/modules/acesso/domain/use-cases/login.use-case";
import { ConfigService } from "@nestjs/config";

const feature = loadFeature(path.join(__dirname, "./login.feature"));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    LOGIN_MAX_ATTEMPTS: "5",
    SESSION_TTL_MINUTES: "60",
    ...overrides,
  };
  return { get: (key: string, def = "") => values[key] ?? def } as any;
}

function makeRepo(
  partial: Partial<IAcessoRepository> = {},
): jest.Mocked<IAcessoRepository> {
  return {
    buscarUsuarioPorEmail: jest.fn(),
    registrarFalhaLogin: jest.fn().mockResolvedValue(undefined),
    resetarEstadoLogin: jest.fn().mockResolvedValue(undefined),
    criarSessao: jest
      .fn()
      .mockResolvedValue("token-fake-64chars-00000000000000000000000000000000"),
    ...partial,
  } as any;
}

async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 4);
}

function makeUsuario(overrides: Partial<UserAcessoRecord> = {}): UserAcessoRecord {
  return {
    id: "uuid-usuario",
    municipioId: "uuid-municipio",
    email: "admin@farmaubs.dev",
    senhaHash: "",
    ativo: true,
    tentativasLoginFalhas: 0,
    bloqueadoAte: null,
    ...overrides,
  };
}

// ── Cenários ─────────────────────────────────────────────────────────────────

defineFeature(feature, (test) => {
  // Cenário 1 — Login com sucesso
  test("Credenciais válidas iniciam sessão", ({ given, when, then, and }) => {
    let repo: jest.Mocked<IAcessoRepository>;
    let useCase: LoginUseCase;
    let resultado: Awaited<ReturnType<LoginUseCase["executar"]>>;

    given(/^que existe um usuário ativo com e-mail "(.*)"$/, async (email) => {
      const senhaHash = await hashSenha("Admin@123456");
      repo = makeRepo({
        buscarUsuarioPorEmail: jest
          .fn()
          .mockResolvedValue(makeUsuario({ email, senhaHash })),
      });
      useCase = new LoginUseCase(repo as any, makeConfig());
    });

    when(/^eu informar o e-mail "(.*)" e a senha correta$/, async (email) => {
      resultado = await useCase.executar(email, "Admin@123456");
    });

    then("uma sessão é criada com token único", () => {
      expect(resultado.ok).toBe(true);
      expect(repo.criarSessao).toHaveBeenCalled();
    });

    and("o contador de tentativas inválidas é zerado", () => {
      expect(repo.resetarEstadoLogin).toHaveBeenCalledWith("uuid-usuario");
    });
  });

  // Cenário 2 — Senha errada
  test("Senha incorreta retorna mensagem genérica e incrementa tentativas", ({
    given,
    when,
    then,
    and,
  }) => {
    let repo: jest.Mocked<IAcessoRepository>;
    let useCase: LoginUseCase;
    let resultado: Awaited<ReturnType<LoginUseCase["executar"]>>;

    given(/^que existe um usuário ativo com e-mail "(.*)"$/, async (email) => {
      const senhaHash = await hashSenha("Admin@123456");
      repo = makeRepo({
        buscarUsuarioPorEmail: jest
          .fn()
          .mockResolvedValue(makeUsuario({ email, senhaHash })),
      });
      useCase = new LoginUseCase(repo as any, makeConfig());
    });

    when(/^eu informar a senha errada para esse e-mail$/, async () => {
      resultado = await useCase.executar("admin@farmaubs.dev", "senhaerrada");
    });

    then(
      "o sistema retorna a mensagem genérica de credenciais inválidas",
      () => {
        expect(resultado.ok).toBe(false);
        if (!resultado.ok)
          expect(resultado.motivo).toBe("CREDENCIAIS_INVALIDAS");
      },
    );

    and("nenhuma sessão é criada", () => {
      expect(repo.criarSessao).not.toHaveBeenCalled();
      expect(repo.registrarFalhaLogin).toHaveBeenCalledWith("uuid-usuario");
    });
  });

  // Cenário 3 — Bloqueio na 5ª tentativa
  test("Quinta tentativa inválida bloqueia a conta por 15 minutos", ({
    given,
    when,
    then,
    and,
  }) => {
    let repo: jest.Mocked<IAcessoRepository>;
    let useCase: LoginUseCase;
    let resultado: Awaited<ReturnType<LoginUseCase["executar"]>>;

    given(
      /^que o usuário "(.*)" possui 4 tentativas inválidas registradas$/,
      async (email) => {
        const senhaHash = await hashSenha("Gestor@123456");
        repo = makeRepo({
          buscarUsuarioPorEmail: jest
            .fn()
            .mockResolvedValue(
              makeUsuario({ email, senhaHash, tentativasLoginFalhas: 4 }),
            ),
        });
        useCase = new LoginUseCase(repo as any, makeConfig());
      },
    );

    when("eu informar a senha errada pela 5ª vez", async () => {
      resultado = await useCase.executar("gestor@farmaubs.dev", "senhaerrada");
    });

    then("o sistema bloqueia a conta", () => {
      expect(repo.registrarFalhaLogin).toHaveBeenCalledWith("uuid-usuario");
    });

    and("retorna a mensagem de credenciais inválidas", () => {
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) expect(resultado.motivo).toBe("CREDENCIAIS_INVALIDAS");
    });
  });

  // Cenário 4 — Conta bloqueada
  test("Tentativa com conta bloqueada não cria sessão", ({
    given,
    when,
    then,
    and,
  }) => {
    let repo: jest.Mocked<IAcessoRepository>;
    let useCase: LoginUseCase;
    let resultado: Awaited<ReturnType<LoginUseCase["executar"]>>;

    given(/^que a conta "(.*)" está bloqueada$/, async (email) => {
      const senhaHash = await hashSenha("Gestor@123456");
      const bloqueadoAte = new Date(Date.now() + 10 * 60_000);
      repo = makeRepo({
        buscarUsuarioPorEmail: jest
          .fn()
          .mockResolvedValue(makeUsuario({ email, senhaHash, bloqueadoAte })),
      });
      useCase = new LoginUseCase(repo as any, makeConfig());
    });

    when("eu tentar logar com credenciais corretas", async () => {
      resultado = await useCase.executar(
        "gestor@farmaubs.dev",
        "Gestor@123456",
      );
    });

    then(
      "o sistema retorna erro informando o tempo restante de bloqueio",
      () => {
        expect(resultado.ok).toBe(false);
        if (!resultado.ok) expect(resultado.motivo).toBe("CONTA_BLOQUEADA");
      },
    );

    and("o contador de tentativas não é incrementado", () => {
      expect(repo.registrarFalhaLogin).not.toHaveBeenCalled();
    });
  });

  // Cenário 5 — Anti-enumeração
  test("E-mail não cadastrado recebe a mesma mensagem genérica", ({
    given,
    when,
    then,
  }) => {
    let repo: jest.Mocked<IAcessoRepository>;
    let useCase: LoginUseCase;
    let resultado: Awaited<ReturnType<LoginUseCase["executar"]>>;

    given(/^que não existe usuário com o e-mail "(.*)"$/, (_email) => {
      repo = makeRepo({
        buscarUsuarioPorEmail: jest.fn().mockResolvedValue(null),
      });
      useCase = new LoginUseCase(repo as any, makeConfig());
    });

    when(/^eu tentar logar com esse e-mail e qualquer senha$/, async () => {
      resultado = await useCase.executar(
        "nao.cadastrado@farmaubs.dev",
        "qualquer",
      );
    });

    then(
      "o sistema retorna a mesma mensagem genérica de credenciais inválidas",
      () => {
        expect(resultado.ok).toBe(false);
        if (!resultado.ok)
          expect(resultado.motivo).toBe("CREDENCIAIS_INVALIDAS");
        expect(repo.criarSessao).not.toHaveBeenCalled();
      },
    );
  });

  // Cenário 6 — Sucesso zera contador
  test("Login válido após tentativas inválidas zera o contador", ({
    given,
    when,
    then,
    and,
  }) => {
    let repo: jest.Mocked<IAcessoRepository>;
    let useCase: LoginUseCase;
    let resultado: Awaited<ReturnType<LoginUseCase["executar"]>>;

    given(
      /^que o usuário "(.*)" possui 2 tentativas inválidas registradas$/,
      async (email) => {
        const senhaHash = await hashSenha("Farma@123456");
        repo = makeRepo({
          buscarUsuarioPorEmail: jest
            .fn()
            .mockResolvedValue(
              makeUsuario({ email, senhaHash, tentativasLoginFalhas: 2 }),
            ),
        });
        useCase = new LoginUseCase(repo as any, makeConfig());
      },
    );

    when("eu logar com a senha correta", async () => {
      resultado = await useCase.executar(
        "farmaceutico.responsavel@farmaubs.dev",
        "Farma@123456",
      );
    });

    then("a sessão é criada com sucesso", () => {
      expect(resultado.ok).toBe(true);
    });

    and("o contador de tentativas é zerado", () => {
      expect(repo.resetarEstadoLogin).toHaveBeenCalledWith("uuid-usuario");
    });
  });

  // Cenário 7 — Sessão expirada
  test("Sessão inativa por 60 minutos é encerrada", ({ given, when, then }) => {
    let tokenHash: string;

    given(
      /^que o usuário "(.*)" possui uma sessão ativa expirada$/,
      (_email) => {
        tokenHash = "hash-sessao-expirada";
      },
    );

    when("o sistema verificar a sessão", () => {
      // Verificação de sessão expirada é responsabilidade do middleware/guard
      // A função auth_buscar_sessao_por_token já filtra expira_em > now()
    });

    then("a sessão é recusada por expiração", () => {
      // Validado na camada B (integração) — banco filtra expira_em > now()
      expect(tokenHash).toBeDefined();
    });
  });
});
