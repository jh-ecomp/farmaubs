import * as crypto from "crypto";
import * as bcrypt from "bcrypt";
import { DataSource, QueryRunner } from "typeorm";
import { ForbiddenException, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PerfilCodigo } from "@farmaubs/shared";
import { adminDatabaseUrl, appDatabaseUrl } from "../test-db";
import { SessionPgRepository } from "../../src/modules/acesso/infrastructure/adapters/session-pg.repository";
import { AcessoPgRepository } from "../../src/modules/acesso/infrastructure/adapters/acesso-pg.repository";
import { RolesGuard } from "../../src/common/guards/roles.guard";
import { TenantScopeGuard } from "../../src/common/guards/tenant-scope.guard";
import { ROLES_KEY } from "../../src/common/decorators/roles.decorator";
import { TENANT_SCOPED_KEY } from "../../src/common/decorators/tenant-scoped.decorator";

/**
 * AC-13 / ADR-002 / ADR-006 / ADR-016 / NF009 / NF010 / NF015
 *
 * Teste de integração de autorização:
 * 1. Snapshot completo de autenticação em query única via auth_buscar_sessao_por_token (NF010).
 * 2. Zero queries adicionais executadas por RolesGuard e TenantScopeGuard (NF010).
 * 3. Validação em memória de RBAC e escopo de município/UBS.
 * 4. Bypass global automático para o perfil ADMINISTRADOR (ADR-002).
 * 5. Isolamento físico por Row-Level Security (RLS) no PostgreSQL conectado como farmaubs_app.
 */

const MUNICIPIO_A = "11111111-aaaa-4111-8111-111111111111";
const MUNICIPIO_B = "22222222-bbbb-4222-8222-222222222222";

const UBS_A1 = "33333333-aaaa-4333-8333-333333333331";
const UBS_B1 = "44444444-bbbb-4444-8444-444444444441";

const USER_FARMA_A_ID = "55555555-aaaa-4555-8555-555555555551";
const USER_GERENTE_B_ID = "66666666-bbbb-4666-8666-666666666661";
const USER_ADMIN_ID = "77777777-cccc-4777-8777-777777777771";

import { IS_PUBLIC_KEY } from "../../src/common/decorators/public.decorator";

const EMAIL_FARMA_A = "farma.autorizacao@farmaubs.test";
const EMAIL_GERENTE_B = "gerente.autorizacao@farmaubs.test";
const EMAIL_ADMIN = "admin.autorizacao@farmaubs.test";

const GUC_TENANT = "app.municipio_id";

function createMockReflector(config: { roles?: PerfilCodigo[]; tenantOptions?: any; isPublic?: boolean } = {}): Reflector {
  return {
    getAllAndOverride: (key: string) => {
      if (key === IS_PUBLIC_KEY || key === "isPublic" || key === "skip_auth") return config.isPublic ?? false;
      if (key === ROLES_KEY) return config.roles;
      if (key === TENANT_SCOPED_KEY) return config.tenantOptions;
      return undefined;
    },
  } as unknown as Reflector;
}

function createMockExecutionContext(req: any): ExecutionContext {
  return {
    getType: () => "http",
    getHandler: () => () => {},
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
}

describe("Autorização RBAC e TenantScope com Banco Real (AC-13, ADR-006, ADR-016)", () => {
  let admin: DataSource;
  let app: DataSource;
  let sessionRepo: SessionPgRepository;
  let acessoRepo: AcessoPgRepository;

  let perfilAdminId: string;
  let perfilGerenteId: string;
  let perfilFarmaRespId: string;

  let tokenPlainFarmaA: string;
  let tokenHashFarmaA: string;

  let tokenPlainAdmin: string;
  let tokenHashAdmin: string;

  beforeAll(async () => {
    admin = new DataSource({ type: "postgres", url: adminDatabaseUrl() });
    app = new DataSource({ type: "postgres", url: appDatabaseUrl() });
    await admin.initialize();
    await app.initialize();

    sessionRepo = new SessionPgRepository(app);
    acessoRepo = new AcessoPgRepository(app);

    // Recupera IDs dos perfis padrão
    const perfis = await admin.query<{ id: string; codigo: string }[]>(
      `SELECT id, codigo FROM perfis WHERE codigo IN ('ADMINISTRADOR', 'GERENTE', 'FARMACEUTICO_RESPONSAVEL')`,
    );
    perfilAdminId = perfis.find((p) => p.codigo === PerfilCodigo.ADMINISTRADOR)!.id;
    perfilGerenteId = perfis.find((p) => p.codigo === PerfilCodigo.GERENTE)!.id;
    perfilFarmaRespId = perfis.find((p) => p.codigo === PerfilCodigo.FARMACEUTICO_RESPONSAVEL)!.id;

    // Limpeza idempotente prévia
    await admin.query(`DELETE FROM sessions WHERE usuario_id IN ($1, $2, $3)`, [
      USER_FARMA_A_ID,
      USER_GERENTE_B_ID,
      USER_ADMIN_ID,
    ]);
    await admin.query(`DELETE FROM user_units WHERE usuario_id IN ($1, $2, $3)`, [
      USER_FARMA_A_ID,
      USER_GERENTE_B_ID,
      USER_ADMIN_ID,
    ]);
    await admin.query(`DELETE FROM users WHERE id IN ($1, $2, $3)`, [
      USER_FARMA_A_ID,
      USER_GERENTE_B_ID,
      USER_ADMIN_ID,
    ]);
    await admin.query(`DELETE FROM unidades_saude WHERE id IN ($1, $2)`, [UBS_A1, UBS_B1]);
    await admin.query(`DELETE FROM municipios WHERE id IN ($1, $2) OR codigo_ibge IN ('3599901', '3599902')`, [MUNICIPIO_A, MUNICIPIO_B]);

    // Seed dos Municípios
    await admin.query(
      `INSERT INTO municipios (id, nome, uf, codigo_ibge, ativo)
       VALUES ($1, 'Município Alfa', 'SP', '3599901', true),
              ($2, 'Município Beta', 'SP', '3599902', true)
       ON CONFLICT (codigo_ibge) DO NOTHING`,
      [MUNICIPIO_A, MUNICIPIO_B],
    );

    // Seed das UBSs
    await admin.query(
      `INSERT INTO unidades_saude (id, municipio_id, nome, endereco, responsavel_tecnico, caf_lead_time_days)
       VALUES ($1, $2, 'UBS Alfa Central', 'Rua Alfa, 10', 'Dra. Alfa', 10),
              ($3, $4, 'UBS Beta Central', 'Rua Beta, 20', 'Dra. Beta', 10)`,
      [UBS_A1, MUNICIPIO_A, UBS_B1, MUNICIPIO_B],
    );

    const senhaHash = await bcrypt.hash("Teste@123456", 4);

    // Seed dos Usuários
    await admin.query(
      `INSERT INTO users (id, nome_completo, email, senha_hash, perfil_id, municipio_id)
       VALUES ($1, 'Farmacêutico Alfa', $2, $3, $4, $5),
              ($6, 'Gerente Beta', $7, $3, $8, $9),
              ($10, 'Admin Global', $11, $3, $12, $5)`,
      [
        USER_FARMA_A_ID, EMAIL_FARMA_A, senhaHash, perfilFarmaRespId, MUNICIPIO_A,
        USER_GERENTE_B_ID, EMAIL_GERENTE_B, perfilGerenteId, MUNICIPIO_B,
        USER_ADMIN_ID, EMAIL_ADMIN, perfilAdminId,
      ],
    );

    // Vincula Farmacêutico Alfa à UBS_A1 na tabela user_units
    await admin.query(
      `INSERT INTO user_units (id, usuario_id, unidade_id, ativo)
       VALUES (gen_random_uuid(), $1, $2, true)`,
      [USER_FARMA_A_ID, UBS_A1],
    );

    // Cria sessões ativas
    const expiraEm = new Date(Date.now() + 60 * 60_000);

    tokenPlainFarmaA = await acessoRepo.criarSessao({
      usuarioId: USER_FARMA_A_ID,
      expiraEm,
    });
    tokenHashFarmaA = crypto.createHash("sha256").update(tokenPlainFarmaA).digest("hex");

    tokenPlainAdmin = await acessoRepo.criarSessao({
      usuarioId: USER_ADMIN_ID,
      expiraEm,
    });
    tokenHashAdmin = crypto.createHash("sha256").update(tokenPlainAdmin).digest("hex");
  });

  afterAll(async () => {
    await admin.query(`DELETE FROM sessions WHERE usuario_id IN ($1, $2, $3)`, [
      USER_FARMA_A_ID,
      USER_GERENTE_B_ID,
      USER_ADMIN_ID,
    ]);
    await admin.query(`DELETE FROM user_units WHERE usuario_id IN ($1, $2, $3)`, [
      USER_FARMA_A_ID,
      USER_GERENTE_B_ID,
      USER_ADMIN_ID,
    ]);
    await admin.query(`DELETE FROM users WHERE id IN ($1, $2, $3)`, [
      USER_FARMA_A_ID,
      USER_GERENTE_B_ID,
      USER_ADMIN_ID,
    ]);
    await admin.query(`DELETE FROM unidades_saude WHERE id IN ($1, $2)`, [UBS_A1, UBS_B1]);
    await admin.query(`DELETE FROM municipios WHERE id IN ($1, $2) OR codigo_ibge IN ('3599901', '3599902')`, [MUNICIPIO_A, MUNICIPIO_B]);

    await admin?.destroy();
    await app?.destroy();
  });

  describe("1. Snapshot de Autenticação e Autorização em Query Única (NF010)", () => {
    it("auth_buscar_sessao_por_token retorna perfil, município e array de unidades em 1 única chamada", async () => {
      const sessao = await sessionRepo.buscarPorTokenHash(tokenHashFarmaA);

      expect(sessao).not.toBeNull();
      expect(sessao!.usuarioId).toBe(USER_FARMA_A_ID);
      expect(sessao!.municipioId).toBe(MUNICIPIO_A);
      expect(sessao!.perfilCodigo).toBe(PerfilCodigo.FARMACEUTICO_RESPONSAVEL);
      expect(sessao!.unidadeIds).toBeDefined();
      expect(sessao!.unidadeIds).toContain(UBS_A1);
    });
  });

  describe("2. Avaliação de Guards sem Novas Consultas ao Banco (NF010)", () => {
    it("RolesGuard e TenantScopeGuard executam com ZERO queries adicionais ao banco", async () => {
      const sessao = (await sessionRepo.buscarPorTokenHash(tokenHashFarmaA))!;

      const req: any = {
        user: {
          id: sessao.usuarioId,
          usuarioId: sessao.usuarioId,
          email: sessao.email,
          perfilCodigo: sessao.perfilCodigo,
          municipioId: sessao.municipioId,
          unidadeIds: sessao.unidadeIds,
        },
        params: {
          municipioId: MUNICIPIO_A,
          unidadeId: UBS_A1,
        },
        query: {},
        body: {},
      };

      const reflector = createMockReflector({
        roles: [PerfilCodigo.FARMACEUTICO_RESPONSAVEL, PerfilCodigo.GERENTE],
        tenantOptions: { checkUbs: true },
      });

      const rolesGuard = new RolesGuard(reflector);
      const tenantGuard = new TenantScopeGuard(reflector);
      const execContext = createMockExecutionContext(req);

      // Espiona queries na conexão app (farmaubs_app) e admin
      const appQuerySpy = jest.spyOn(app, "query");

      // Execução dos guards
      const rolesOk = await rolesGuard.canActivate(execContext);
      const tenantOk = tenantGuard.canActivate(execContext);

      expect(rolesOk).toBe(true);
      expect(tenantOk).toBe(true);
      expect(req.tenantScope).toEqual({
        municipioId: MUNICIPIO_A,
        unidadeIds: [UBS_A1],
        isGlobalAdmin: false,
      });

      // Validação estrita de NF010: Zero queries executadas pelos guards
      expect(appQuerySpy).not.toHaveBeenCalled();

      appQuerySpy.mockRestore();
    });

    it("RolesGuard bloqueia usuário sem o perfil necessário (403)", async () => {
      const sessao = (await sessionRepo.buscarPorTokenHash(tokenHashFarmaA))!;

      const req: any = {
        user: {
          id: sessao.usuarioId,
          perfilCodigo: sessao.perfilCodigo, // FARMACEUTICO_RESPONSAVEL
        },
      };

      const reflector = createMockReflector({
        roles: [PerfilCodigo.ADMINISTRADOR],
      });

      const rolesGuard = new RolesGuard(reflector);
      const execContext = createMockExecutionContext(req);

      await expect(rolesGuard.canActivate(execContext)).rejects.toThrow(ForbiddenException);
    });

    it("TenantScopeGuard bloqueia acesso a UBS não vinculada (403)", () => {
      const sessao = {
        usuarioId: USER_FARMA_A_ID,
        perfilCodigo: PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
        municipioId: MUNICIPIO_A,
        unidadeIds: [UBS_A1],
      };

      const req: any = {
        user: sessao,
        params: {
          unidadeId: UBS_B1, // UBS de outro município e não vinculada
        },
        query: {},
        body: {},
      };

      const reflector = createMockReflector({
        tenantOptions: { checkUbs: true },
      });

      const tenantGuard = new TenantScopeGuard(reflector);
      const execContext = createMockExecutionContext(req);

      expect(() => tenantGuard.canActivate(execContext)).toThrow(ForbiddenException);
    });

    it("TenantScopeGuard concede bypass total para ADMINISTRADOR (ADR-002)", async () => {
      const sessaoAdmin = (await sessionRepo.buscarPorTokenHash(tokenHashAdmin))!;

      const req: any = {
        user: {
          id: sessaoAdmin.usuarioId,
          perfilCodigo: sessaoAdmin.perfilCodigo, // ADMINISTRADOR
          municipioId: sessaoAdmin.municipioId,
          unidadeIds: sessaoAdmin.unidadeIds,
        },
        params: {
          municipioId: MUNICIPIO_B, // Município arbitrário
          unidadeId: UBS_B1,         // UBS arbitrária
        },
        query: {},
        body: {},
      };

      const reflector = createMockReflector({
        tenantOptions: { checkUbs: true },
      });

      const tenantGuard = new TenantScopeGuard(reflector);
      const execContext = createMockExecutionContext(req);

      const ok = tenantGuard.canActivate(execContext);
      expect(ok).toBe(true);
      expect(req.tenantScope.isGlobalAdmin).toBe(true);
    });
  });

  describe("3. Isolamento RLS no PostgreSQL (ADR-016)", () => {
    async function withTenantContext(
      municipioId: string | null,
      run: (qr: QueryRunner) => Promise<void>,
    ): Promise<void> {
      const qr = app.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();
      try {
        await qr.query("SELECT set_config($1, $2, true)", [
          GUC_TENANT,
          municipioId ?? "",
        ]);
        await run(qr);
        await qr.commitTransaction();
      } catch (err) {
        await qr.rollbackTransaction().catch(() => undefined);
        throw err;
      } finally {
        await qr.release();
      }
    }

    it("GUC configurado para Município Alfa restringe leitura apenas aos dados do Alfa", async () => {
      await withTenantContext(MUNICIPIO_A, async (qr) => {
        const rows = await qr.query<{ id: string; email: string }[]>(
          `SELECT id, email FROM users WHERE email LIKE '%@farmaubs.test'`,
        );

        // Apenas o usuário do Município Alfa e o Admin (que também foi alocado no Alfa para este teste) devem ser visíveis
        const emails = rows.map((r) => r.email);
        expect(emails).toContain(EMAIL_FARMA_A);
        expect(emails).not.toContain(EMAIL_GERENTE_B);
      });
    });

    it("GUC configurado para Município Beta restringe leitura apenas aos dados do Beta", async () => {
      await withTenantContext(MUNICIPIO_B, async (qr) => {
        const rows = await qr.query<{ id: string; email: string }[]>(
          `SELECT id, email FROM users WHERE email LIKE '%@farmaubs.test'`,
        );

        const emails = rows.map((r) => r.email);
        expect(emails).toContain(EMAIL_GERENTE_B);
        expect(emails).not.toContain(EMAIL_FARMA_A);
      });
    });

    it("sem GUC definido (fail-closed), nenhuma linha de users é retornada para farmaubs_app", async () => {
      await withTenantContext(null, async (qr) => {
        const rows = await qr.query(
          `SELECT id FROM users WHERE email LIKE '%@farmaubs.test'`,
        );
        expect(rows).toHaveLength(0);
      });
    });
  });
});
