import { DataSource, QueryRunner } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { adminDatabaseUrl, appDatabaseUrl } from '../test-db';

/**
 * #43 — Teste obrigatório de RLS (ADR-030, camada B).
 *
 * Prova, contra PostgreSQL real e conectando como farmaubs_app (role de
 * runtime, SEM bypass de RLS), que as políticas da #38 isolam os
 * municípios: fail-closed sem GUC, bloqueio cross-tenant de leitura e
 * escrita, escrita no próprio tenant e bypass pré-autenticação (#38).
 *
 * Seed (como farmaubs_admin — superuser bypassa RLS mesmo com FORCE):
 *   1 perfil (FARMACEUTICO), 2 municípios (A/B), 1 usuário por município.
 */

const MUNICIPIO_A = '11111111-1111-4111-8111-111111111111';
const MUNICIPIO_B = '22222222-2222-4222-8222-222222222222';
const USER_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const USER_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const PERFIL_ID = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
const EMAIL_A = 'farmaubs.alpha@example.test';
const EMAIL_B = 'farmaubs.beta@example.test';

const GUC_TENANT = 'app.municipio_id';

describe('RLS — isolamento de tenant (conexão como farmaubs_app)', () => {
  let admin: DataSource;
  let app: DataSource;

  async function withGuc(
    municipioId: string | null,
    run: (qr: QueryRunner) => Promise<void>,
  ): Promise<void> {
    const qr = app.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.query('SELECT set_config($1, $2, true)', [
        GUC_TENANT,
        municipioId ?? '',
      ]);
      await run(qr);
      await qr.commitTransaction();
    } catch (error) {
      await qr.rollbackTransaction().catch(() => undefined);
      throw error;
    } finally {
      await qr.release();
    }
  }

  async function countUsers(
    qr: QueryRunner,
    where = '',
    params: unknown[] = [],
  ): Promise<number> {
    const rows = await qr.query(
      `SELECT count(*)::int AS total FROM users ${where}`,
      params,
    );
    return rows[0].total;
  }

  beforeAll(async () => {
    admin = new DataSource({ type: 'postgres', url: adminDatabaseUrl() });
    app = new DataSource({ type: 'postgres', url: appDatabaseUrl() });
    await admin.initialize();
    await app.initialize();

    // Seed idempotente: remove tudo que este teste cria (emails fixos + gamas órfãos)
    await admin.query(`DELETE FROM users WHERE email LIKE '%@example.test'`);

    await admin.query(
      `INSERT INTO perfis (id, codigo, nome) VALUES ($1, 'FARMACEUTICO', 'Farmacêutico') ON CONFLICT (id) DO NOTHING`,
      [PERFIL_ID],
    );
    await admin.query(
      `INSERT INTO municipios (id, nome, uf) VALUES ($1, 'Município Alpha', 'PI') ON CONFLICT (id) DO NOTHING`,
      [MUNICIPIO_A],
    );
    await admin.query(
      `INSERT INTO municipios (id, nome, uf) VALUES ($1, 'Município Beta', 'PI') ON CONFLICT (id) DO NOTHING`,
      [MUNICIPIO_B],
    );
    await admin.query(
      `INSERT INTO users (id, nome_completo, email, senha_hash, perfil_id, municipio_id)
       VALUES ($1, 'Farmacêutico Alpha', $2, 'hash-dummy', $3, $4),
              ($5, 'Farmacêutico Beta', $6, 'hash-dummy', $3, $7)`,
      [
        USER_A_ID,
        EMAIL_A,
        PERFIL_ID,
        MUNICIPIO_A,
        USER_B_ID,
        EMAIL_B,
        MUNICIPIO_B,
      ],
    );
  });

  afterAll(async () => {
    await admin?.destroy();
    await app?.destroy();
  });

  it('pré-condição: RLS ativo e FORCE em users', async () => {
    const rows = await admin.query(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = 'public.users'::regclass`,
    );
    expect(rows[0].relrowsecurity).toBe(true);
    expect(rows[0].relforcerowsecurity).toBe(true);
  });

  it('fail-closed: sem GUC, nenhuma linha é visível', async () => {
    await withGuc(null, async (qr) => {
      await expect(countUsers(qr)).resolves.toBe(0);
    });
  });

  it('fail-closed: INSERT sem GUC viola a política (WITH CHECK)', async () => {
    await withGuc(null, async (qr) => {
      await expect(
        qr.query(
          `INSERT INTO users (id, nome_completo, email, senha_hash, perfil_id, municipio_id)
           VALUES ($1, 'Intruso', $2, 'hash', $3, $4)`,
          [
            randomUUID(),
            `intruso-${Date.now()}@example.test`,
            PERFIL_ID,
            MUNICIPIO_A,
          ],
        ),
      ).rejects.toThrow(/row.?level security policy/);
    });
  });

  it('tenant A enxerga somente os próprios dados', async () => {
    await withGuc(MUNICIPIO_A, async (qr) => {
      expect(await countUsers(qr)).toBe(1);
      expect(await countUsers(qr, 'WHERE id = $1', [USER_B_ID])).toBe(0);
    });
  });

  it('bloqueio cross-tenant de leitura (USING)', async () => {
    await withGuc(MUNICIPIO_A, async (qr) => {
      expect(
        await countUsers(qr, 'WHERE municipio_id = $1', [MUNICIPIO_B]),
      ).toBe(0);
    });
  });

  it('bloqueio cross-tenant de UPDATE: linha de A intacta sob GUC de B', async () => {
    await withGuc(MUNICIPIO_B, async (qr) => {
      await qr.query(
        `UPDATE users SET nome_completo = 'invadido' WHERE id = $1`,
        [USER_A_ID],
      );
    });

    // Ground truth pela conexão admin (bypassa RLS): linha intacta e inalterada
    const rows = await admin.query(
      `SELECT nome_completo FROM users WHERE id = $1`,
      [USER_A_ID],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].nome_completo).toBe('Farmacêutico Alpha');
  });

  it('bloqueio cross-tenant de DELETE: linha de A permanece sob GUC de B', async () => {
    await withGuc(MUNICIPIO_B, async (qr) => {
      await qr.query(`DELETE FROM users WHERE id = $1`, [USER_A_ID]);
    });

    // Ground truth pela conexão admin (bypassa RLS): linha ainda existe
    const rows = await admin.query(`SELECT id FROM users WHERE id = $1`, [
      USER_A_ID,
    ]);
    expect(rows).toHaveLength(1);
  });

  it('escrita no próprio tenant funciona (INSERT + DELETE com GUC correto)', async () => {
    const gammaId = randomUUID();
    const gammaEmail = `gamma-${Date.now()}@example.test`;
    await withGuc(MUNICIPIO_A, async (qr) => {
      await qr.query(
        `INSERT INTO users (id, nome_completo, email, senha_hash, perfil_id, municipio_id)
         VALUES ($1, 'Gama', $2, 'hash', $3, $4)`,
        [gammaId, gammaEmail, PERFIL_ID, MUNICIPIO_A],
      );
      expect(await countUsers(qr)).toBe(2);
      await qr.query(`DELETE FROM users WHERE id = $1`, [gammaId]);
      expect(await countUsers(qr)).toBe(1);
    });
  });

  it('GUC com escopo local: não vaza entre transações', async () => {
    await withGuc(MUNICIPIO_A, async (qr) => {
      expect(await countUsers(qr)).toBe(1);
    });
    await withGuc(null, async (qr) => {
      expect(await countUsers(qr)).toBe(0);
    });
  });

  it('bypass pré-autenticação: função SECURITY DEFINER lê usuário de outro tenant', async () => {
    await withGuc(MUNICIPIO_B, async (qr) => {
      const rows = await qr.query(
        `SELECT * FROM auth_buscar_usuario_por_email($1)`,
        [EMAIL_A],
      );
      expect(JSON.stringify(rows)).toContain(EMAIL_A);
    });
  });

  it('auth_registrar_falha_login executa como farmaubs_app fora do escopo', async () => {
    await withGuc(MUNICIPIO_B, async (qr) => {
      await expect(
        qr.query(`SELECT auth_registrar_falha_login($1)`, [USER_A_ID]),
      ).resolves.toBeDefined();
    });
  });
});
