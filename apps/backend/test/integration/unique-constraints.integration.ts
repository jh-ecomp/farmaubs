import { DataSource, QueryRunner } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { adminDatabaseUrl, appDatabaseUrl } from '../test-db';

/**
 * #51 — Teste de integração de constraints únicas (AC-03, ADR-030 camada B).
 *
 * Prova, contra PostgreSQL real e conectando como farmaubs_app (role de
 * runtime, sob RLS FORCE com GUC do tenant), que o banco rejeita, por
 * constraint, cadastros duplicados que a camada de aplicação poderia
 * deixar passar:
 *
 *   1. users.email — índice funcional UNIQUE em lower(email): variação de
 *      caixa (EMAIL@x.com vs email@x.com) é rejeitada (RF001).
 *   2. user_units — UNIQUE (usuario_id, unidade_id): associação repetida
 *      do mesmo usuário à mesma UBS é rejeitada (RF001).
 *
 * As asserções rodam como farmaubs_app DENTRO do tenant correto, de modo
 * que o erro esperado é unique violation (23505) — se a policy de RLS
 * bloqueasse o INSERT, o erro seria outro e o teste falharia.
 * Ground truth após cada rejeição: conexão admin (superuser bypassa RLS).
 *
 * Seed idempotente (como farmaubs_admin): 1 municipio, 1 perfil, 1 UBS,
 * 1 usuário e 1 vínculo usuário-UBS — tudo em ids e domínio de e-mail
 * próprios, sem interferir no spec #43 (rls-tenant-isolation).
 */

const MUNICIPIO_C = '33333333-3333-4333-8333-333333333333';
const PERFIL_ID = '44444444-4444-4444-8444-444444444444';
const UNIDADE_C1 = '55555555-5555-4555-8555-555555555555';
const USER_C1_ID = '66666666-6666-4666-8666-666666666666';
const EMAIL_C1 = 'farmaubs.constraints@constraints.test';

const GUC_TENANT = 'app.municipio_id';

describe('Constraints de integridade — unicidade no banco real', () => {
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

  beforeAll(async () => {
    admin = new DataSource({ type: 'postgres', url: adminDatabaseUrl() });
    app = new DataSource({ type: 'postgres', url: appDatabaseUrl() });
    await admin.initialize();
    await app.initialize();

    // Limpeza idempotente: remove resíduos de execuções anteriores.
    // DELETE em users cascateia para user_units (FK ON DELETE CASCADE);
    // só depois a UBS (FK RESTRICT) pode ser removida.
    await admin.query(
      `DELETE FROM users WHERE email LIKE '%@constraints.test'`,
    );
    await admin.query(`DELETE FROM unidades_saude WHERE id = $1`, [UNIDADE_C1]);

    // Seed — municipio e perfil persistem entre execuções (ON CONFLICT);
    // os demais são recriados após a limpeza acima.
    await admin.query(
      `INSERT INTO municipios (id, nome, uf) VALUES ($1, 'Município Constraints', 'PI') ON CONFLICT (id) DO NOTHING`,
      [MUNICIPIO_C],
    );
    await admin.query(
      `INSERT INTO perfis (id, codigo, nome) VALUES ($1, 'FARMACEUTICO_TESTE', 'Farmacêutico de Teste') ON CONFLICT (id) DO NOTHING`,
      [PERFIL_ID],
    );
    await admin.query(
      `INSERT INTO unidades_saude (id, municipio_id, nome) VALUES ($1, $2, 'UBS Teste Constraints')`,
      [UNIDADE_C1, MUNICIPIO_C],
    );
    await admin.query(
      `INSERT INTO users (id, municipio_id, nome_completo, email, senha_hash, perfil_id)
       VALUES ($1, $2, 'Usuário Constraints', $3, 'hash-dummy', $4)`,
      [USER_C1_ID, MUNICIPIO_C, EMAIL_C1, PERFIL_ID],
    );
    await admin.query(
      `INSERT INTO user_units (id, usuario_id, unidade_id) VALUES ($1, $2, $3)`,
      [randomUUID(), USER_C1_ID, UNIDADE_C1],
    );
  });

  afterAll(async () => {
    await admin?.destroy();
    await app?.destroy();
  });

  it('pré-condição: índices únicos esperados existem no schema', async () => {
    const emailIndex = await admin.query(
      `SELECT indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'users'
         AND indexname = 'idx_users_email_lower'`,
    );
    expect(emailIndex).toHaveLength(1);
    expect(emailIndex[0].indexdef).toContain('UNIQUE');

    const unitsIndex = await admin.query(
      `SELECT indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'user_units'
         AND indexname = 'uq_user_units_usuario_unidade'`,
    );
    expect(unitsIndex).toHaveLength(1);
    expect(unitsIndex[0].indexdef).toContain('UNIQUE');
  });

  it('e-mail duplicado com variação de caixa é rejeitado (23505)', async () => {
    await withGuc(MUNICIPIO_C, async (qr) => {
      await expect(
        qr.query(
          `INSERT INTO users (id, municipio_id, nome_completo, email, senha_hash, perfil_id)
           VALUES ($1, $2, 'Duplicado', $3, 'hash', $4)`,
          [randomUUID(), MUNICIPIO_C, EMAIL_C1.toUpperCase(), PERFIL_ID],
        ),
      ).rejects.toThrow(/duplicate key value violates unique constraint/);
    });

    // Ground truth via admin: a linha original permanece única.
    const rows = await admin.query(
      `SELECT count(*)::int AS total FROM users WHERE lower(email) = lower($1)`,
      [EMAIL_C1],
    );
    expect(rows[0].total).toBe(1);
  });

  it('associação usuário/UBS duplicada é rejeitada (23505)', async () => {
    await withGuc(MUNICIPIO_C, async (qr) => {
      await expect(
        qr.query(
          `INSERT INTO user_units (id, usuario_id, unidade_id) VALUES ($1, $2, $3)`,
          [randomUUID(), USER_C1_ID, UNIDADE_C1],
        ),
      ).rejects.toThrow(/duplicate key value violates unique constraint/);
    });

    // Ground truth via admin: o vínculo original permanece único.
    const rows = await admin.query(
      `SELECT count(*)::int AS total FROM user_units WHERE usuario_id = $1 AND unidade_id = $2`,
      [USER_C1_ID, UNIDADE_C1],
    );
    expect(rows[0].total).toBe(1);
  });
});
