import { DataSource, QueryRunner } from "typeorm";
import { adminDatabaseUrl, appDatabaseUrl } from "../test-db";
import { TransactionContext } from "../../src/common/transaction/transaction-context.service";
import { EstoqueRelatoriosPgRepository } from "../../src/modules/estoque/infrastructure/adapters/estoque-relatorios-pg.repository";

/**
 * ES-05 (#246) - Camada B (ADR-030): consultas dos relatórios de estoque contra PostgreSQL real,
 * conectando como farmaubs_app (RLS por município ativo). Cada requisição roda numa transação
 * própria, como o TransactionInterceptor. O isolamento entre UBSs do mesmo município vem só do
 * filtro ubs_id; o isolamento entre municípios vem do RLS.
 */

jest.setTimeout(30000);

const uid = (sufixo: string): string =>
  `6f000000-0000-4000-8000-${sufixo.padStart(12, "0")}`;
const MUN_A = uid("a");
const MUN_B = uid("b");
const UBS_A1 = uid("a1");
const UBS_A2 = uid("a2");
const UBS_B1 = uid("b1");
const FABRICANTE = uid("d1");
const PRODUTO = uid("c1");
const USER_A = uid("e1");
const USER_B = uid("e2");
const EMAIL_SUFIXO = "@estoque-relatorios.test";
const NOME_USER_A = "Farmacêutico Relatórios A";

describe("EstoqueRelatoriosPgRepository - integração (farmaubs_app, RLS)", () => {
  let admin: DataSource;
  let app: DataSource;
  let repo: EstoqueRelatoriosPgRepository;
  let transactionContext: TransactionContext;

  async function executarNoTenant<T>(
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

  async function inserirLote(
    municipioId: string,
    ubsId: string,
    numero: string,
    saldo: number,
  ): Promise<string> {
    const rows = await admin.query(
      `INSERT INTO lotes (municipio_id, ubs_id, produto_id, fabricante_id,
         numero_lote, data_validade, saldo_atual, status, created_at)
       VALUES ($1, $2, $3, $4, $5, '2030-01-01', $6, 'ATIVO', '2026-01-01T09:00:00.000Z')
       RETURNING id`,
      [municipioId, ubsId, PRODUTO, FABRICANTE, numero, saldo],
    );
    return rows[0].id;
  }

  async function inserirMovimentacao(
    municipioId: string,
    ubsId: string,
    loteId: string,
    usuarioId: string,
    tipo: string,
    quantidade: number,
    anterior: number,
    posterior: number,
    criadoEm: string,
    motivo?: string,
  ): Promise<void> {
    await admin.query(
      `INSERT INTO movimentacoes_estoque
         (municipio_id, ubs_id, lote_id, tipo_movimentacao, quantidade,
          saldo_anterior, saldo_posterior, usuario_id, motivo, justificativa, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz)`,
      [
        municipioId,
        ubsId,
        loteId,
        tipo,
        quantidade,
        anterior,
        posterior,
        usuarioId,
        motivo ?? null,
        motivo ? "Justificativa de teste" : null,
        criadoEm,
      ],
    );
  }

  async function limpar(): Promise<void> {
    const muns = [MUN_A, MUN_B];
    await admin.query(
      `DELETE FROM movimentacoes_estoque WHERE municipio_id = ANY($1::uuid[])`,
      [muns],
    );
    await admin.query(
      `DELETE FROM lotes WHERE municipio_id = ANY($1::uuid[])`,
      [muns],
    );
    await admin.query(`DELETE FROM users WHERE email LIKE $1`, [
      `%${EMAIL_SUFIXO}`,
    ]);
    await admin.query(`DELETE FROM unidades_saude WHERE id = ANY($1::uuid[])`, [
      [UBS_A1, UBS_A2, UBS_B1],
    ]);
    await admin.query(`DELETE FROM municipios WHERE id = ANY($1::uuid[])`, [
      muns,
    ]);
    await admin.query(`DELETE FROM produtos WHERE id = $1`, [PRODUTO]);
    await admin.query(`DELETE FROM fabricantes WHERE id = $1`, [FABRICANTE]);
  }

  beforeAll(async () => {
    admin = new DataSource({ type: "postgres", url: adminDatabaseUrl() });
    app = new DataSource({ type: "postgres", url: appDatabaseUrl() });
    await admin.initialize();
    await app.initialize();
    transactionContext = new TransactionContext(app);
    repo = new EstoqueRelatoriosPgRepository(transactionContext);

    await limpar();

    const perfil = await admin.query(`SELECT id FROM perfis LIMIT 1`);
    const perfilId: string = perfil[0].id;

    await admin.query(
      `INSERT INTO municipios (id, nome, uf, codigo_ibge) VALUES
         ($1, 'Município Relatórios A', 'PI', '9900061'),
         ($2, 'Município Relatórios B', 'PI', '9900062')`,
      [MUN_A, MUN_B],
    );
    await admin.query(
      `INSERT INTO unidades_saude (id, municipio_id, nome) VALUES
         ($1, $4, 'UBS Relatórios A1'),
         ($2, $4, 'UBS Relatórios A2'),
         ($3, $5, 'UBS Relatórios B1')`,
      [UBS_A1, UBS_A2, UBS_B1, MUN_A, MUN_B],
    );
    await admin.query(
      `INSERT INTO fabricantes (id, razao_social, nome_fantasia)
       VALUES ($1, 'Fabricante Relatórios Teste', 'Fab Relatórios')`,
      [FABRICANTE],
    );
    await admin.query(
      `INSERT INTO produtos (id, nome_comercial, principio_ativo, apresentacao, categoria, ativo)
       VALUES ($1, 'Relatórios Dipirona', 'Dipirona sódica', 'Comprimido 500 mg', 'GERAL', true)`,
      [PRODUTO],
    );
    await admin.query(
      `INSERT INTO users (id, nome_completo, email, senha_hash, perfil_id, municipio_id) VALUES
         ($1, $5, $2, 'hash-dummy', $3, $4),
         ($6, 'Farmacêutico Relatórios B', $7, 'hash-dummy', $3, $8)`,
      [
        USER_A,
        `a${EMAIL_SUFIXO}`,
        perfilId,
        MUN_A,
        NOME_USER_A,
        USER_B,
        `b${EMAIL_SUFIXO}`,
        MUN_B,
      ],
    );

    // UBS A1: lote com histórico + lote zerado (fora dos saldos).
    // Horários escolhidos para exercitar o fuso America/Fortaleza (UTC-3):
    //   m1 = 2025-12-31 23:00 local (já é 01/01 em UTC)
    //   m2 = 2026-01-01 23:30 local (já é 02/01 em UTC)
    const loteA1 = await inserirLote(MUN_A, UBS_A1, "RL-INT-A1", 80);
    await inserirLote(MUN_A, UBS_A1, "RL-INT-ZERO", 0);
    const mov = (
      tipo: string,
      qtd: number,
      ant: number,
      post: number,
      quando: string,
      motivo?: string,
    ) =>
      inserirMovimentacao(
        MUN_A, UBS_A1, loteA1, USER_A, tipo, qtd, ant, post, quando, motivo,
      );
    await mov("ENTRADA_RECEBIMENTO", 100, 0, 100, "2026-01-01T02:00:00.000Z");
    await mov("AJUSTE_SAIDA", 10, 100, 90, "2026-01-02T02:30:00.000Z", "VENCIMENTO");
    await mov("AJUSTE_SAIDA", 5, 90, 85, "2026-01-15T12:00:00.000Z", "AVARIA_FISICA");
    await mov("AJUSTE_SAIDA", 3, 85, 82, "2026-01-16T12:00:00.000Z", "EXTRAVIO");
    await mov("SAIDA_DISPENSACAO", 2, 82, 80, "2026-01-17T12:00:00.000Z");

    // UBS A2 (mesmo município): só o filtro ubs_id separa.
    const loteA2 = await inserirLote(MUN_A, UBS_A2, "RL-INT-A2", 50);
    await inserirMovimentacao(
      MUN_A, UBS_A2, loteA2, USER_A, "ENTRADA_RECEBIMENTO", 50, 0, 50,
      "2026-01-10T12:00:00.000Z",
    );

    // UBS B1 (outro município): RLS.
    const loteB1 = await inserirLote(MUN_B, UBS_B1, "RL-INT-B1", 70);
    await inserirMovimentacao(
      MUN_B, UBS_B1, loteB1, USER_B, "ENTRADA_RECEBIMENTO", 70, 0, 70,
      "2026-01-10T12:00:00.000Z",
    );
  });

  afterAll(async () => {
    if (admin?.isInitialized) {
      await limpar();
      await admin.destroy();
    }
    if (app?.isInitialized) await app.destroy();
  });

  describe("obterCabecalhoUbs", () => {
    it("lê nome da UBS e município no schema real (sem a coluna cnes)", async () => {
      const cab = await executarNoTenant(MUN_A, () =>
        repo.obterCabecalhoUbs(UBS_A1),
      );
      expect(cab).toEqual({
        nomeUbs: "UBS Relatórios A1",
        municipio: "Município Relatórios A",
      });
    });

    it("devolve null para UBS de outro município (unidades_saude não tem RLS)", async () => {
      const cab = await executarNoTenant(MUN_A, () =>
        repo.obterCabecalhoUbs(UBS_B1),
      );
      expect(cab).toBeNull();
    });

    it("devolve null para UBS inexistente", async () => {
      const cab = await executarNoTenant(MUN_A, () =>
        repo.obterCabecalhoUbs(uid("ff")),
      );
      expect(cab).toBeNull();
    });
  });

  describe("consultarSaldosAtuais", () => {
    it("lista só lotes ativos com saldo da UBS pedida (sem lote zerado nem outra UBS)", async () => {
      const linhas = await executarNoTenant(MUN_A, () =>
        repo.consultarSaldosAtuais({ ubsId: UBS_A1 }),
      );
      expect(linhas.map((l) => l.lote)).toEqual(["RL-INT-A1"]);
      expect(linhas[0]).toMatchObject({
        medicamento: "Relatórios Dipirona",
        principioAtivo: "Dipirona sódica",
        fabricante: "Fab Relatórios",
        validade: "2030-01-01",
        saldo: 80,
        status: "ATIVO",
      });
    });

    it("filtra por princípio ativo sem acentos (escapando curingas %), categoria sem case e produtoId", async () => {
      const porPrincipioSemAcento = await executarNoTenant(MUN_A, () =>
        repo.consultarSaldosAtuais({
          ubsId: UBS_A1,
          principioAtivo: "dipirona sodica",
        }),
      );
      expect(porPrincipioSemAcento).toHaveLength(1);
      const curingaLiteral = await executarNoTenant(MUN_A, () =>
        repo.consultarSaldosAtuais({ ubsId: UBS_A1, principioAtivo: "100%" }),
      );
      expect(curingaLiteral).toHaveLength(0);
      const porCategoriaMinuscula = await executarNoTenant(MUN_A, () =>
        repo.consultarSaldosAtuais({ ubsId: UBS_A1, categoria: "geral" }),
      );
      expect(porCategoriaMinuscula).toHaveLength(1);
      const porProduto = await executarNoTenant(MUN_A, () =>
        repo.consultarSaldosAtuais({ ubsId: UBS_A1, produtoId: PRODUTO }),
      );
      expect(porProduto).toHaveLength(1);
    });

    it("RLS: o tenant A não enxerga a UBS do município B, e o B enxerga a sua", async () => {
      const doA = await executarNoTenant(MUN_A, () =>
        repo.consultarSaldosAtuais({ ubsId: UBS_B1 }),
      );
      expect(doA).toEqual([]);
      const doB = await executarNoTenant(MUN_B, () =>
        repo.consultarSaldosAtuais({ ubsId: UBS_B1 }),
      );
      expect(doB.map((l) => l.lote)).toEqual(["RL-INT-B1"]);
    });
  });

  describe("consultarPerdasVencimento", () => {
    it("lista todos os motivos de perda (EXTRAVIO, AVARIA_FISICA, VENCIMENTO), mais recentes primeiro, data no fuso da UBS", async () => {
      const linhas = await executarNoTenant(MUN_A, () =>
        repo.consultarPerdasVencimento({
          ubsId: UBS_A1,
          dataInicio: "2026-01-01",
          dataFim: "2026-01-31",
        }),
      );
      expect(linhas.map((l) => l.motivo)).toEqual([
        "EXTRAVIO",
        "AVARIA_FISICA",
        "VENCIMENTO",
      ]);
      expect(linhas.map((l) => l.quantidade)).toEqual([3, 5, 10]);
      // m2 foi gravada em 02/01 UTC, mas em Fortaleza ainda é 01/01.
      expect(linhas.map((l) => l.data)).toEqual([
        "2026-01-16",
        "2026-01-15",
        "2026-01-01",
      ]);
    });

    it("fuso: perda de 01/01 23:30 (Fortaleza) fica fora de um período que começa em 02/01", async () => {
      const linhas = await executarNoTenant(MUN_A, () =>
        repo.consultarPerdasVencimento({
          ubsId: UBS_A1,
          dataInicio: "2026-01-02",
          dataFim: "2026-01-31",
        }),
      );
      expect(linhas.map((l) => l.motivo)).toEqual([
        "EXTRAVIO",
        "AVARIA_FISICA",
      ]);
    });

    it("dataFim é inclusiva (dia inteiro)", async () => {
      const linhas = await executarNoTenant(MUN_A, () =>
        repo.consultarPerdasVencimento({
          ubsId: UBS_A1,
          dataInicio: "2026-01-15",
          dataFim: "2026-01-15",
        }),
      );
      expect(linhas.map((l) => l.quantidade)).toEqual([5]);
    });

    it("RLS: o tenant A não enxerga perdas da UBS do município B", async () => {
      const linhas = await executarNoTenant(MUN_A, () =>
        repo.consultarPerdasVencimento({
          ubsId: UBS_B1,
          dataInicio: "2026-01-01",
          dataFim: "2026-01-31",
        }),
      );
      expect(linhas).toEqual([]);
    });
  });

  describe("consultarMovimentacoesPeriodo", () => {
    it("extrato cronológico com responsável (JOIN em users), saldo resultante e ISO em UTC", async () => {
      const linhas = await executarNoTenant(MUN_A, () =>
        repo.consultarMovimentacoesPeriodo({
          ubsId: UBS_A1,
          dataInicio: "2025-12-31",
          dataFim: "2026-01-31",
        }),
      );
      expect(linhas.map((l) => l.saldoResultante)).toEqual([100, 90, 85, 82, 80]);
      expect(linhas.map((l) => l.tipo)).toEqual([
        "ENTRADA_RECEBIMENTO",
        "AJUSTE_SAIDA",
        "AJUSTE_SAIDA",
        "AJUSTE_SAIDA",
        "SAIDA_DISPENSACAO",
      ]);
      expect(new Set(linhas.map((l) => l.responsavel))).toEqual(
        new Set([NOME_USER_A]),
      );
      expect(linhas[0].dataHora).toBe("2026-01-01T02:00:00.000Z");
      // Nada da UBS A2 (mesmo município) nem do município B.
      expect(new Set(linhas.map((l) => l.lote))).toEqual(new Set(["RL-INT-A1"]));
    });

    it("fuso: a entrada de 31/12 23:00 (Fortaleza) fica fora de um período que começa em 01/01", async () => {
      const linhas = await executarNoTenant(MUN_A, () =>
        repo.consultarMovimentacoesPeriodo({
          ubsId: UBS_A1,
          dataInicio: "2026-01-01",
          dataFim: "2026-01-31",
        }),
      );
      expect(linhas.map((l) => l.saldoResultante)).toEqual([90, 85, 82, 80]);
    });

    it("RLS: o tenant A não enxerga movimentações da UBS do município B", async () => {
      const doA = await executarNoTenant(MUN_A, () =>
        repo.consultarMovimentacoesPeriodo({
          ubsId: UBS_B1,
          dataInicio: "2026-01-01",
          dataFim: "2026-01-31",
        }),
      );
      expect(doA).toEqual([]);
      const doB = await executarNoTenant(MUN_B, () =>
        repo.consultarMovimentacoesPeriodo({
          ubsId: UBS_B1,
          dataInicio: "2026-01-01",
          dataFim: "2026-01-31",
        }),
      );
      expect(doB).toHaveLength(1);
      expect(doB[0].responsavel).toBe("Farmacêutico Relatórios B");
    });
  });
});
