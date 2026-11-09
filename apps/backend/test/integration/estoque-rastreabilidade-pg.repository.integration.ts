import { DataSource, QueryRunner } from "typeorm";
import { adminDatabaseUrl, appDatabaseUrl } from "../test-db";
import { TransactionContext } from "../../src/common/transaction/transaction-context.service";
import { EstoqueRastreabilidadePgRepository } from "../../src/modules/estoque/infrastructure/adapters/estoque-rastreabilidade-pg.repository";
import {
  ConsultarRastreabilidadeLoteUseCase,
  ordenarPorCadeia,
} from "../../src/modules/estoque/application/use-cases/consultar-rastreabilidade-lote.use-case";

/**
 * ES-04 (#245) - Camada B (ADR-030): rastreabilidade de lote contra PostgreSQL real,
 * conectando como farmaubs_app (RLS por município ativo). Cada "requisição" roda numa
 * transação própria, como o TransactionInterceptor. O isolamento entre UBSs do mesmo município
 * vem só do filtro `ubs_id = ANY($2)`; o isolamento entre municípios vem do RLS.
 */

jest.setTimeout(30000);

const uid = (sufixo: string): string =>
  `6e000000-0000-4000-8000-${sufixo.padStart(12, "0")}`;
const MUN_A = uid("a");
const MUN_B = uid("b");
const UBS_A1 = uid("a1");
const UBS_A2 = uid("a2");
const UBS_B1 = uid("b1");
const FABRICANTE = uid("d1");
const PRODUTO = uid("c1");
const USER_A = uid("e1");
const USER_B = uid("e2");
const PACIENTE = uid("f1");
const EMAIL_SUFIXO = "@estoque-rastreab.test";
const NOME_USER_A = "Farmacêutico Rastreab A";

interface Executor {
  query: (sql: string, params?: unknown[]) => Promise<any>;
}

interface NovaMovimentacao {
  id?: string;
  municipioId: string;
  ubsId: string;
  loteId: string;
  tipo: string;
  quantidade: number;
  anterior: number;
  posterior: number;
  usuarioId: string;
  criadoEm?: string;
  documentoId?: string;
  tipoDocumento?: string;
  motivo?: string;
  justificativa?: string;
}

describe("EstoqueRastreabilidadePgRepository - integração (farmaubs_app, RLS)", () => {
  let admin: DataSource;
  let app: DataSource;
  let transactionContext: TransactionContext;
  let repo: EstoqueRastreabilidadePgRepository;

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

  const buscar = (municipioId: string, loteId: string, unidadeIds: string[]) =>
    executarNoTenant(municipioId, () =>
      repo.buscarLinhaDoTempoLote(loteId, unidadeIds),
    );

  async function inserirLote(
    municipioId: string,
    ubsId: string,
    numero: string,
    saldo: number,
    criadoEm = "2026-01-01T09:00:00.000Z",
  ): Promise<string> {
    const rows = await admin.query(
      `INSERT INTO lotes (municipio_id, ubs_id, produto_id, fabricante_id,
         numero_lote, data_validade, saldo_atual, status, created_at)
       VALUES ($1, $2, $3, $4, $5, '2030-01-01', $6, 'ATIVO', $7::timestamptz)
       RETURNING id`,
      [municipioId, ubsId, PRODUTO, FABRICANTE, numero, saldo, criadoEm],
    );
    return rows[0].id;
  }

  async function inserirMovimentacao(
    m: NovaMovimentacao,
    exec: Executor = admin,
  ): Promise<void> {
    await exec.query(
      `INSERT INTO movimentacoes_estoque
         (id, municipio_id, ubs_id, lote_id, tipo_movimentacao, quantidade,
          saldo_anterior, saldo_posterior, documento_referencia_id,
          tipo_documento_referencia, usuario_id, motivo, justificativa, created_at)
       VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8,
               $9::uuid, $10, $11, $12, $13, COALESCE($14::timestamptz, now()))`,
      [
        m.id ?? null,
        m.municipioId,
        m.ubsId,
        m.loteId,
        m.tipo,
        m.quantidade,
        m.anterior,
        m.posterior,
        m.documentoId ?? null,
        m.tipoDocumento ?? null,
        m.usuarioId,
        m.motivo ?? null,
        m.justificativa ?? null,
        m.criadoEm ?? null,
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
      `DELETE FROM dispensacoes WHERE municipio_id = ANY($1::uuid[])`,
      [muns],
    );
    await admin.query(
      `DELETE FROM pacientes WHERE municipio_id = ANY($1::uuid[])`,
      [muns],
    );
    await admin.query(
      `DELETE FROM documentos_entrada WHERE municipio_id = ANY($1::uuid[])`,
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

    await limpar();

    const perfil = await admin.query(`SELECT id FROM perfis LIMIT 1`);
    const perfilId: string = perfil[0].id;

    await admin.query(
      `INSERT INTO municipios (id, nome, uf, codigo_ibge) VALUES
         ($1, 'Município Rastreab A', 'PI', '9900031'),
         ($2, 'Município Rastreab B', 'PI', '9900032')`,
      [MUN_A, MUN_B],
    );
    await admin.query(
      `INSERT INTO unidades_saude (id, municipio_id, nome) VALUES
         ($1, $4, 'UBS Rastreab A1'),
         ($2, $4, 'UBS Rastreab A2'),
         ($3, $5, 'UBS Rastreab B1')`,
      [UBS_A1, UBS_A2, UBS_B1, MUN_A, MUN_B],
    );
    await admin.query(
      `INSERT INTO fabricantes (id, razao_social, nome_fantasia)
       VALUES ($1, 'Fabricante Rastreab Teste', 'Fab Rastreab')`,
      [FABRICANTE],
    );
    await admin.query(
      `INSERT INTO users (id, nome_completo, email, senha_hash, perfil_id, municipio_id) VALUES
         ($1, $5, $2, 'hash-dummy', $3, $4),
         ($6, 'Farmacêutico Rastreab B', $7, 'hash-dummy', $3, $8)`,
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
    await admin.query(
      `INSERT INTO produtos (id, nome_comercial, principio_ativo, apresentacao, categoria, ativo,
         codigo_catmat, codigo_atc, forma_farmaceutica, dosagem)
       VALUES ($1, 'Rastreab Dipirona', 'Dipirona sódica', 'Comprimido 500 mg', 'GERAL', true,
         'BR0267789', 'N02BB02', 'Comprimido', '500 mg')`,
      [PRODUTO],
    );
    await admin.query(
      `INSERT INTO pacientes (id, municipio_id, cns, cpf, nome_completo, data_nascimento)
       VALUES ($1, $2, '700000000000001', '99999999901', 'Paciente Rastreab', '1990-01-01')`,
      [PACIENTE, MUN_A],
    );

    transactionContext = new TransactionContext(app);
    repo = new EstoqueRastreabilidadePgRepository(transactionContext);
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

  it("devolve cabeçalho do lote, dados do medicamento e as movimentações em ordem cronológica", async () => {
    const lote = await inserirLote(MUN_A, UBS_A1, "RT-CABECALHO", 460);
    const base = { municipioId: MUN_A, ubsId: UBS_A1, loteId: lote, usuarioId: USER_A };
    await inserirMovimentacao({ ...base, tipo: "ENTRADA_RECEBIMENTO", quantidade: 500, anterior: 0, posterior: 500, criadoEm: "2026-01-01T10:00:00.000Z" });
    await inserirMovimentacao({ ...base, tipo: "SAIDA_DISPENSACAO", quantidade: 30, anterior: 500, posterior: 470, criadoEm: "2026-01-02T10:00:00.000Z" });
    await inserirMovimentacao({ ...base, tipo: "AJUSTE_SAIDA", quantidade: 10, anterior: 470, posterior: 460, criadoEm: "2026-01-03T10:00:00.000Z", motivo: "AVARIA_FISICA", justificativa: "Quebra no armazenamento" });

    const r = await buscar(MUN_A, lote, [UBS_A1]);
    if (!r) throw new Error("lote deveria ser encontrado");

    expect(r.lote).toMatchObject({
      id: lote,
      numeroLote: "RT-CABECALHO",
      dataValidade: "2030-01-01",
      dataCadastro: "2026-01-01T09:00:00.000Z",
      saldoAtual: 460,
      fabricanteNome: "Fab Rastreab",
    });
    expect(r.medicamento).toMatchObject({
      id: PRODUTO,
      nome: "Rastreab Dipirona",
      principioAtivo: "Dipirona sódica",
      apresentacao: "Comprimido 500 mg",
      codigoCatmat: "BR0267789",
      codigoAtc: "N02BB02",
      formaFarmaceutica: "Comprimido",
      concentracao: "500 mg",
    });
    expect(r.movimentacoes.map((m) => m.tipoBanco)).toEqual([
      "ENTRADA_RECEBIMENTO",
      "SAIDA_DISPENSACAO",
      "AJUSTE_SAIDA",
    ]);
    expect(r.movimentacoes.map((m) => m.operacao)).toEqual(["+", "-", "-"]);
    expect(
      r.movimentacoes.map((m) => [m.saldoAnterior, m.saldoResultante]),
    ).toEqual([
      [0, 500],
      [500, 470],
      [470, 460],
    ]);
    expect(r.movimentacoes[2]).toMatchObject({
      quantidade: 10,
      motivo: "AVARIA_FISICA",
      justificativa: "Quebra no armazenamento",
      usuarioResponsavel: { id: USER_A, nome: NOME_USER_A },
    });
  });

  it("desempata eventos da mesma transação pela cadeia de saldos (UUID não é cronológico)", async () => {
    const lote = await inserirLote(MUN_A, UBS_A1, "RT-DESEMPATE", 30);
    // ids em ordem inversa à cadeia: o ORDER BY created_at, id devolve C, B, A
    const idA = uid("c3");
    const idB = uid("c2");
    const idC = uid("c1");
    const base = { municipioId: MUN_A, ubsId: UBS_A1, loteId: lote, usuarioId: USER_A, tipo: "AJUSTE_ENTRADA", quantidade: 10, motivo: "CORRECAO_INVENTARIO", justificativa: "Entradas na mesma transação" };

    const qr = admin.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await inserirMovimentacao({ ...base, id: idA, anterior: 0, posterior: 10 }, qr);
      await inserirMovimentacao({ ...base, id: idB, anterior: 10, posterior: 20 }, qr);
      await inserirMovimentacao({ ...base, id: idC, anterior: 20, posterior: 30 }, qr);
      await qr.commitTransaction();
    } catch (error) {
      await qr.rollbackTransaction().catch(() => undefined);
      throw error;
    } finally {
      await qr.release();
    }

    const bruta = await buscar(MUN_A, lote, [UBS_A1]);
    if (!bruta) throw new Error("lote deveria ser encontrado");

    // o SQL empata no created_at (now() é o início da transação)
    expect(new Set(bruta.movimentacoes.map((m) => m.dataHora)).size).toBe(1);
    expect(bruta.movimentacoes.map((m) => m.id)).toEqual([idC, idB, idA]);
    expect(ordenarPorCadeia(bruta.movimentacoes).map((m) => m.id)).toEqual([
      idA,
      idB,
      idC,
    ]);

    // e o caso de uso entrega a linha do tempo na ordem real
    const useCase = new ConsultarRastreabilidadeLoteUseCase(repo);
    const dto = await executarNoTenant(MUN_A, () =>
      useCase.execute(lote, [UBS_A1]),
    );
    expect(dto.movimentacoes.map((m) => m.id)).toEqual([idA, idB, idC]);
    expect(dto.movimentacoes.map((m) => m.saldoResultante)).toEqual([10, 20, 30]);
    expect(dto.lote.saldoInicial).toBe(10);
    expect(dto.lote.saldoAtual).toBe(30);
  });

  it("resolve a referência de documento: entrada (numero_documento), dispensa (numero_atendimento) e ajuste sem documento", async () => {
    const lote = await inserirLote(MUN_A, UBS_A1, "RT-DOCUMENTOS", 95);

    const doc = await admin.query(
      `INSERT INTO documentos_entrada (municipio_id, ubs_id, numero_documento, fornecedor_origem, usuario_recebedor_id)
       VALUES ($1, $2, 'CAF-RASTREAB-001', 'CAF Teste', $3) RETURNING id`,
      [MUN_A, UBS_A1, USER_A],
    );
    const disp = await admin.query(
      `INSERT INTO dispensacoes (municipio_id, unidade_id, paciente_id, dispensador_id, numero_atendimento)
       VALUES ($1, $2, $3, $4, 'ATD-RASTREAB-001') RETURNING id`,
      [MUN_A, UBS_A1, PACIENTE, USER_A],
    );

    const base = { municipioId: MUN_A, ubsId: UBS_A1, loteId: lote, usuarioId: USER_A };
    await inserirMovimentacao({ ...base, tipo: "ENTRADA_RECEBIMENTO", quantidade: 100, anterior: 0, posterior: 100, criadoEm: "2026-02-01T10:00:00.000Z", documentoId: doc[0].id, tipoDocumento: "DOCUMENTO_ENTRADA" });
    await inserirMovimentacao({ ...base, tipo: "SAIDA_DISPENSACAO", quantidade: 3, anterior: 100, posterior: 97, criadoEm: "2026-02-02T10:00:00.000Z", documentoId: disp[0].id, tipoDocumento: "DISPENSACAO" });
    await inserirMovimentacao({ ...base, tipo: "AJUSTE_SAIDA", quantidade: 2, anterior: 97, posterior: 95, criadoEm: "2026-02-03T10:00:00.000Z", motivo: "VENCIMENTO", justificativa: "Unidades vencidas" });

    const r = await buscar(MUN_A, lote, [UBS_A1]);
    if (!r) throw new Error("lote deveria ser encontrado");

    expect(r.movimentacoes.map((m) => m.documentoReferencia)).toEqual([
      "CAF-RASTREAB-001",
      "ATD-RASTREAB-001",
      undefined,
    ]);
  });

  it("devolve null para lote de outra UBS do mesmo município (só o filtro ubs_id protege)", async () => {
    const lote = await inserirLote(MUN_A, UBS_A2, "RT-OUTRA-UBS", 50);
    await inserirMovimentacao({ municipioId: MUN_A, ubsId: UBS_A2, loteId: lote, usuarioId: USER_A, tipo: "ENTRADA_RECEBIMENTO", quantidade: 50, anterior: 0, posterior: 50 });

    expect(await buscar(MUN_A, lote, [UBS_A1])).toBeNull();

    const controle = await buscar(MUN_A, lote, [UBS_A2]);
    expect(controle?.lote.numeroLote).toBe("RT-OUTRA-UBS");
    expect(controle?.movimentacoes).toHaveLength(1);
  });

  it("devolve null para lote de outro município (RLS), mesmo informando a UBS dele em unidadeIds", async () => {
    const lote = await inserirLote(MUN_B, UBS_B1, "RT-OUTRO-MUN", 20);
    await inserirMovimentacao({ municipioId: MUN_B, ubsId: UBS_B1, loteId: lote, usuarioId: USER_B, tipo: "ENTRADA_RECEBIMENTO", quantidade: 20, anterior: 0, posterior: 20 });

    expect(await buscar(MUN_A, lote, [UBS_B1])).toBeNull();

    const controle = await buscar(MUN_B, lote, [UBS_B1]);
    expect(controle?.lote.numeroLote).toBe("RT-OUTRO-MUN");
    expect(controle?.movimentacoes).toHaveLength(1);
  });
});

