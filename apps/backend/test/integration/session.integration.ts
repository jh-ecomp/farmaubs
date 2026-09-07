import * as crypto from "crypto";
import * as bcrypt from "bcrypt";
import { DataSource } from "typeorm";
import { adminDatabaseUrl, appDatabaseUrl } from "../test-db";
import { SessionPgRepository } from "../../src/modules/auth/infrastructure/adapters/session-pg.repository";
import { AuthPgRepository } from "../../src/modules/auth/infrastructure/adapters/auth-pg.repository";

const MUNICIPIO_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PERFIL_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const USER_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const EMAIL = "session.integration@farmaubs.test";

describe("SessionPgRepository — integração (camada B)", () => {
  let admin: DataSource;
  let app: DataSource;
  let sessionRepo: SessionPgRepository;
  let authRepo: AuthPgRepository;

  beforeAll(async () => {
    admin = new DataSource({ type: "postgres", url: adminDatabaseUrl() });
    app = new DataSource({ type: "postgres", url: appDatabaseUrl() });
    await admin.initialize();
    await app.initialize();

    sessionRepo = new SessionPgRepository(app);
    authRepo = new AuthPgRepository(app);

    const senhaHash = await bcrypt.hash("Teste@123456", 4);

    await admin.query(`DELETE FROM sessions WHERE usuario_id = $1`, [USER_ID]);
    await admin.query(`DELETE FROM users    WHERE id = $1`, [USER_ID]);

    await admin.query(
      `INSERT INTO perfis (id, codigo, nome)
       VALUES ($1, 'FARMACEUTICO_SESSION_TEST', 'Farmacêutico Session Test')
       ON CONFLICT (id) DO NOTHING`,
      [PERFIL_ID],
    );
    await admin.query(
      `INSERT INTO municipios (id, nome, uf)
       VALUES ($1, 'Município Session Test', 'PI')
       ON CONFLICT (id) DO NOTHING`,
      [MUNICIPIO_ID],
    );
    await admin.query(
      `INSERT INTO users
         (id, nome_completo, email, senha_hash, perfil_id, municipio_id,
          tentativas_login_falhas, bloqueado_ate)
       VALUES ($1, 'Usuário Session', $2, $3, $4, $5, 0, NULL)`,
      [USER_ID, EMAIL, senhaHash, PERFIL_ID, MUNICIPIO_ID],
    );
  });

  afterAll(async () => {
    await admin.query(`DELETE FROM sessions WHERE usuario_id = $1`, [USER_ID]);
    await admin.query(`DELETE FROM users    WHERE id = $1`, [USER_ID]);
    await admin?.destroy();
    await app?.destroy();
  });

  // ── buscarPorTokenHash ────────────────────────────────────────────────────

  it("buscarPorTokenHash retorna sessão ativa não expirada", async () => {
    const expiraEm = new Date(Date.now() + 60 * 60_000);
    const tokenPlain = await authRepo.criarSessao({
      usuarioId: USER_ID,
      expiraEm,
    });
    const tokenHash = crypto
      .createHash("sha256")
      .update(tokenPlain)
      .digest("hex");

    const sessao = await sessionRepo.buscarPorTokenHash(tokenHash);

    expect(sessao).not.toBeNull();
    expect(sessao!.usuarioId).toBe(USER_ID);
    expect(sessao!.municipioId).toBe(MUNICIPIO_ID);
    expect(sessao!.status).toBe("ativa");
  });

  it("buscarPorTokenHash retorna null para token inexistente", async () => {
    const fakeHash = crypto
      .createHash("sha256")
      .update("token-falso")
      .digest("hex");
    const sessao = await sessionRepo.buscarPorTokenHash(fakeHash);
    expect(sessao).toBeNull();
  });

  it("buscarPorTokenHash retorna null para sessão expirada", async () => {
    const expiraEm = new Date(Date.now() - 1000);
    const tokenPlain = await authRepo.criarSessao({
      usuarioId: USER_ID,
      expiraEm,
    });
    const tokenHash = crypto
      .createHash("sha256")
      .update(tokenPlain)
      .digest("hex");

    const sessao = await sessionRepo.buscarPorTokenHash(tokenHash);
    expect(sessao).toBeNull();
  });

  // ── renovarAtividade ──────────────────────────────────────────────────────

  it("renovarAtividade atualiza expira_em e ultima_atividade_em", async () => {
    const expiraEm = new Date(Date.now() + 60 * 60_000);
    const tokenPlain = await authRepo.criarSessao({
      usuarioId: USER_ID,
      expiraEm,
    });
    const tokenHash = crypto
      .createHash("sha256")
      .update(tokenPlain)
      .digest("hex");

    const sessao = await sessionRepo.buscarPorTokenHash(tokenHash);
    expect(sessao).not.toBeNull();

    const novaExpiracao = new Date(Date.now() + 90 * 60_000);
    await sessionRepo.renovarAtividade({
      sessionId: sessao!.id,
      expiraEm: novaExpiracao,
    });

    const rows = await admin.query(
      `SELECT expira_em, ultima_atividade_em FROM sessions WHERE id = $1`,
      [sessao!.id],
    );
    expect(new Date(rows[0].expira_em).getTime()).toBeGreaterThan(
      expiraEm.getTime(),
    );
  });

  // ── revogar ───────────────────────────────────────────────────────────────

  it("revogar muda status para revogada e define revogada_em", async () => {
    const expiraEm = new Date(Date.now() + 60 * 60_000);
    const tokenPlain = await authRepo.criarSessao({
      usuarioId: USER_ID,
      expiraEm,
    });
    const tokenHash = crypto
      .createHash("sha256")
      .update(tokenPlain)
      .digest("hex");

    const sessao = await sessionRepo.buscarPorTokenHash(tokenHash);
    expect(sessao).not.toBeNull();

    await sessionRepo.revogar(sessao!.id);

    const rows = await admin.query(
      `SELECT status, revogada_em FROM sessions WHERE id = $1`,
      [sessao!.id],
    );
    expect(rows[0].status).toBe("revogada");
    expect(rows[0].revogada_em).not.toBeNull();
  });

  it("buscarPorTokenHash retorna null após revogar", async () => {
    const expiraEm = new Date(Date.now() + 60 * 60_000);
    const tokenPlain = await authRepo.criarSessao({
      usuarioId: USER_ID,
      expiraEm,
    });
    const tokenHash = crypto
      .createHash("sha256")
      .update(tokenPlain)
      .digest("hex");

    const sessao = await sessionRepo.buscarPorTokenHash(tokenHash);
    await sessionRepo.revogar(sessao!.id);

    const resultado = await sessionRepo.buscarPorTokenHash(tokenHash);
    expect(resultado).toBeNull();
  });

  // ── revogarTodas ──────────────────────────────────────────────────────────

  it("revogarTodas revoga todas as sessões ativas do usuário", async () => {
    const expiraEm = new Date(Date.now() + 60 * 60_000);
    await authRepo.criarSessao({ usuarioId: USER_ID, expiraEm });
    await authRepo.criarSessao({ usuarioId: USER_ID, expiraEm });

    await sessionRepo.revogarTodas(USER_ID);

    const rows = await admin.query(
      `SELECT count(*)::int AS total FROM sessions
       WHERE usuario_id = $1 AND status = 'ativa'`,
      [USER_ID],
    );
    expect(rows[0].total).toBe(0);
  });
});
