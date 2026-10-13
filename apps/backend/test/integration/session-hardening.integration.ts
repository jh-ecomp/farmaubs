import * as crypto from "crypto";
import * as bcrypt from "bcrypt";
import { DataSource } from "typeorm";
import { adminDatabaseUrl, appDatabaseUrl } from "../test-db";
import { SessionPgRepository } from "../../src/modules/acesso/infrastructure/adapters/session-pg.repository";

// ── Fixtures ────────────────────────────────────────────────────────────────

const MUNICIPIO_ID = "5e55a000-0000-4000-8000-0000000000a1";
const USER_ID = "5e55a000-0000-4000-8000-0000000000b1";
const UBS_1 = "5e55a000-0000-4000-8000-0000000000c1";
const UBS_2 = "5e55a000-0000-4000-8000-0000000000c2";
const UBS_INATIVA = "5e55a000-0000-4000-8000-0000000000c3";
const EMAIL = "session.hardening@farmaubs.test";

const UBS_FIXTURES: ReadonlyArray<{
  id: string;
  nome: string;
  ativa: boolean;
}> = [
  { id: UBS_1, nome: "UBS Hardening 1", ativa: true },
  { id: UBS_2, nome: "UBS Hardening 2", ativa: true },
  { id: UBS_INATIVA, nome: "UBS Hardening 3", ativa: false },
];

const FUNCOES_SESSAO = [
  "auth_criar_sessao",
  "auth_buscar_sessao_por_token",
  "auth_renovar_sessao",
  "auth_revogar_sessao",
  "auth_revogar_todas_sessoes",
  "auth_limpar_sessoes_expiradas",
];

const RETENCAO_DIAS = 7;
const MINUTOS_POR_HORA = 60;
const MINUTOS_POR_DIA = 24 * MINUTOS_POR_HORA;

// ── Tipos das linhas lidas diretamente do banco ─────────────────────────────

type StatusSessao = "ativa" | "pendente_2fa" | "revogada";
type LinhaRevogacao = { status: string; revogada_em: Date | null };
type LinhaHash = { token_hash: string };
type LinhaContagem = { n: number };
type LinhaFuncao = {
  proname: string;
  tem_acl: boolean;
  publico: boolean;
  app: boolean;
};

// ── Helpers puros ───────────────────────────────────────────────────────────

/**
 * [NF011 / Hash de token]: Calcula o SHA-256 hexadecimal em minúsculas de um token em texto puro.
 * @param valor - Token em texto puro.
 * @returns Hash de 64 caracteres hexadecimais.
 */
const sha256 = (valor: string): string =>
  crypto.createHash("sha256").update(valor).digest("hex");

/**
 * [Fixture]: Gera um token_hash aleatório válido para inserção direta em `sessions`.
 * @returns String hexadecimal de 64 caracteres.
 */
const hashAleatorio = (): string => crypto.randomBytes(32).toString("hex");

describe("Sessões — endurecimento e escopo (integração, camada C)", () => {
  let admin: DataSource;
  let app: DataSource;
  let sessionRepo: SessionPgRepository;

  // ── Helpers com acesso ao banco ───────────────────────────────────────────

  /**
   * [Fixture]: Remove, na ordem das FKs, tudo o que este arquivo cria.
   * Idempotente: pode rodar antes (resíduo de execução abortada) e depois dos testes.
   */
  async function limparFixtures(): Promise<void> {
    await admin.query(`DELETE FROM sessions WHERE usuario_id = $1`, [USER_ID]);
    await admin.query(`DELETE FROM user_units WHERE usuario_id = $1`, [
      USER_ID,
    ]);
    await admin.query(`DELETE FROM users WHERE id = $1`, [USER_ID]);
    await admin.query(`DELETE FROM unidades_saude WHERE id = ANY($1::uuid[])`, [
      UBS_FIXTURES.map((u) => u.id),
    ]);
    await admin.query(`DELETE FROM municipios WHERE id = $1`, [MUNICIPIO_ID]);
  }

  /**
   * [Fixture]: Cria município, UBSs (2 ativas e 1 inativa no vínculo), perfil ADMINISTRADOR e usuário.
   * @throws {Error} Quando o perfil ADMINISTRADOR não existe (seed do global-setup ausente).
   */
  async function criarFixtures(): Promise<void> {
    const perfis: Array<{ id: string }> = await admin.query(
      `SELECT id FROM perfis WHERE codigo = 'ADMINISTRADOR'`,
    );
    if (!perfis[0]) {
      throw new Error(
        "Perfil ADMINISTRADOR não encontrado (seed do global-setup)",
      );
    }

    await admin.query(
      `INSERT INTO municipios (id, nome, uf, codigo_ibge)
       VALUES ($1, 'Município Hardening Test', 'PI', '2200039')`,
      [MUNICIPIO_ID],
    );

    for (const { id, nome } of UBS_FIXTURES) {
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
      [
        USER_ID,
        EMAIL,
        await bcrypt.hash("Teste@123456", 4),
        perfis[0].id,
        MUNICIPIO_ID,
      ],
    );

    for (const { id, ativa } of UBS_FIXTURES) {
      await admin.query(
        `INSERT INTO user_units (usuario_id, unidade_id, ativo) VALUES ($1, $2, $3)`,
        [USER_ID, id, ativa],
      );
    }
  }

  /**
   * [RF002 / Sessão ativa]: Cria uma sessão válida (1h) pela porta, como o LoginUseCase faria.
   * @returns Token em texto puro e o hash SHA-256 correspondente.
   */
  async function criarSessaoAtiva(): Promise<{ token: string; hash: string }> {
    const token = await sessionRepo.criarSessao({
      usuarioId: USER_ID,
      expiraEm: new Date(Date.now() + MINUTOS_POR_HORA * 60_000),
    });
    return { token, hash: sha256(token) };
  }

  /**
   * [Fixture]: Insere uma sessão diretamente em `sessions`, contornando a porta, para forjar
   * estados que ela não produz (pendente_2fa, expiradas há dias).
   * @param status - Status inicial da sessão.
   * @param minutosAteExpirar - Offset de `expira_em` em relação a agora (negativo = já vencida).
   * @returns O token_hash inserido.
   */
  async function inserirSessaoDireta(
    status: StatusSessao,
    minutosAteExpirar: number,
  ): Promise<string> {
    const hash = hashAleatorio();
    await admin.query(
      `INSERT INTO sessions (usuario_id, token_hash, status, expira_em)
       VALUES ($1, $2, $3, now() + make_interval(mins => $4::int))`,
      [USER_ID, hash, status, minutosAteExpirar],
    );
    return hash;
  }

  /**
   * [RF004 / Revogação]: Lê status e revogada_em de uma sessão direto da tabela.
   * @param sessionId - UUID da sessão.
   * @returns Linha com status e carimbo de revogação.
   */
  async function lerRevogacao(sessionId: string): Promise<LinhaRevogacao> {
    const [linha]: LinhaRevogacao[] = await admin.query(
      `SELECT status, revogada_em FROM sessions WHERE id = $1`,
      [sessionId],
    );
    return linha;
  }

  // ── Ciclo de vida ─────────────────────────────────────────────────────────

  beforeAll(async () => {
    admin = new DataSource({ type: "postgres", url: adminDatabaseUrl() });
    app = new DataSource({ type: "postgres", url: appDatabaseUrl() });
    await admin.initialize();
    await app.initialize();
    sessionRepo = new SessionPgRepository(app);

    await limparFixtures();
    await criarFixtures();
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

    await admin.query(`UPDATE users SET ativo = false WHERE id = $1`, [
      USER_ID,
    ]);
    try {
      expect(await sessionRepo.buscarPorTokenHash(hash)).toBeNull();
    } finally {
      await admin.query(`UPDATE users SET ativo = true WHERE id = $1`, [
        USER_ID,
      ]);
    }

    // Reativado, o mesmo token volta a valer: o null veio do filtro de usuário ativo
    expect(await sessionRepo.buscarPorTokenHash(hash)).not.toBeNull();
  });

  // ── Revogação ─────────────────────────────────────────────────────────────

  it("revogar é idempotente e não sobrescreve revogada_em", async () => {
    const { hash } = await criarSessaoAtiva();
    const s = await sessionRepo.buscarPorTokenHash(hash);

    await sessionRepo.revogar(s!.id);
    const primeira = await lerRevogacao(s!.id);

    await new Promise((resolve) => setTimeout(resolve, 25));
    await sessionRepo.revogar(s!.id);
    const segunda = await lerRevogacao(s!.id);

    expect(primeira.status).toBe("revogada");
    expect(primeira.revogada_em).not.toBeNull();
    expect(new Date(segunda.revogada_em!).getTime()).toBe(
      new Date(primeira.revogada_em!).getTime(),
    );
  });

  it("revogarTodas revoga sessões ativas e pendente_2fa, preenchendo revogada_em", async () => {
    await criarSessaoAtiva();
    await criarSessaoAtiva();
    await inserirSessaoDireta("pendente_2fa", MINUTOS_POR_HORA);

    await sessionRepo.revogarTodas(USER_ID);

    const rows: LinhaRevogacao[] = await admin.query(
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
    const velha = await inserirSessaoDireta("ativa", -30 * MINUTOS_POR_DIA);
    const recente = await inserirSessaoDireta("ativa", -3 * MINUTOS_POR_DIA);
    const ativa = await inserirSessaoDireta("ativa", MINUTOS_POR_HORA);

    const [{ n }]: LinhaContagem[] = await admin.query(
      `SELECT count(*)::int AS n FROM sessions
       WHERE expira_em < now() - make_interval(days => $1::int)`,
      [RETENCAO_DIAS],
    );

    const total = await sessionRepo.limparExpiradas(RETENCAO_DIAS);

    expect(total).toBe(n);
    const restantes: LinhaHash[] = await admin.query(
      `SELECT token_hash::text AS token_hash FROM sessions
       WHERE token_hash::text = ANY($1::text[])`,
      [[velha, recente, ativa]],
    );
    expect(restantes.map((r) => r.token_hash.trim()).sort()).toEqual(
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
    const rows: LinhaFuncao[] = await admin.query(
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

    expect(rows.map((r) => r.proname).sort()).toEqual(
      [...FUNCOES_SESSAO].sort(),
    );
    for (const { proname, tem_acl, publico, app: executaApp } of rows) {
      expect({ fn: proname, tem_acl, publico, app: executaApp }).toEqual({
        fn: proname,
        tem_acl: true,
        publico: false,
        app: true,
      });
    }
  });
});
