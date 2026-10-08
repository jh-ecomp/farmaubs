import * as crypto from "crypto";
import * as bcrypt from "bcrypt";
import { DataSource } from "typeorm";
import { adminDatabaseUrl, appDatabaseUrl } from "../test-db";
import { SessionPgRepository } from "../../src/modules/acesso/infrastructure/adapters/session-pg.repository";

const MUNICIPIO_ID = "5e55a000-0000-4000-8000-0000000000a1";
const USER_ID = "5e55a000-0000-4000-8000-0000000000b1";
const UBS_1 = "5e55a000-0000-4000-8000-0000000000c1";
const UBS_2 = "5e55a000-0000-4000-8000-0000000000c2";
const UBS_INATIVA = "5e55a000-0000-4000-8000-0000000000c3";
const EMAIL = "session.hardening@farmaubs.test";

const FUNCOES_SESSAO = [
  "auth_criar_sessao",
  "auth_buscar_sessao_por_token",
  "auth_renovar_sessao",
  "auth_revogar_sessao",
  "auth_revogar_todas_sessoes",
  "auth_limpar_sessoes_expiradas",
];

const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
const hashAleatorio = () => crypto.randomBytes(32).toString("hex");

describe("Sessões — endurecimento e escopo (integração, camada C)", () => {
  let admin: DataSource;
  let app: DataSource;
  let sessionRepo: SessionPgRepository;

  async function limparFixtures() {
    await admin.query(`DELETE FROM sessions WHERE usuario_id = $1`, [USER_ID]);
    await admin.query(`DELETE FROM user_units WHERE usuario_id = $1`, [USER_ID]);
    await admin.query(`DELETE FROM users WHERE id = $1`, [USER_ID]);
    await admin.query(`DELETE FROM unidades_saude WHERE id = ANY($1::uuid[])`, [
      [UBS_1, UBS_2, UBS_INATIVA],
    ]);
    await admin.query(`DELETE FROM municipios WHERE id = $1`, [MUNICIPIO_ID]);
  }

  async function criarSessaoAtiva() {
    const token = await sessionRepo.criarSessao({
      usuarioId: USER_ID,
      expiraEm: new Date(Date.now() + 60 * 60_000),
    });
    return { token, hash: sha256(token) };
  }

  beforeAll(async () => {
    admin = new DataSource({ type: "postgres", url: adminDatabaseUrl() });
    app = new DataSource({ type: "postgres", url: appDatabaseUrl() });
    await admin.initialize();
    await app.initialize();
    sessionRepo = new SessionPgRepository(app);

    await limparFixtures();

    const perfis = await admin.query(
      `SELECT id FROM perfis WHERE codigo = 'ADMINISTRADOR'`,
    );
    if (!perfis[0]) throw new Error("Perfil ADMINISTRADOR não encontrado (seed do global-setup)");

    await admin.query(
      `INSERT INTO municipios (id, nome, uf, codigo_ibge)
       VALUES ($1, 'Município Hardening Test', 'PI', '2200039')`,
      [MUNICIPIO_ID],
    );
    for (const [id, nome] of [
      [UBS_1, "UBS Hardening 1"],
      [UBS_2, "UBS Hardening 2"],
      [UBS_INATIVA, "UBS Hardening 3"],
    ]) {
      await admin.query(
        `INSERT INTO unidades_saude (id, municipio_id, nome, caf_lead_time_days)
         VALUES ($1, $2, $3, 15)`,
        [id, MUNICIPIO_ID, nome],
      );
    }
    await admin.query(
      `INSERT INTO users
         (id, nome_completo, email, senha_hash, perfil_id, municipio_id,
          tentativas_login_falhas, bloqueado_ate)
       VALUES ($1, 'Usuário Hardening', $2, $3, $4, $5, 0, NULL)`,
      [USER_ID, EMAIL, await bcrypt.hash("Teste@123456", 4), perfis[0].id, MUNICIPIO_ID],
    );
    await admin.query(
      `INSERT INTO user_units (usuario_id, unidade_id, ativo) VALUES
         ($1, $2, true), ($1, $3, true), ($1, $4, false)`,
      [USER_ID, UBS_1, UBS_2, UBS_INATIVA],
    );
  });

  afterEach(async () => {
    await admin.query(`DELETE FROM sessions WHERE usuario_id = $1`, [USER_ID]);
  });

  afterAll(async () => {
    await limparFixtures();
    await admin?.destroy();
    await app?.destroy();
  });

  // ── Lookup com escopo completo ────────────────────────────────────────────

  it("lookup retorna perfil ADMINISTRADOR e somente as 2 UBSs ativas do usuário", async () => {
    const { hash } = await criarSessaoAtiva();

    const s = await sessionRepo.buscarPorTokenHash(hash);

    expect(s).not.toBeNull();
    expect(s!.perfilCodigo).toBe("ADMINISTRADOR");
    expect(s!.municipioId).toBe(MUNICIPIO_ID);
    expect([...s!.unidadeIds].sort()).toEqual([UBS_1, UBS_2].sort());
    expect(s!.nomeCompleto).toBe("Usuário Hardening");
    expect(s!.email).toBe(EMAIL);
    expect(s!.status).toBe("ativa");
  });

  it("lookup retorna null quando o usuário está inativo", async () => {
    const { hash } = await criarSessaoAtiva();

    await admin.query(`UPDATE users SET ativo = false WHERE id = $1`, [USER_ID]);
    try {
      expect(await sessionRepo.buscarPorTokenHash(hash)).toBeNull();
    } finally {
      await admin.query(`UPDATE users SET ativo = true WHERE id = $1`, [USER_ID]);
    }

    // Reativado, o mesmo token volta a valer: o null veio do filtro de usuário ativo
    expect(await sessionRepo.buscarPorTokenHash(hash)).not.toBeNull();
  });

  // ── Revogação ─────────────────────────────────────────────────────────────

  it("revogar é idempotente e não sobrescreve revogada_em", async () => {
    const { hash } = await criarSessaoAtiva();
    const s = await sessionRepo.buscarPorTokenHash(hash);

    await sessionRepo.revogar(s!.id);
    const [a] = await admin.query(
      `SELECT status, revogada_em FROM sessions WHERE id = $1`,
      [s!.id],
    );
    await new Promise((r) => setTimeout(r, 25));
    await sessionRepo.revogar(s!.id);
    const [b] = await admin.query(
      `SELECT status, revogada_em FROM sessions WHERE id = $1`,
      [s!.id],
    );

    expect(a.status).toBe("revogada");
    expect(a.revogada_em).not.toBeNull();
    expect(new Date(b.revogada_em).getTime()).toBe(new Date(a.revogada_em).getTime());
  });

  it("revogarTodas revoga sessões ativas e pendente_2fa, preenchendo revogada_em", async () => {
    await criarSessaoAtiva();
    await criarSessaoAtiva();
    await admin.query(
      `INSERT INTO sessions (usuario_id, token_hash, status, expira_em)
       VALUES ($1, $2, 'pendente_2fa', now() + interval '1 hour')`,
      [USER_ID, hashAleatorio()],
    );

    await sessionRepo.revogarTodas(USER_ID);

    const rows = await admin.query(
      `SELECT status, revogada_em FROM sessions WHERE usuario_id = $1`,
      [USER_ID],
    );
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r.status).toBe("revogada");
      expect(r.revogada_em).not.toBeNull();
    }
  });

  // ── Limpeza ───────────────────────────────────────────────────────────────

  it("limparExpiradas apaga só as vencidas além da retenção", async () => {
    const velha = hashAleatorio();
    const recente = hashAleatorio();
    const ativa = hashAleatorio();
    await admin.query(
      `INSERT INTO sessions (usuario_id, token_hash, status, expira_em) VALUES
         ($1, $2, 'ativa', now() - interval '30 days'),
         ($1, $3, 'ativa', now() - interval '3 days'),
         ($1, $4, 'ativa', now() + interval '1 hour')`,
      [USER_ID, velha, recente, ativa],
    );

    const total = await sessionRepo.limparExpiradas(7);

    expect(total).toBeGreaterThanOrEqual(1);
    const restantes = await admin.query(
      `SELECT token_hash::text AS token_hash FROM sessions
       WHERE token_hash::text = ANY($1::text[])`,
      [[velha, recente, ativa]],
    );
    expect(restantes.map((r: any) => r.token_hash.trim()).sort()).toEqual(
      [recente, ativa].sort(),
    );
  });

  it("limparExpiradas rejeita retenção negativa e preserva sessões ativas", async () => {
    const { hash } = await criarSessaoAtiva();

    await expect(sessionRepo.limparExpiradas(-5)).rejects.toThrow(/retencao/i);

    expect(await sessionRepo.buscarPorTokenHash(hash)).not.toBeNull();
  });

  it("a função SQL de limpeza rejeita retenção nula", async () => {
    await expect(
      app.query(`SELECT auth_limpar_sessoes_expiradas($1::int)`, [null]),
    ).rejects.toThrow(/retencao/i);
  });

  // ── Permissões das funções SECURITY DEFINER ───────────────────────────────

  it("funções de sessão: EXECUTE só para farmaubs_app, nunca para PUBLIC", async () => {
    const rows = await admin.query(
      `SELECT p.proname,
              p.proacl IS NOT NULL AS tem_acl,
              EXISTS (SELECT 1 FROM aclexplode(p.proacl) a
                       WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE') AS publico,
              has_function_privilege('farmaubs_app', p.oid, 'EXECUTE') AS app
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`,
      [FUNCOES_SESSAO],
    );

    expect(rows.map((r: any) => r.proname).sort()).toEqual([...FUNCOES_SESSAO].sort());
    for (const r of rows) {
      expect({ fn: r.proname, tem_acl: r.tem_acl }).toEqual({ fn: r.proname, tem_acl: true });
      expect({ fn: r.proname, publico: r.publico }).toEqual({ fn: r.proname, publico: false });
      expect({ fn: r.proname, app: r.app }).toEqual({ fn: r.proname, app: true });
    }
  });
});
