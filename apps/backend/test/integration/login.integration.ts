import * as crypto from "crypto";
import * as bcrypt from "bcrypt";
import { DataSource } from "typeorm";
import { adminDatabaseUrl, appDatabaseUrl } from "../test-db";
import { AcessoPgRepository } from "../../src/modules/acesso/infrastructure/adapters/acesso-pg.repository";

const MUNICIPIO_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PERFIL_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const EMAIL = "acesso.integration@farmaubs.test";
const SENHA = "Teste@123456";

describe("AcessoPgRepository — integração (camada B)", () => {
  let admin: DataSource;
  let app: DataSource;
  let repo: AcessoPgRepository;

  beforeAll(async () => {
    admin = new DataSource({ type: "postgres", url: adminDatabaseUrl() });
    app = new DataSource({ type: "postgres", url: appDatabaseUrl() });
    await admin.initialize();
    await app.initialize();

    repo = new AcessoPgRepository(app);

    const senhaHash = await bcrypt.hash(SENHA, 4);

    await admin.query(`DELETE FROM sessions WHERE usuario_id = $1`, [USER_ID]);
    await admin.query(`DELETE FROM users    WHERE id = $1`, [USER_ID]);

    await admin.query(
      `INSERT INTO perfis (id, codigo, nome)
       VALUES ($1, 'FARMACEUTICO_TEST', 'Farmacêutico Test')
       ON CONFLICT (id) DO NOTHING`,
      [PERFIL_ID],
    );
    await admin.query(
      `INSERT INTO municipios (id, nome, uf)
       VALUES ($1, 'Município Test', 'PI')
       ON CONFLICT (id) DO NOTHING`,
      [MUNICIPIO_ID],
    );
    await admin.query(
      `INSERT INTO users
         (id, nome_completo, email, senha_hash, perfil_id, municipio_id,
          tentativas_login_falhas, bloqueado_ate)
       VALUES ($1, 'Usuário Integração', $2, $3, $4, $5, 0, NULL)`,
      [USER_ID, EMAIL, senhaHash, PERFIL_ID, MUNICIPIO_ID],
    );
  });

  afterAll(async () => {
    await admin.query(`DELETE FROM sessions WHERE usuario_id = $1`, [USER_ID]);
    await admin.query(`DELETE FROM users    WHERE id = $1`, [USER_ID]);
    await admin?.destroy();
    await app?.destroy();
  });

  it("buscarUsuarioPorEmail retorna o usuário pelo e-mail normalizado", async () => {
    const usuario = await repo.buscarUsuarioPorEmail(EMAIL);
    expect(usuario).not.toBeNull();
    expect(usuario!.id).toBe(USER_ID);
    expect(usuario!.senhaHash).toBeTruthy();
  });

  it("buscarUsuarioPorEmail retorna null para e-mail inexistente", async () => {
    const usuario = await repo.buscarUsuarioPorEmail(
      "nao.existe@farmaubs.test",
    );
    expect(usuario).toBeNull();
  });

  it("buscarUsuarioPorEmail é case-insensitive", async () => {
    const usuario = await repo.buscarUsuarioPorEmail(EMAIL.toUpperCase());
    expect(usuario).not.toBeNull();
    expect(usuario!.id).toBe(USER_ID);
  });

  it("registrarFalhaLogin incrementa tentativas_login_falhas", async () => {
    await repo.registrarFalhaLogin(USER_ID);

    const rows = await admin.query(
      `SELECT tentativas_login_falhas FROM users WHERE id = $1`,
      [USER_ID],
    );
    expect(rows[0].tentativas_login_falhas).toBe(1);
  });

  it("registrarFalhaLogin bloqueia a conta ao atingir 5 tentativas", async () => {
    for (let i = 0; i < 4; i++) {
      await repo.registrarFalhaLogin(USER_ID);
    }

    const rows = await admin.query(
      `SELECT tentativas_login_falhas, bloqueado_ate FROM users WHERE id = $1`,
      [USER_ID],
    );
    expect(rows[0].tentativas_login_falhas).toBe(5);
    expect(rows[0].bloqueado_ate).not.toBeNull();
  });

  it("resetarEstadoLogin zera tentativas e limpa bloqueado_ate", async () => {
    await repo.resetarEstadoLogin(USER_ID);

    const rows = await admin.query(
      `SELECT tentativas_login_falhas, bloqueado_ate FROM users WHERE id = $1`,
      [USER_ID],
    );
    expect(rows[0].tentativas_login_falhas).toBe(0);
    expect(rows[0].bloqueado_ate).toBeNull();
  });

  it("criarSessao retorna token plain e persiste apenas o hash", async () => {
    const expiraEm = new Date(Date.now() + 60 * 60_000);
    const tokenPlain = await repo.criarSessao({ usuarioId: USER_ID, expiraEm });

    expect(tokenPlain).toHaveLength(64);

    const tokenHash = crypto
      .createHash("sha256")
      .update(tokenPlain)
      .digest("hex");

    const rows = await admin.query(
      `SELECT token_hash, status FROM sessions WHERE usuario_id = $1 ORDER BY criado_em DESC LIMIT 1`,
      [USER_ID],
    );
    expect(rows[0].token_hash.trim()).toBe(tokenHash);
    expect(rows[0].status).toBe("ativa");
  });

  it("criarSessao gera token_hash único a cada chamada", async () => {
    const expiraEm = new Date(Date.now() + 60 * 60_000);
    const token1 = await repo.criarSessao({ usuarioId: USER_ID, expiraEm });
    const token2 = await repo.criarSessao({ usuarioId: USER_ID, expiraEm });

    expect(token1).not.toBe(token2);
  });

  it("sessão expirada não é retornada pela função do banco", async () => {
    const expiraEm = new Date(Date.now() - 1000);
    const tokenPlain = await repo.criarSessao({ usuarioId: USER_ID, expiraEm });
    const tokenHash = crypto
      .createHash("sha256")
      .update(tokenPlain)
      .digest("hex");

    const rows = await admin.query(
      `SELECT * FROM acesso_buscar_sessao_por_token($1)`,
      [tokenHash],
    );
    expect(rows).toHaveLength(0);
  });
});
