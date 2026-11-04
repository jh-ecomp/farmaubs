import { DataSource, QueryRunner } from "typeorm";
import { adminDatabaseUrl, appDatabaseUrl } from "../test-db";
import { TransactionContext } from "../../src/common/transaction/transaction-context.service";
import { EstoqueMetricasPgRepository } from "../../src/modules/estoque/infrastructure/adapters/estoque-metricas-pg.repository";
import { ObterMetricasEstoqueUseCase } from "../../src/modules/estoque/application/use-cases/obter-metricas-estoque.use-case";

/**
 * ES-01 (#242) - Camada C: agregação SQL do repositório de métricas de estoque
 * contra PostgreSQL real, conectando como farmaubs_app (RLS ativo).
 * Datas relativas ao `hoje` injetado (HOJE), nunca ao relógio.
 */

const HOJE = "2026-06-15";

const MUN_A = "5e000000-0000-4000-8000-00000000000a";
const MUN_B = "5e000000-0000-4000-8000-00000000000b";
const UBS_A1 = "5e000000-0000-4000-8000-0000000000a1";
const UBS_A2 = "5e000000-0000-4000-8000-0000000000a2";
const UBS_B1 = "5e000000-0000-4000-8000-0000000000b1";
const PRODUTO = "5e000000-0000-4000-8000-0000000000c1";
const FABRICANTE = "5e000000-0000-4000-8000-0000000000d1";
const USER_A = "5e000000-0000-4000-8000-0000000000e1";
const USER_B = "5e000000-0000-4000-8000-0000000000e2";
const PACIENTE_A = "5e000000-0000-4000-8000-0000000000f1";
const PACIENTE_B = "5e000000-0000-4000-8000-0000000000f2";
const EMAIL_SUFIXO = "@estoque-metricas.test";

function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

describe("EstoqueMetricasPgRepository - integração (farmaubs_app, RLS)", () => {
  let admin: DataSource;
  let app: DataSource;
  let transactionContext: TransactionContext;
  let repositorio: EstoqueMetricasPgRepository;
  let casoDeUso: ObterMetricasEstoqueUseCase;

  async function executarNoTenant<T>(
    municipioId: string | null,
    operacao: () => Promise<T>,
  ): Promise<T> {
    const qr: QueryRunner = app.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.query(`SELECT set_config('app.municipio_id', $1, true)`, [
        municipioId ?? "",
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

  async function limpar(): Promise<void> {
    const muns = [MUN_A, MUN_B];
    const ubss = [UBS_A1, UBS_A2, UBS_B1];
    await admin.query(
      `DELETE FROM dispensacao_itens WHERE municipio_id = ANY($1::uuid[])`,
      [muns],
    );
    await admin.query(
      `DELETE FROM dispensacoes WHERE municipio_id = ANY($1::uuid[])`,
      [muns],
    );
    await admin.query(
      `DELETE FROM lotes WHERE municipio_id = ANY($1::uuid[])`,
      [muns],
    );
    await admin.query(
      `DELETE FROM pacientes WHERE municipio_id = ANY($1::uuid[])`,
      [muns],
    );
    await admin.query(`DELETE FROM users WHERE email LIKE $1`, [
      `%${EMAIL_SUFIXO}`,
    ]);
    await admin.query(
      `DELETE FROM unidades_saude WHERE id = ANY($1::uuid[])`,
      [ubss],
    );
    await admin.query(
      `DELETE FROM municipios WHERE id = ANY($1::uuid[])`,
      [muns],
    );
    await admin.query(`DELETE FROM produtos WHERE id = $1`, [PRODUTO]);
    await admin.query(`DELETE FROM fabricantes WHERE id = $1`, [FABRICANTE]);
  }

  async function inserirLote(
    municipioId: string,
    ubsId: string,
    numero: string,
    validade: string,
    saldo: number,
    status = "ATIVO",
  ): Promise<string> {
    const rows = await admin.query(
      `INSERT INTO lotes (municipio_id, ubs_id, produto_id, fabricante_id,
         numero_lote, data_validade, saldo_atual, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [municipioId, ubsId, PRODUTO, FABRICANTE, numero, validade, saldo, status],
    );
    return rows[0].id;
  }

  async function inserirDispensacao(
    municipioId: string,
    ubsId: string,
    pacienteId: string,
    dispensadorId: string,
    numero: string,
    diasAtras: number,
    status: string,
    loteId: string,
    quantidade: number,
  ): Promise<void> {
    // 15:00Z = 12:00 em Fortaleza: longe da virada de data em qualquer fuso.
    const criadoEm = `${somarDias(HOJE, -diasAtras)}T15:00:00Z`;
    const rows = await admin.query(
      `INSERT INTO dispensacoes (municipio_id, unidade_id, paciente_id,
         dispensador_id, numero_atendimento, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [municipioId, ubsId, pacienteId, dispensadorId, numero, status, criadoEm],
    );
    await admin.query(
      `INSERT INTO dispensacao_itens (municipio_id, dispensacao_id,
         medicamento_id, lote_id, quantidade_dispensada)
       VALUES ($1, $2, $3, $4, $5)`,
      [municipioId, rows[0].id, PRODUTO, loteId, quantidade],
    );
  }

  beforeAll(async () => {
    admin = new DataSource({ type: "postgres", url: adminDatabaseUrl() });
    app = new DataSource({ type: "postgres", url: appDatabaseUrl() });
    await admin.initialize();
    await app.initialize();

    await limpar();

    const perfil = await admin.query(`SELECT id FROM perfis LIMIT 1`);
    const perfilId: string = perfil[0].id;

    await admin.query(
      `INSERT INTO municipios (id, nome, uf, codigo_ibge) VALUES
         ($1, 'Município Estoque A', 'PI', '9900001'),
         ($2, 'Município Estoque B', 'PI', '9900002')`,
      [MUN_A, MUN_B],
    );
    await admin.query(
      `INSERT INTO unidades_saude (id, municipio_id, nome) VALUES
         ($1, $4, 'UBS Estoque A1'),
         ($2, $4, 'UBS Estoque A2'),
         ($3, $5, 'UBS Estoque B1')`,
      [UBS_A1, UBS_A2, UBS_B1, MUN_A, MUN_B],
    );
    await admin.query(
      `INSERT INTO produtos (id, principio_ativo) VALUES ($1, 'Princípio Ativo Estoque Teste')`,
      [PRODUTO],
    );
    await admin.query(
      `INSERT INTO fabricantes (id, razao_social, nome_fantasia) VALUES ($1, 'Fabricante Estoque Teste', 'Fab Estoque')`,
      [FABRICANTE],
    );
    await admin.query(
      `INSERT INTO users (id, nome_completo, email, senha_hash, perfil_id, municipio_id) VALUES
         ($1, 'Dispensador A', $3, 'hash-dummy', $5, $6),
         ($2, 'Dispensador B', $4, 'hash-dummy', $5, $7)`,
      [USER_A, USER_B, `a${EMAIL_SUFIXO}`, `b${EMAIL_SUFIXO}`, perfilId, MUN_A, MUN_B],
    );
    await admin.query(
      `INSERT INTO pacientes (id, municipio_id, cns, cpf, nome_completo, data_nascimento) VALUES
         ($1, $3, '900000000000001', '90000000001', 'Paciente Estoque A', '1980-01-01'),
         ($2, $4, '900000000000002', '90000000002', 'Paciente Estoque B', '1980-01-01')`,
      [PACIENTE_A, PACIENTE_B, MUN_A, MUN_B],
    );

    // UBS A1: fronteiras de validade + lotes que NÃO contam (saldo 0, INATIVO).
    const loteA1 = await inserirLote(MUN_A, UBS_A1, "EM-ONTEM", somarDias(HOJE, -1), 10);
    await inserirLote(MUN_A, UBS_A1, "EM-HOJE", HOJE, 10);
    await inserirLote(MUN_A, UBS_A1, "EM-D90", somarDias(HOJE, 90), 10);
    await inserirLote(MUN_A, UBS_A1, "EM-D91", somarDias(HOJE, 91), 10);
    await inserirLote(MUN_A, UBS_A1, "EM-ZERO", somarDias(HOJE, 200), 0);
    await inserirLote(MUN_A, UBS_A1, "EM-INATIVO", somarDias(HOJE, -1), 500, "INATIVO");
    await inserirDispensacao(MUN_A, UBS_A1, PACIENTE_A, USER_A, "EM-A1-5D", 5, "concluida", loteA1, 100);

    // UBS A2: cobertura no limite (saldo 1040, 520 em 10 dias => CMD 52 => 20 dias).
    const loteA2 = await inserirLote(MUN_A, UBS_A2, "EM-A2", somarDias(HOJE, 365), 1040);
    await inserirDispensacao(MUN_A, UBS_A2, PACIENTE_A, USER_A, "EM-A2-10D", 10, "concluida", loteA2, 260);
    await inserirDispensacao(MUN_A, UBS_A2, PACIENTE_A, USER_A, "EM-A2-3D", 3, "concluida", loteA2, 260);
    // Não entram: estornada na janela e concluída fora da janela de 90 dias.
    await inserirDispensacao(MUN_A, UBS_A2, PACIENTE_A, USER_A, "EM-A2-ESTORNO", 4, "estornada", loteA2, 999);
    await inserirDispensacao(MUN_A, UBS_A2, PACIENTE_A, USER_A, "EM-A2-FORA", 100, "concluida", loteA2, 777);

    // UBS B1 (outro município).
    await inserirLote(MUN_B, UBS_B1, "EM-B1", somarDias(HOJE, 30), 3);

    transactionContext = new TransactionContext(app);
    repositorio = new EstoqueMetricasPgRepository(transactionContext);
    casoDeUso = new ObterMetricasEstoqueUseCase(repositorio);
  });

  afterAll(async () => {
    if (admin?.isInitialized) {
      await limpar();
      await admin.destroy();
    }
    if (app?.isInitialized) {
      await app.destroy();
    }
  });

  describe("totais", () => {
    it("soma só lotes ATIVO com saldo > 0 da UBS", async () => {
      const totais = await executarNoTenant(MUN_A, () =>
        repositorio.obterTotais(UBS_A1),
      );
      expect(totais).toEqual({
        totalMedicamentosAtivos: 1,
        totalUnidadesFisicas: 40,
      });
    });
  });

  describe("fronteiras de validade", () => {
    it("classifica ontem, hoje, dia 90 e dia 91 (hoje injetado)", async () => {
      const validade = await executarNoTenant(MUN_A, () =>
        repositorio.contarLotesPorValidade(UBS_A1, HOJE),
      );
      expect(validade.lotesVencidos).toBe(1);
      expect(validade.lotesValidadeMesAtual).toBe(1);
      expect(validade.lotesValidadeCurta90d).toBe(2);
    });
  });

  describe("consumo e cobertura", () => {
    it("agrega consumo por UBS sem vazar dispensações de outra UBS", async () => {
      const a1 = await executarNoTenant(MUN_A, () =>
        repositorio.listarConsumoPorProduto(UBS_A1, HOJE),
      );
      expect(a1).toEqual([
        { produtoId: PRODUTO, saldoAtual: 40, totalDispensado: 100, diasApurados: 5 },
      ]);

      const a2 = await executarNoTenant(MUN_A, () =>
        repositorio.listarConsumoPorProduto(UBS_A2, HOJE),
      );
      expect(a2).toEqual([
        { produtoId: PRODUTO, saldoAtual: 1040, totalDispensado: 520, diasApurados: 10 },
      ]);
    });

    it("cobertura de exatamente 20 dias é risco (<=); 259 unidades já não é", async () => {
      const noLimite = await executarNoTenant(MUN_A, () =>
        casoDeUso.executar(UBS_A2, HOJE),
      );
      expect(noLimite.itensRiscoRuptura).toBe(1);

      await admin.query(
        `UPDATE dispensacao_itens SET quantidade_dispensada = 259
         WHERE dispensacao_id IN (
           SELECT id FROM dispensacoes WHERE numero_atendimento = 'EM-A2-10D')`,
      );
      const foraDoLimite = await executarNoTenant(MUN_A, () =>
        casoDeUso.executar(UBS_A2, HOJE),
      );
      expect(foraDoLimite.itensRiscoRuptura).toBe(0);
    });
  });

  describe("isolamento entre municípios (RLS)", () => {
    it("o município B não enxerga a UBS A1, mesmo filtrando o ubs_id dela", async () => {
      const vazio = { totalMedicamentosAtivos: 0, totalUnidadesFisicas: 0 };
      const totais = await executarNoTenant(MUN_B, () =>
        repositorio.obterTotais(UBS_A1),
      );
      expect(totais).toEqual(vazio);

      const consumo = await executarNoTenant(MUN_B, () =>
        repositorio.listarConsumoPorProduto(UBS_A1, HOJE),
      );
      expect(consumo).toEqual([]);

      const validade = await executarNoTenant(MUN_B, () =>
        repositorio.contarLotesPorValidade(UBS_A1, HOJE),
      );
      expect(validade).toMatchObject({
        lotesVencidos: 0,
        lotesValidadeMesAtual: 0,
        lotesValidadeCurta90d: 0,
      });
    });

    it("cada município vê apenas as próprias UBSs", async () => {
      const comoB = await executarNoTenant(MUN_B, () =>
        repositorio.obterTotais(UBS_B1),
      );
      expect(comoB.totalUnidadesFisicas).toBe(3);

      const comoA = await executarNoTenant(MUN_A, () =>
        repositorio.obterTotais(UBS_B1),
      );
      expect(comoA.totalUnidadesFisicas).toBe(0);
    });

    it("fail-closed: sem o GUC de município, nada é visível", async () => {
      const totais = await executarNoTenant(null, () =>
        repositorio.obterTotais(UBS_A1),
      );
      expect(totais.totalUnidadesFisicas).toBe(0);
    });
  });
});
