import { DataSource, QueryRunner } from "typeorm";
import { randomUUID } from "node:crypto";
import { adminDatabaseUrl, appDatabaseUrl } from "../test-db";
import { TypeOrmUserRepository } from "../../src/modules/acesso/infrastructure/adapters/typeorm-user.repository";
import { TypeOrmAuditRepository } from "../../src/modules/acesso/infrastructure/adapters/typeorm-audit.repository";
import { TransactionContext } from "../../src/common/transaction/transaction-context.service";
import { User } from "../../src/modules/administracao/infrastructure/persistence/entities/user.entity";
import { UserUnit } from "../../src/modules/administracao/infrastructure/persistence/entities/UserUnit.entity";
import { PerfilEntity } from "../../src/modules/acesso/infrastructure/persistence/entities/perfil.entity";
import { UnidadeSaudeEntity } from "../../src/modules/administracao/infrastructure/persistence/entities/unidade-saude.entity";
import { MunicipioEntity } from "../../src/modules/administracao/infrastructure/persistence/entities/municipio.entity";
import { AuditLogEntity } from "../../src/modules/acesso/infrastructure/persistence/entities/audit-log.entity";

/**
 * Camada B — Testes de integração de Gestão de Usuários no PostgreSQL Real (ADR-030).
 *
 * Valida sincronização atômica de associações em user_units, preservação de
 * integridade referencial/constraints UNIQUE e rollback transacional caso a
 * auditoria falhe.
 */

const MUNICIPIO_ID = "11111111-2222-4333-8444-555555555555";
const PERFIL_ADMIN_ID = "22222222-3333-4444-8555-666666666666";
const PERFIL_FARM_ID = "33333333-4444-4555-8666-777777777777";

const UBS_1_ID = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaa1";
const UBS_2_ID = "aaaaaaaa-2222-4222-8222-aaaaaaaaaaa2";
const UBS_3_ID = "aaaaaaaa-3333-4333-8333-aaaaaaaaaaa3";
const UBS_4_ID = "aaaaaaaa-4444-4444-8444-aaaaaaaaaaa4";
const UBS_5_ID = "aaaaaaaa-5555-4555-8555-aaaaaaaaaaa5";

const USER_ID = "99999999-8888-4777-8666-555555555555";
const USER_EMAIL = "gestao.integracao@farmaubs.test";

const ADMIN_USER_ID = "88888888-7777-4666-8555-444444444444";
const ADMIN_EMAIL = "admin.gestao@farmaubs.test";

describe("Gestão de Usuários e Auditoria no PostgreSQL Real (Camada B, ADR-030)", () => {
  let admin: DataSource;
  let app: DataSource;
  let transactionContext: TransactionContext;
  let userRepository: TypeOrmUserRepository;
  let auditRepository: TypeOrmAuditRepository;

  beforeAll(async () => {
    admin = new DataSource({
      type: "postgres",
      url: adminDatabaseUrl(),
    });

    app = new DataSource({
      type: "postgres",
      url: appDatabaseUrl(),
      entities: [
        User,
        UserUnit,
        PerfilEntity,
        UnidadeSaudeEntity,
        MunicipioEntity,
        AuditLogEntity,
      ],
    });

    await admin.initialize();
    await app.initialize();

    // Limpeza idempotente prévia
    await admin.query(`DELETE FROM audit_logs WHERE usuario_alvo_id = $1`, [
      USER_ID,
    ]);
    await admin.query(`DELETE FROM user_units WHERE usuario_id = $1`, [
      USER_ID,
    ]);
    await admin.query(`DELETE FROM users WHERE id IN ($1, $2)`, [
      USER_ID,
      ADMIN_USER_ID,
    ]);
    await admin.query(
      `DELETE FROM unidades_saude WHERE id IN ($1, $2, $3, $4, $5)`,
      [UBS_1_ID, UBS_2_ID, UBS_3_ID, UBS_4_ID, UBS_5_ID],
    );

    // Seed dos dados base
    await admin.query(
      `INSERT INTO municipios (id, nome, uf) VALUES ($1, 'Município Gestão Test', 'PI') ON CONFLICT (id) DO NOTHING`,
      [MUNICIPIO_ID],
    );

    await admin.query(
      `INSERT INTO perfis (id, codigo, nome) VALUES ($1, 'ADMIN_GESTAO', 'Admin Gestão') ON CONFLICT (id) DO NOTHING`,
      [PERFIL_ADMIN_ID],
    );
    await admin.query(
      `INSERT INTO perfis (id, codigo, nome) VALUES ($1, 'FARM_GESTAO', 'Farmacêutico Gestão') ON CONFLICT (id) DO NOTHING`,
      [PERFIL_FARM_ID],
    );

    for (const [id, nome] of [
      [UBS_1_ID, "UBS Gestão 1"],
      [UBS_2_ID, "UBS Gestão 2"],
      [UBS_3_ID, "UBS Gestão 3"],
      [UBS_4_ID, "UBS Gestão 4"],
      [UBS_5_ID, "UBS Gestão 5"],
    ]) {
      await admin.query(
        `INSERT INTO unidades_saude (id, municipio_id, nome) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
        [id, MUNICIPIO_ID, nome],
      );
    }

    // Criação dos usuários
    await admin.query(
      `INSERT INTO users (id, nome_completo, email, senha_hash, perfil_id, municipio_id, ativo)
       VALUES ($1, 'Admin Executor', $2, 'fake_hash', $3, $4, true)`,
      [ADMIN_USER_ID, ADMIN_EMAIL, PERFIL_ADMIN_ID, MUNICIPIO_ID],
    );

    await admin.query(
      `INSERT INTO users (id, nome_completo, email, senha_hash, perfil_id, municipio_id, ativo)
       VALUES ($1, 'Usuário Alvo', $2, 'fake_hash', $3, $4, true)`,
      [USER_ID, USER_EMAIL, PERFIL_FARM_ID, MUNICIPIO_ID],
    );

    transactionContext = new TransactionContext(app);
    userRepository = new TypeOrmUserRepository(transactionContext);
    auditRepository = new TypeOrmAuditRepository(transactionContext);
  });

  afterAll(async () => {
    if (admin?.isInitialized) {
      await admin.query(`DELETE FROM audit_logs WHERE usuario_alvo_id = $1`, [
        USER_ID,
      ]);
      await admin.query(`DELETE FROM user_units WHERE usuario_id = $1`, [
        USER_ID,
      ]);
      await admin.query(`DELETE FROM users WHERE id IN ($1, $2)`, [
        USER_ID,
        ADMIN_USER_ID,
      ]);
      await admin.query(
        `DELETE FROM unidades_saude WHERE id IN ($1, $2, $3, $4, $5)`,
        [UBS_1_ID, UBS_2_ID, UBS_3_ID, UBS_4_ID, UBS_5_ID],
      );
      await admin.destroy();
    }
    if (app?.isInitialized) {
      await app.destroy();
    }
  });

  async function executarComTransacao<T>(
    municipioId: string,
    operacao: () => Promise<T>,
  ): Promise<T> {
    const qr: QueryRunner = app.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.query(`SELECT set_config('app.municipio_id', $1, true)`, [
        municipioId,
      ]);
      const resultado = await transactionContext.run(qr, operacao);
      await qr.commitTransaction();
      return resultado;
    } catch (error) {
      await qr.rollbackTransaction().catch(() => undefined);
      throw error;
    } finally {
      await qr.release();
    }
  }

  it("Cenário: Sincronização atômica de user_units sem violar constraints", async () => {
    // Dado um usuário com 2 UBSs cadastradas na tabela user_units
    await admin.query(
      `INSERT INTO user_units (id, usuario_id, unidade_id, ativo) VALUES ($1, $2, $3, true)`,
      [randomUUID(), USER_ID, UBS_1_ID],
    );
    await admin.query(
      `INSERT INTO user_units (id, usuario_id, unidade_id, ativo) VALUES ($1, $2, $3, true)`,
      [randomUUID(), USER_ID, UBS_2_ID],
    );

    const vinculosIniciais = await admin.query<{ unidade_id: string }[]>(
      `SELECT unidade_id FROM user_units WHERE usuario_id = $1 ORDER BY unidade_id`,
      [USER_ID],
    );
    expect(vinculosIniciais.map((v) => v.unidade_id)).toEqual([
      UBS_1_ID,
      UBS_2_ID,
    ]);

    // Quando o repositório executar a sincronização para uma lista de 3 novas UBSs
    const novasUbs = [UBS_3_ID, UBS_4_ID, UBS_5_ID];
    await executarComTransacao(MUNICIPIO_ID, async () => {
      await userRepository.atualizarPerfilEUbs(
        USER_ID,
        PERFIL_FARM_ID,
        novasUbs,
      );
    });

    // Então as 2 associações anteriores devem ser deletadas
    const associacoesAntigas = await admin.query(
      `SELECT * FROM user_units WHERE usuario_id = $1 AND unidade_id IN ($2, $3)`,
      [USER_ID, UBS_1_ID, UBS_2_ID],
    );
    expect(associacoesAntigas).toHaveLength(0);

    // E as 3 novas associações devem ser persistidas
    const associacoesNovas = await admin.query<{ unidade_id: string }[]>(
      `SELECT unidade_id FROM user_units WHERE usuario_id = $1 ORDER BY unidade_id`,
      [USER_ID],
    );
    expect(associacoesNovas.map((v) => v.unidade_id)).toEqual(
      [UBS_3_ID, UBS_4_ID, UBS_5_ID].sort(),
    );

    // E a constraint UNIQUE (usuario_id, unidade_id) deve permanecer íntegra
    let erroConstraint: any = null;
    try {
      await admin.query(
        `INSERT INTO user_units (id, usuario_id, unidade_id, ativo) VALUES ($1, $2, $3, true)`,
        [randomUUID(), USER_ID, UBS_3_ID],
      );
    } catch (err) {
      erroConstraint = err;
    }
    expect(erroConstraint).not.toBeNull();
    // 23505 = unique_violation no PostgreSQL
    expect(erroConstraint.code).toBe("23505");
  });

  it("Cenário: Rollback transacional se a gravação da auditoria falhar", async () => {
    // Dado uma alteração de status solicitada pelo Administrador
    // Estado inicial: usuário está ATIVO (ativo = true)
    const estadoInicial = await admin.query<{ ativo: boolean }[]>(
      `SELECT ativo FROM users WHERE id = $1`,
      [USER_ID],
    );
    expect(estadoInicial[0].ativo).toBe(true);

    const qr = app.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    let erroLancado: Error | null = null;
    try {
      await qr.query(`SELECT set_config('app.municipio_id', $1, true)`, [
        MUNICIPIO_ID,
      ]);

      await transactionContext.run(qr, async () => {
        // 1. Repositório atualiza o status do usuário para inativo no banco
        await userRepository.atualizarStatus(USER_ID, false);

        // 2. Repositório de auditoria falha ao persistir o log (simulando exceção ou falha de sistema)
        throw new Error("Falha forçada na persistência do log de auditoria");
      });

      await qr.commitTransaction();
    } catch (err: any) {
      erroLancado = err;
      // Quando o repositório de auditoria falhar, a transação deve sofrer rollback
      await qr.rollbackTransaction().catch(() => undefined);
    } finally {
      await qr.release();
    }

    // Então toda a transação do banco deve sofrer rollback
    expect(erroLancado).not.toBeNull();
    expect(erroLancado?.message).toBe(
      "Falha forçada na persistência do log de auditoria",
    );

    // E o status do usuário deve permanecer inalterado (ground truth no banco real)
    const estadoAposRollback = await admin.query<{ ativo: boolean }[]>(
      `SELECT ativo FROM users WHERE id = $1`,
      [USER_ID],
    );
    expect(estadoAposRollback[0].ativo).toBe(true);

    // E nenhum log de auditoria deve ter sido gravado
    const logsAuditoria = await admin.query(
      `SELECT * FROM audit_logs WHERE usuario_alvo_id = $1`,
      [USER_ID],
    );
    expect(logsAuditoria).toHaveLength(0);
  });
});
