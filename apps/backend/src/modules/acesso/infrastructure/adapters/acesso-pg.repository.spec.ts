/**
 * Camada B — Teste de integração do adaptador de repositório de acesso/sessões.
 *
 * Requer banco PostgreSQL acessível via variáveis de ambiente:
 *   DB_HOST, DB_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
 *
 * Execução:
 *   npm run test -- --testPathPattern="acesso-pg.repository.spec" --runInBand
 *
 * Pré-condições:
 *   - Migrations aplicadas (AC-01 a AC-04)
 *   - Seed de desenvolvimento executado (TAREFA-12)
 *   - Usuário admin@farmaubs.dev disponível com senha Admin@123456
 */

import * as path from "path";
import * as dotenv from "dotenv";
import { DataSource } from "typeorm";
import * as crypto from "crypto";
import { AcessoPgRepository } from "./acesso-pg.repository";
import { SessionPgRepository } from "./session-pg.repository";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

// ─── conexão com banco real ──────────────────────────────────────────────────

let ds: DataSource;
let acessoRepo: AcessoPgRepository;
let sessionRepo: SessionPgRepository;

beforeAll(async () => {
  ds = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST ?? "localhost",
    port: parseInt(process.env.DB_PORT ?? "5434", 10),
    database: process.env.POSTGRES_DB ?? "farmaubs",
    username: process.env.POSTGRES_USER ?? "farmaubs_admin",
    password: process.env.POSTGRES_PASSWORD ?? "",
    synchronize: false,
    logging: false,
  });

  await ds.initialize();

  // Injeta DataSource manualmente (sem NestJS DI — teste de adaptador puro)
  acessoRepo = new AcessoPgRepository(ds);
  sessionRepo = new SessionPgRepository(ds);
}, 30_000);

afterAll(async () => {
  if (ds?.isInitialized) await ds.destroy();
});

// ─── helpers ────────────────────────────────────────────────────────────────

/** E-mail do usuário semeado pelo seed de desenvolvimento (TAREFA-12). */
const EMAIL_ADMIN = "admin@farmaubs.dev";

async function buscarIdUsuario(email: string): Promise<string> {
  const rows = await ds.query<{ id: string }[]>(
    `SELECT id FROM users WHERE email = $1`,
    [email],
  );
  if (!rows[0])
    throw new Error(`Usuário "${email}" não encontrado — execute o seed.`);
  return rows[0].id;
}

async function resetarUsuario(usuarioId: string): Promise<void> {
  await ds.query(
    `UPDATE users
     SET tentativas_login_falhas = 0,
         bloqueado_ate           = NULL,
         updated_at              = now()
     WHERE id = $1`,
    [usuarioId],
  );
}

async function excluirSessoesDoUsuario(usuarioId: string): Promise<void> {
  await ds.query(`DELETE FROM sessions WHERE usuario_id = $1`, [usuarioId]);
}

// ─── testes ──────────────────────────────────────────────────────────────────

describe("AcessoPgRepository (integração — camada B)", () => {
  describe("buscarUsuarioPorEmail", () => {
    it("retorna o registro correto para um e-mail válido do seed", async () => {
      const registro = await acessoRepo.buscarUsuarioPorEmail(EMAIL_ADMIN);

      expect(registro).not.toBeNull();
      expect(registro!.email).toBe(EMAIL_ADMIN);
      expect(registro!.ativo).toBe(true);
      expect(registro!.senhaHash).toMatch(/^\$2[ab]\$/); // bcrypt
      expect(typeof registro!.id).toBe("string");
      expect(typeof registro!.municipioId).toBe("string");
    });

    it("retorna null para e-mail inexistente", async () => {
      const resultado = await acessoRepo.buscarUsuarioPorEmail(
        "nao.existe@farmaubs.dev",
      );
      expect(resultado).toBeNull();
    });

    it("é case-insensitive (normalização de caixa — AC-03)", async () => {
      const resultado =
        await acessoRepo.buscarUsuarioPorEmail("ADMIN@FARMAUBS.DEV");
      expect(resultado).not.toBeNull();
      expect(resultado!.email).toBe(EMAIL_ADMIN);
    });
  });

  describe("registrarFalhaLogin e resetarEstadoLogin", () => {
    let usuarioId: string;

    beforeEach(async () => {
      usuarioId = await buscarIdUsuario(EMAIL_ADMIN);
      await resetarUsuario(usuarioId);
    });

    afterEach(async () => {
      await resetarUsuario(usuarioId);
    });

    it("incrementa tentativas_login_falhas em 1", async () => {
      await acessoRepo.registrarFalhaLogin(usuarioId);

      const rows = await ds.query<{ tentativas_login_falhas: number }[]>(
        `SELECT tentativas_login_falhas FROM users WHERE id = $1`,
        [usuarioId],
      );
      expect(rows[0].tentativas_login_falhas).toBe(1);
    });

    it("bloqueia a conta após LOGIN_MAX_ATTEMPTS falhas (default 5)", async () => {
      // Chama registrarFalhaLogin 5 vezes para atingir o limite
      for (let i = 0; i < 5; i++) {
        await acessoRepo.registrarFalhaLogin(usuarioId);
      }

      const rows = await ds.query<
        {
          tentativas_login_falhas: number;
          bloqueado_ate: Date | null;
        }[]
      >(
        `SELECT tentativas_login_falhas, bloqueado_ate FROM users WHERE id = $1`,
        [usuarioId],
      );

      expect(rows[0].tentativas_login_falhas).toBeGreaterThanOrEqual(5);
      expect(rows[0].bloqueado_ate).not.toBeNull();
      expect(new Date(rows[0].bloqueado_ate!).getTime()).toBeGreaterThan(
        Date.now(),
      );
    });

    it("resetarEstadoLogin zera tentativas e limpa bloqueado_ate", async () => {
      // Simula estado bloqueado diretamente no banco
      await ds.query(
        `UPDATE users
         SET tentativas_login_falhas = 3,
             bloqueado_ate           = now() + interval '10 minutes'
         WHERE id = $1`,
        [usuarioId],
      );

      await acessoRepo.resetarEstadoLogin(usuarioId);

      const rows = await ds.query<
        {
          tentativas_login_falhas: number;
          bloqueado_ate: Date | null;
        }[]
      >(
        `SELECT tentativas_login_falhas, bloqueado_ate FROM users WHERE id = $1`,
        [usuarioId],
      );

      expect(rows[0].tentativas_login_falhas).toBe(0);
      expect(rows[0].bloqueado_ate).toBeNull();
    });
  });

  describe("criarSessao", () => {
    let usuarioId: string;

    beforeAll(async () => {
      usuarioId = await buscarIdUsuario(EMAIL_ADMIN);
    });

    afterEach(async () => {
      await excluirSessoesDoUsuario(usuarioId);
    });

    it("retorna um token em texto plano (64 hex chars)", async () => {
      const expiraEm = new Date(Date.now() + 60 * 60_000);
      const token = await acessoRepo.criarSessao({ usuarioId, expiraEm });

      expect(typeof token).toBe("string");
      expect(token).toHaveLength(64); // 32 bytes → 64 hex
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it("armazena apenas o hash SHA-256 do token na tabela sessions", async () => {
      const expiraEm = new Date(Date.now() + 60 * 60_000);
      const token = await acessoRepo.criarSessao({ usuarioId, expiraEm });

      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      const rows = await ds.query<{ token_hash: string }[]>(
        `SELECT token_hash FROM sessions WHERE usuario_id = $1 ORDER BY criado_em DESC LIMIT 1`,
        [usuarioId],
      );

      expect(rows[0]).toBeDefined();
      expect(rows[0].token_hash).toBe(tokenHash);
    });

    it("dois logins consecutivos geram token_hashes únicos", async () => {
      const expiraEm = new Date(Date.now() + 60 * 60_000);

      const token1 = await acessoRepo.criarSessao({ usuarioId, expiraEm });
      const token2 = await acessoRepo.criarSessao({ usuarioId, expiraEm });

      expect(token1).not.toBe(token2);

      const hash1 = crypto.createHash("sha256").update(token1).digest("hex");
      const hash2 = crypto.createHash("sha256").update(token2).digest("hex");
      expect(hash1).not.toBe(hash2);
    });

    it("expires_at é gravado corretamente na sessão", async () => {
      const expiraEm = new Date(Date.now() + 60 * 60_000);
      const token = await acessoRepo.criarSessao({ usuarioId, expiraEm });
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      const rows = await ds.query<{ expira_em: Date }[]>(
        `SELECT expira_em FROM sessions WHERE token_hash = $1`,
        [tokenHash],
      );

      const diff = Math.abs(
        new Date(rows[0].expira_em).getTime() - expiraEm.getTime(),
      );
      expect(diff).toBeLessThan(2_000); // tolerância de 2s
    });
  });

  describe("buscarEscopoUsuario", () => {
    it("retorna perfilId e unidadeIds para o admin do seed", async () => {
      const usuarioId = await buscarIdUsuario(EMAIL_ADMIN);

      const escopo = await acessoRepo.buscarEscopoUsuario(usuarioId);

      expect(typeof escopo.perfilId).toBe("string");
      expect(escopo.perfilId.length).toBeGreaterThan(0);
      expect(Array.isArray(escopo.unidadeIds)).toBe(true);
      expect(escopo.unidadeIds.length).toBeGreaterThan(0);
    });

    it("lança erro para usuário inexistente", async () => {
      const idFalso = "00000000-0000-0000-0000-000000000000";

      await expect(acessoRepo.buscarEscopoUsuario(idFalso)).rejects.toThrow();
    });
  });
});

describe("SessionPgRepository (integração — camada B)", () => {
  let usuarioId: string;
  let tokenPlain: string;
  let tokenHash: string;

  beforeAll(async () => {
    usuarioId = await buscarIdUsuario(EMAIL_ADMIN);
  });

  beforeEach(async () => {
    // Cria uma sessão fresca via AcessoPgRepository para cada teste
    await excluirSessoesDoUsuario(usuarioId);
    const expiraEm = new Date(Date.now() + 60 * 60_000);
    tokenPlain = await acessoRepo.criarSessao({ usuarioId, expiraEm });
    tokenHash = crypto.createHash("sha256").update(tokenPlain).digest("hex");
  });

  afterEach(async () => {
    await excluirSessoesDoUsuario(usuarioId);
  });

  describe("buscarPorTokenHash", () => {
    it("retorna SessionRecord completo para hash válido", async () => {
      const sessao = await sessionRepo.buscarPorTokenHash(tokenHash);

      expect(sessao).not.toBeNull();
      expect(sessao!.usuarioId).toBe(usuarioId);
      expect(typeof sessao!.municipioId).toBe("string");
      expect(typeof sessao!.perfilId).toBe("string");
      expect(Array.isArray(sessao!.unidadeIds)).toBe(true);
      expect(sessao!.status).toBe("ativa");
      expect(sessao!.expiraEm).toBeInstanceOf(Date);
      expect(sessao!.criadoEm).toBeInstanceOf(Date);
    });

    it("retorna null para hash inexistente", async () => {
      const resultado = await sessionRepo.buscarPorTokenHash(
        "hash-que-nao-existe",
      );
      expect(resultado).toBeNull();
    });

    it("retorna null para sessão expirada", async () => {
      // Expira a sessão manualmente
      await ds.query(
        `UPDATE sessions SET expira_em = now() - interval '1 second' WHERE token_hash = $1`,
        [tokenHash],
      );

      const resultado = await sessionRepo.buscarPorTokenHash(tokenHash);
      expect(resultado).toBeNull();
    });
  });

  describe("renovarAtividade", () => {
    it("atualiza expira_em da sessão com renovação deslizante", async () => {
      const sessao = await sessionRepo.buscarPorTokenHash(tokenHash);
      const novaExpiracao = new Date(Date.now() + 90 * 60_000); // +90 min

      await sessionRepo.renovarAtividade({
        sessionId: sessao!.id,
        expiraEm: novaExpiracao,
      });

      const rows = await ds.query<{ expira_em: Date }[]>(
        `SELECT expira_em FROM sessions WHERE token_hash = $1`,
        [tokenHash],
      );

      const diff = Math.abs(
        new Date(rows[0].expira_em).getTime() - novaExpiracao.getTime(),
      );
      expect(diff).toBeLessThan(2_000);
    });
  });

  describe("revogar", () => {
    it("revoga a sessão (status = revogada ou registro removido)", async () => {
      const sessao = await sessionRepo.buscarPorTokenHash(tokenHash);
      expect(sessao).not.toBeNull();

      await sessionRepo.revogar(sessao!.id);

      // Após revogar, busca deve retornar null
      const resultado = await sessionRepo.buscarPorTokenHash(tokenHash);
      expect(resultado).toBeNull();
    });
  });

  describe("revogarTodas", () => {
    it("revoga todas as sessões ativas do usuário", async () => {
      // Cria uma segunda sessão
      const expiraEm = new Date(Date.now() + 60 * 60_000);
      const token2 = await acessoRepo.criarSessao({ usuarioId, expiraEm });
      const hash2 = crypto.createHash("sha256").update(token2).digest("hex");

      await sessionRepo.revogarTodas(usuarioId);

      const s1 = await sessionRepo.buscarPorTokenHash(tokenHash);
      const s2 = await sessionRepo.buscarPorTokenHash(hash2);

      expect(s1).toBeNull();
      expect(s2).toBeNull();
    });
  });
});
