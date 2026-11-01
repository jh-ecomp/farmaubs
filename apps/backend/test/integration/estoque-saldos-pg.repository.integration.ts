import { DataSource, QueryRunner } from "typeorm";
import { adminDatabaseUrl, appDatabaseUrl } from "../test-db";
import { TransactionContext } from "../../src/common/transaction/transaction-context.service";
import { EstoqueSaldosPgRepository } from "../../src/modules/estoque/infrastructure/adapters/estoque-saldos-pg.repository";
import { ConsultarSaldosPaginadosUseCase } from "../../src/modules/estoque/application/use-cases/consultar-saldos-paginados.use-case";
import type { FiltrosConsultaSaldos } from "../../src/modules/estoque/domain/ports/estoque-saldos.repository.port";

/**
 * ES-02 (#243) - Camada C: consulta paginada de saldos contra PostgreSQL real,
 * conectando como farmaubs_app (RLS ativo). `hoje` é injetado (HOJE), nunca o relógio.
 */

const HOJE = "2026-06-15";

const uid = (sufixo: string): string =>
  `5f000000-0000-4000-8000-${sufixo.padStart(12, "0")}`;
const MUN_A = uid("a");
const MUN_B = uid("b");
const UBS_A1 = uid("a1");
const UBS_A2 = uid("a2");
const UBS_B1 = uid("b1");
const FABRICANTE = uid("d1");
const USER_A = uid("e1");
const USER_B = uid("e2");
const PACIENTE_A = uid("f1");
const PACIENTE_B = uid("f2");
const P = (n: number): string => uid(`c${n}`);
const PRODUTOS = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(P);
const EMAIL_SUFIXO = "@estoque-saldos.test";

const NOME: Record<number, string> = {
  1: "Saldos 01 Dipirona",
  2: "Saldos 02 Ácido Acetilsalicílico",
  3: "Saldos 03 Amoxicilina",
  4: "Saldos 04 Losartana",
  5: "Saldos 05 Vencido ontem",
  6: "Saldos 06 Vence hoje",
  7: "Saldos 07 Vence em 90 dias",
  8: "Saldos 08 Vence em 91 dias",
  9: "Saldos 09 Lote inativo",
};

function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

describe("EstoqueSaldosPgRepository - integração (farmaubs_app, RLS)", () => {
  let admin: DataSource;
  let app: DataSource;
  let transactionContext: TransactionContext;
  let repositorio: EstoqueSaldosPgRepository;
  let casoDeUso: ConsultarSaldosPaginadosUseCase;

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

  const FILTROS_PADRAO: FiltrosConsultaSaldos = {
    filtroValidade: "TODOS",
    statusEstoque: "TODOS",
    pagina: 1,
    itensPorPagina: 50,
  };

  const consultar = (
    municipioId: string | null,
    ubsId: string,
    filtros: Partial<FiltrosConsultaSaldos> = {},
  ) =>
    executarNoTenant(municipioId, () =>
      casoDeUso.executar(ubsId, { ...FILTROS_PADRAO, ...filtros }, HOJE),
    );

  const nomes = (r: { itens: { nome: string }[] }): string[] =>
    r.itens.map((i) => i.nome);

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
    await admin.query(`DELETE FROM produtos WHERE id = ANY($1::uuid[])`, [
      PRODUTOS,
    ]);
    await admin.query(`DELETE FROM fabricantes WHERE id = $1`, [FABRICANTE]);
  }

  async function inserirProduto(
    n: number,
    principioAtivo: string,
    apresentacao: string,
    categoria: string,
  ): Promise<void> {
    await admin.query(
      `INSERT INTO produtos (id, nome_comercial, principio_ativo, apresentacao, categoria, ativo)
       VALUES ($1, $2, $3, $4, $5, true)`,
      [P(n), NOME[n], principioAtivo, apresentacao, categoria],
    );
  }

  async function inserirLote(
    municipioId: string,
    ubsId: string,
    produtoId: string,
    numero: string,
    validade: string,
    saldo: number,
    status = "ATIVO",
  ): Promise<string> {
    const rows = await admin.query(
      `INSERT INTO lotes (municipio_id, ubs_id, produto_id, fabricante_id,
         numero_lote, data_validade, saldo_atual, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [municipioId, ubsId, produtoId, FABRICANTE, numero, validade, saldo, status],
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
    produtoId: string,
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
      [municipioId, rows[0].id, produtoId, loteId, quantidade],
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
         ($1, 'Município Saldos A', 'PI', '9900011'),
         ($2, 'Município Saldos B', 'PI', '9900012')`,
      [MUN_A, MUN_B],
    );
    await admin.query(
      `INSERT INTO unidades_saude (id, municipio_id, nome) VALUES
         ($1, $4, 'UBS Saldos A1'),
         ($2, $4, 'UBS Saldos A2'),
         ($3, $5, 'UBS Saldos B1')`,
      [UBS_A1, UBS_A2, UBS_B1, MUN_A, MUN_B],
    );
    await admin.query(
      `INSERT INTO fabricantes (id, razao_social, nome_fantasia) VALUES ($1, 'Fabricante Saldos Teste', 'Fab Saldos')`,
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
         ($1, $3, '900000000000011', '90000000011', 'Paciente Saldos A', '1980-01-01'),
         ($2, $4, '900000000000012', '90000000012', 'Paciente Saldos B', '1980-01-01')`,
      [PACIENTE_A, PACIENTE_B, MUN_A, MUN_B],
    );

    await inserirProduto(1, "Dipirona sódica", "Comprimido 500 mg", "GERAL");
    await inserirProduto(2, "Ácido acetilsalicílico", "Comprimido 100 mg", "GERAL");
    await inserirProduto(3, "Amoxicilina", "Cápsula 500 mg", "ANTIMICROBIANO");
    await inserirProduto(4, "Losartana potássica", "Comprimido 50 mg", "GERAL");
    await inserirProduto(5, "Princípio Saldos 05", "Frasco Saldos", "GERAL");
    await inserirProduto(6, "Princípio Saldos 06", "Frasco Saldos", "GERAL");
    await inserirProduto(7, "Princípio Saldos 07", "Frasco Saldos", "GERAL");
    await inserirProduto(8, "Princípio Saldos 08", "Frasco Saldos", "GERAL");
    await inserirProduto(9, "Princípio Saldos 09", "Frasco Saldos", "GERAL");

    const lote = (
      mun: string,
      ubs: string,
      p: number,
      numero: string,
      dias: number,
      saldo: number,
      status = "ATIVO",
    ) => inserirLote(mun, ubs, P(p), numero, somarDias(HOJE, dias), saldo, status);

    // UBS A1
    await lote(MUN_A, UBS_A1, 1, "P1-B", 200, 50);
    await lote(MUN_A, UBS_A1, 1, "P1-C", 300, 25);
    await lote(MUN_A, UBS_A1, 1, "P1-A", 400, 100);
    await lote(MUN_A, UBS_A1, 1, "P1-ZERO", -30, 0); // vencido, mas saldo 0
    await lote(MUN_A, UBS_A1, 2, "P2-ZERO", 100, 0);
    const loteP3 = await lote(MUN_A, UBS_A1, 3, "LOTE-P3", 365, 260);
    const loteP4 = await lote(MUN_A, UBS_A1, 4, "LOTE-P4", 365, 261);
    await lote(MUN_A, UBS_A1, 5, "P5-VENC", -1, 10);
    await lote(MUN_A, UBS_A1, 6, "P6-HOJE", 0, 10);
    await lote(MUN_A, UBS_A1, 7, "P7-D90", 90, 10);
    await lote(MUN_A, UBS_A1, 8, "P8-D91", 91, 10);
    await lote(MUN_A, UBS_A1, 9, "P9-INAT", -1, 500, "INATIVO");

    const disp = (
      numero: string, dias: number, status: string,
      loteId: string, qtd: number, p: number,
    ) =>
      inserirDispensacao(
        MUN_A, UBS_A1, PACIENTE_A, USER_A, numero, dias, status, loteId, qtd, P(p),
      );
    // Consumo de 13/dia: 130 unidades em 10 dias.
    await disp("ES2-P3-10D", 10, "concluida", loteP3, 130, 3);
    await disp("ES2-P4-10D", 10, "concluida", loteP4, 130, 4);
    // Não entram: estornada e concluída fora da janela de 90 dias.
    await disp("ES2-P4-ESTORNO", 3, "estornada", loteP4, 999, 4);
    await disp("ES2-P4-FORA", 100, "concluida", loteP4, 5000, 4);

    // UBS A2 (mesmo município) e UBS B1 (outro município).
    await lote(MUN_A, UBS_A2, 1, "A2-P1", 300, 7);
    await lote(MUN_A, UBS_A2, 3, "A2-P3", 365, 10);
    await lote(MUN_B, UBS_B1, 1, "B1-P1", 300, 3);

    transactionContext = new TransactionContext(app);
    repositorio = new EstoqueSaldosPgRepository(transactionContext);
    casoDeUso = new ConsultarSaldosPaginadosUseCase(repositorio);
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

  describe("paginação por medicamento", () => {
    it("total conta medicamentos (não lotes) e agrupa os lotes de cada um", async () => {
      const r = await consultar(MUN_A, UBS_A1);
      expect(r.total).toBe(8);
      expect(r.itens).toHaveLength(8);
      expect(r.itens[0].nome).toBe(NOME[1]);
      expect(r.itens[0].lotes).toHaveLength(3);
    });

    it("páginas de 3 itens: 3 + 3 + 2, sem repetir medicamento", async () => {
      const paginas: Awaited<ReturnType<typeof consultar>>[] = [];
      for (const pagina of [1, 2, 3]) {
        paginas.push(await consultar(MUN_A, UBS_A1, { pagina, itensPorPagina: 3 }));
      }
      expect(paginas.map((p) => p.itens.length)).toEqual([3, 3, 2]);
      expect(paginas.every((p) => p.total === 8 && p.totalPaginas === 3)).toBe(true);
      const ids = paginas.flatMap((p) => p.itens.map((i) => i.produtoId));
      expect(new Set(ids).size).toBe(8);
      expect(paginas[0].itens[0].lotes).toHaveLength(3);
    });

    it("página além do fim: sem itens, total preservado", async () => {
      const r = await consultar(MUN_A, UBS_A1, { pagina: 4, itensPorPagina: 3 });
      expect(r.itens).toEqual([]);
      expect(r.total).toBe(8);
    });
  });

  describe("lotes e status de validade", () => {
    it("lotes em ordem FEFO, sem lote de saldo 0; saldoTotal soma só ativos", async () => {
      const r = await consultar(MUN_A, UBS_A1);
      const p1 = r.itens.find((i) => i.produtoId === P(1));
      expect(p1?.lotes.map((l) => l.numeroLote)).toEqual(["P1-B", "P1-C", "P1-A"]);
      expect(p1?.saldoTotal).toBe(175);
      expect(p1?.statusEstoque).toBe("REGULAR");
    });

    it("medicamento só com lote de saldo 0 aparece ZERADO, sem lotes", async () => {
      const r = await consultar(MUN_A, UBS_A1);
      const p2 = r.itens.find((i) => i.produtoId === P(2));
      expect(p2).toMatchObject({ saldoTotal: 0, statusEstoque: "ZERADO", lotes: [] });
    });

    it("medicamento só com lote INATIVO não aparece", async () => {
      const r = await consultar(MUN_A, UBS_A1);
      expect(r.itens.some((i) => i.produtoId === P(9))).toBe(false);
    });

    it("classifica ontem, hoje, dia 90 e dia 91 (hoje injetado)", async () => {
      const r = await consultar(MUN_A, UBS_A1);
      const lotes = r.itens.flatMap((i) => i.lotes);
      const st = (n: string) => lotes.find((l) => l.numeroLote === n)?.statusValidade;
      expect(st("P5-VENC")).toBe("VENCIDO");
      expect(st("P6-HOJE")).toBe("MES_CORRENTE");
      expect(st("P7-D90")).toBe("CURTA_90D");
      expect(st("P8-D91")).toBe("REGULAR");
    });
  });

  describe("filtros de validade", () => {
    it("VENCIDOS: só lote vencido com saldo > 0 (lote vencido de saldo 0 não conta)", async () => {
      const r = await consultar(MUN_A, UBS_A1, { filtroValidade: "VENCIDOS" });
      expect(nomes(r)).toEqual([NOME[5]]);
      expect(r.total).toBe(1);
    });

    it("MES_CORRENTE: de hoje até o fim do mês", async () => {
      const r = await consultar(MUN_A, UBS_A1, { filtroValidade: "MES_CORRENTE" });
      expect(nomes(r)).toEqual([NOME[6]]);
    });

    it("VALIDADE_90D: hoje até o dia 90, inclusive; dia 91 e vencidos ficam de fora", async () => {
      const r = await consultar(MUN_A, UBS_A1, { filtroValidade: "VALIDADE_90D" });
      expect(nomes(r)).toEqual([NOME[6], NOME[7]]);
    });
  });

  describe("busca", () => {
    it("ignora acento e caixa (com e sem acento no termo)", async () => {
      for (const termo of ["acetilsalicilico", "acetilsalicílico", "ÁCIDO", "acido acetil"]) {
        const r = await consultar(MUN_A, UBS_A1, { termo });
        expect(nomes(r)).toEqual([NOME[2]]);
      }
    });

    it("busca por princípio ativo, apresentação e número do lote", async () => {
      expect(nomes(await consultar(MUN_A, UBS_A1, { termo: "dipirona sodica" }))).toEqual([NOME[1]]);
      expect(nomes(await consultar(MUN_A, UBS_A1, { termo: "500 mg" }))).toEqual([NOME[1], NOME[3]]);
      expect(nomes(await consultar(MUN_A, UBS_A1, { termo: "lote-p3" }))).toEqual([NOME[3]]);
    });

    it("%, _ e termo inexistente são literais: não casam tudo", async () => {
      for (const termo of ["%", "_", "xyz-inexistente"]) {
        const r = await consultar(MUN_A, UBS_A1, { termo });
        expect(r.total).toBe(0);
        expect(r.itens).toEqual([]);
      }
    });
  });

  describe("status de estoque e categoria", () => {
    it("260 un. com consumo de 13/dia é BAIXO_ESTOQUE (<= 20 dias); 261 já é REGULAR", async () => {
      const baixo = await consultar(MUN_A, UBS_A1, { statusEstoque: "BAIXO_ESTOQUE" });
      expect(nomes(baixo)).toEqual([NOME[3]]);
      expect(baixo.itens[0].statusEstoque).toBe("BAIXO_ESTOQUE");

      const regular = await consultar(MUN_A, UBS_A1, { statusEstoque: "REGULAR" });
      expect(nomes(regular)).toEqual([NOME[1], NOME[4], NOME[5], NOME[6], NOME[7], NOME[8]]);
      expect(regular.itens.find((i) => i.produtoId === P(4))?.statusEstoque).toBe("REGULAR");
    });

    it("ZERADO traz só o medicamento sem saldo", async () => {
      const r = await consultar(MUN_A, UBS_A1, { statusEstoque: "ZERADO" });
      expect(nomes(r)).toEqual([NOME[2]]);
    });

    it("filtro do SQL e rótulo do TypeScript concordam em todos os medicamentos", async () => {
      const todos = await consultar(MUN_A, UBS_A1);
      for (const item of todos.itens) {
        const filtrado = await consultar(MUN_A, UBS_A1, { statusEstoque: item.statusEstoque });
        expect(filtrado.itens.map((i) => i.produtoId)).toContain(item.produtoId);
      }
    });

    it("categoria sem diferenciar caixa", async () => {
      for (const categoria of ["antimicrobiano", "ANTIMICROBIANO"]) {
        const r = await consultar(MUN_A, UBS_A1, { categoria });
        expect(nomes(r)).toEqual([NOME[3]]);
      }
    });
  });

  describe("isolamento entre UBSs e municípios (RLS)", () => {
    it("UBS A2 vê só o próprio saldo e não herda o consumo da A1", async () => {
      const r = await consultar(MUN_A, UBS_A2);
      expect(r.total).toBe(2);
      const p1 = r.itens.find((i) => i.produtoId === P(1));
      expect(p1?.saldoTotal).toBe(7);
      expect(p1?.lotes.map((l) => l.numeroLote)).toEqual(["A2-P1"]);
      // Se o consumo da A1 vazasse, 10 un. com 13/dia seria BAIXO_ESTOQUE.
      const p3 = r.itens.find((i) => i.produtoId === P(3));
      expect(p3).toMatchObject({ saldoTotal: 10, statusEstoque: "REGULAR" });
    });

    it("o município B não enxerga a UBS A1, mesmo filtrando o ubs_id dela", async () => {
      const r = await consultar(MUN_B, UBS_A1);
      expect(r.total).toBe(0);
      expect(r.itens).toEqual([]);
    });

    it("cada município vê apenas as próprias UBSs", async () => {
      const comoB = await consultar(MUN_B, UBS_B1);
      expect(comoB.total).toBe(1);
      expect(comoB.itens[0].saldoTotal).toBe(3);

      const comoA = await consultar(MUN_A, UBS_B1);
      expect(comoA.total).toBe(0);
    });

    it("fail-closed: sem o GUC de município, nada é visível", async () => {
      const r = await consultar(null, UBS_A1);
      expect(r.total).toBe(0);
      expect(r.itens).toEqual([]);
    });
  });
});
