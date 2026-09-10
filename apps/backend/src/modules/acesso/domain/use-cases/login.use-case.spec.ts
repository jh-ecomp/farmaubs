import * as bcrypt from "bcrypt";
import { LoginUseCase } from "./login.use-case";
import type { IAcessoRepository } from "../ports/acesso.repository.port";
import { ACESSO_REPOSITORY } from "../ports/acesso.repository.port";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";

// ─── helpers ────────────────────────────────────────────────────────────────

const SENHA_PLAIN = "Senha@123";
let SENHA_HASH: string;

beforeAll(async () => {
  SENHA_HASH = await bcrypt.hash(SENHA_PLAIN, 10);
});

function makeUsuario(overrides: Partial<ReturnType<typeof baseUsuario>> = {}) {
  return { ...baseUsuario(), ...overrides };
}

function baseUsuario() {
  return {
    id: "usuario-uuid-1",
    municipioId: "municipio-uuid-1",
    email: "ana.souza@farmaubs.local",
    senhaHash: SENHA_HASH,
    ativo: true,
    tentativasLoginFalhas: 0,
    bloqueadoAte: null as Date | null,
  };
}

function makeRepo(
  overrides: Partial<IAcessoRepository> = {},
): IAcessoRepository {
  return {
    buscarUsuarioPorEmail: jest.fn().mockResolvedValue(makeUsuario()),
    registrarFalhaLogin: jest.fn().mockResolvedValue(undefined),
    resetarEstadoLogin: jest.fn().mockResolvedValue(undefined),
    criarSessao: jest.fn().mockResolvedValue("token-plain-abc"),
    buscarEscopoUsuario: jest.fn().mockResolvedValue({
      perfilId: "perfil-uuid-1",
      unidadeIds: ["unidade-uuid-1"],
    }),
    ...overrides,
  };
}

async function buildSut(
  repo: IAcessoRepository,
  envVars: Record<string, string> = {},
) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      LoginUseCase,
      { provide: ACESSO_REPOSITORY, useValue: repo },
      {
        provide: ConfigService,
        useValue: {
          get: (key: string, fallback?: string) =>
            ({
              LOGIN_MAX_ATTEMPTS: "5",
              SESSION_TTL_MINUTES: "60",
              ...envVars,
            })[key] ?? fallback,
        },
      },
    ],
  }).compile();

  return moduleRef.get(LoginUseCase);
}

// ─── testes ──────────────────────────────────────────────────────────────────

describe("LoginUseCase", () => {
  describe("Cenário 1 — Login com sucesso", () => {
    it("retorna ok:true com token e escopo quando credenciais são válidas", async () => {
      const repo = makeRepo();
      const sut = await buildSut(repo);

      const result = await sut.executar(
        "ana.souza@farmaubs.local",
        SENHA_PLAIN,
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.token).toBe("token-plain-abc");
      expect(result.usuarioId).toBe("usuario-uuid-1");
      expect(result.municipioId).toBe("municipio-uuid-1");
      expect(result.perfilId).toBe("perfil-uuid-1");
      expect(result.unidadeIds).toEqual(["unidade-uuid-1"]);
    });

    it("normaliza o e-mail (trim + lowercase) antes de buscar", async () => {
      const repo = makeRepo();
      const sut = await buildSut(repo);

      await sut.executar("  ANA.SOUZA@FARMAUBS.LOCAL  ", SENHA_PLAIN);

      expect(repo.buscarUsuarioPorEmail).toHaveBeenCalledWith(
        "ana.souza@farmaubs.local",
      );
    });

    it("chama resetarEstadoLogin após senha válida", async () => {
      const repo = makeRepo();
      const sut = await buildSut(repo);

      await sut.executar("ana.souza@farmaubs.local", SENHA_PLAIN);

      expect(repo.resetarEstadoLogin).toHaveBeenCalledWith("usuario-uuid-1");
    });

    it("cria sessão com expiraEm aproximadamente agora + 60 min", async () => {
      const repo = makeRepo();
      const sut = await buildSut(repo);
      const antes = Date.now();

      await sut.executar("ana.souza@farmaubs.local", SENHA_PLAIN);

      const chamada = (repo.criarSessao as jest.Mock).mock.calls[0][0];
      const expiraEm: Date = chamada.expiraEm;
      const msEsperados = 60 * 60_000;

      expect(expiraEm.getTime()).toBeGreaterThanOrEqual(
        antes + msEsperados - 500,
      );
      expect(expiraEm.getTime()).toBeLessThanOrEqual(
        Date.now() + msEsperados + 500,
      );
    });
  });

  describe("Cenário 2 — Credenciais inválidas (senha errada)", () => {
    it("retorna CREDENCIAIS_INVALIDAS", async () => {
      const repo = makeRepo();
      const sut = await buildSut(repo);

      const result = await sut.executar(
        "ana.souza@farmaubs.local",
        "senhaErrada!",
      );

      expect(result).toEqual({ ok: false, motivo: "CREDENCIAIS_INVALIDAS" });
    });

    it("incrementa o contador de falhas", async () => {
      const repo = makeRepo();
      const sut = await buildSut(repo);

      await sut.executar("ana.souza@farmaubs.local", "senhaErrada!");

      expect(repo.registrarFalhaLogin).toHaveBeenCalledWith("usuario-uuid-1");
    });

    it("não cria sessão", async () => {
      const repo = makeRepo();
      const sut = await buildSut(repo);

      await sut.executar("ana.souza@farmaubs.local", "senhaErrada!");

      expect(repo.criarSessao).not.toHaveBeenCalled();
    });
  });

  describe("Cenário 3 — Bloqueio após 5ª tentativa inválida", () => {
    it("retorna CREDENCIAIS_INVALIDAS (não revela bloqueio na 5ª tentativa)", async () => {
      // Após a 5ª falha, registrarFalhaLogin é chamada; o bloqueio é efetivado
      // no banco pela função SQL. O use-case devolve CREDENCIAIS_INVALIDAS nessa
      // rodada; CONTA_BLOQUEADA só aparece na tentativa SEGUINTE.
      const repo = makeRepo({
        buscarUsuarioPorEmail: jest
          .fn()
          .mockResolvedValue(makeUsuario({ tentativasLoginFalhas: 4 })),
      });
      const sut = await buildSut(repo);

      const result = await sut.executar(
        "ana.souza@farmaubs.local",
        "senhaErrada!",
      );

      expect(result).toEqual({ ok: false, motivo: "CREDENCIAIS_INVALIDAS" });
      expect(repo.registrarFalhaLogin).toHaveBeenCalledWith("usuario-uuid-1");
      expect(repo.criarSessao).not.toHaveBeenCalled();
    });
  });

  describe("Cenário 4 — Tentativa durante bloqueio ativo", () => {
    it("retorna CONTA_BLOQUEADA com minutosRestantes", async () => {
      const bloqueadoAte = new Date(Date.now() + 14 * 60_000 + 30_000); // ~14,5 min
      const repo = makeRepo({
        buscarUsuarioPorEmail: jest
          .fn()
          .mockResolvedValue(makeUsuario({ bloqueadoAte })),
      });
      const sut = await buildSut(repo);

      const result = await sut.executar(
        "ana.souza@farmaubs.local",
        SENHA_PLAIN,
      );

      expect(result).toMatchObject({
        ok: false,
        motivo: "CONTA_BLOQUEADA",
        minutosRestantes: 15, // Math.ceil de ~14,5
      });
    });

    it("não incrementa contador durante bloqueio", async () => {
      const bloqueadoAte = new Date(Date.now() + 5 * 60_000);
      const repo = makeRepo({
        buscarUsuarioPorEmail: jest
          .fn()
          .mockResolvedValue(makeUsuario({ bloqueadoAte })),
      });
      const sut = await buildSut(repo);

      await sut.executar("ana.souza@farmaubs.local", SENHA_PLAIN);

      expect(repo.registrarFalhaLogin).not.toHaveBeenCalled();
    });

    it("não cria sessão durante bloqueio", async () => {
      const bloqueadoAte = new Date(Date.now() + 5 * 60_000);
      const repo = makeRepo({
        buscarUsuarioPorEmail: jest
          .fn()
          .mockResolvedValue(makeUsuario({ bloqueadoAte })),
      });
      const sut = await buildSut(repo);

      await sut.executar("ana.souza@farmaubs.local", SENHA_PLAIN);

      expect(repo.criarSessao).not.toHaveBeenCalled();
    });

    it("bloqueio expirado não bloqueia o login", async () => {
      const bloqueadoAte = new Date(Date.now() - 1); // já expirou
      const repo = makeRepo({
        buscarUsuarioPorEmail: jest
          .fn()
          .mockResolvedValue(makeUsuario({ bloqueadoAte })),
      });
      const sut = await buildSut(repo);

      const result = await sut.executar(
        "ana.souza@farmaubs.local",
        SENHA_PLAIN,
      );

      expect(result.ok).toBe(true);
    });
  });

  describe("Cenário 5 — E-mail inexistente (anti enumeração)", () => {
    it("retorna a mesma mensagem genérica CREDENCIAIS_INVALIDAS", async () => {
      const repo = makeRepo({
        buscarUsuarioPorEmail: jest.fn().mockResolvedValue(null),
      });
      const sut = await buildSut(repo);

      const result = await sut.executar(
        "nao.cadastrado@farmaubs.local",
        "qualquer",
      );

      expect(result).toEqual({ ok: false, motivo: "CREDENCIAIS_INVALIDAS" });
    });

    it("não cria sessão para e-mail inexistente", async () => {
      const repo = makeRepo({
        buscarUsuarioPorEmail: jest.fn().mockResolvedValue(null),
      });
      const sut = await buildSut(repo);

      await sut.executar("nao.cadastrado@farmaubs.local", "qualquer");

      expect(repo.criarSessao).not.toHaveBeenCalled();
    });
  });

  describe("Cenário 5b — Usuário inativo (anti enumeração)", () => {
    it("retorna CREDENCIAIS_INVALIDAS para usuário inativo", async () => {
      const repo = makeRepo({
        buscarUsuarioPorEmail: jest
          .fn()
          .mockResolvedValue(makeUsuario({ ativo: false })),
      });
      const sut = await buildSut(repo);

      const result = await sut.executar(
        "ana.souza@farmaubs.local",
        SENHA_PLAIN,
      );

      expect(result).toEqual({ ok: false, motivo: "CREDENCIAIS_INVALIDAS" });
    });
  });

  describe("Cenário 6 — Login válido zera contador", () => {
    it("chama resetarEstadoLogin limpando bloqueadoAte e tentativas", async () => {
      const repo = makeRepo({
        buscarUsuarioPorEmail: jest
          .fn()
          .mockResolvedValue(makeUsuario({ tentativasLoginFalhas: 2 })),
      });
      const sut = await buildSut(repo);

      const result = await sut.executar(
        "ana.souza@farmaubs.local",
        SENHA_PLAIN,
      );

      expect(result.ok).toBe(true);
      expect(repo.resetarEstadoLogin).toHaveBeenCalledWith("usuario-uuid-1");
      expect(repo.registrarFalhaLogin).not.toHaveBeenCalled();
    });
  });
});
