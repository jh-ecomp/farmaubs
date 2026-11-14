import { DataSource, QueryRunner } from "typeorm";
import type {
  AjusteEstoqueResultadoDto,
  RegistrarAjusteLoteInputDto,
} from "@farmaubs/shared";
import { adminDatabaseUrl, appDatabaseUrl } from "../test-db";
import { TransactionContext } from "../../src/common/transaction/transaction-context.service";
import { EstoqueAjustesPgRepository } from "../../src/modules/estoque/infrastructure/adapters/estoque-ajustes-pg.repository";
import { RegistrarAjusteEstoqueUseCase } from "../../src/modules/estoque/application/use-cases/registrar-ajuste-estoque.use-case";
import {
  LoteNaoEncontradoException,
  SaldoInsuficienteException,
} from "../../src/modules/estoque/domain/errors/ajuste-estoque.errors";

/**
 * ES-03 (#244) - Camada B (ADR-030): ajustes de estoque contra PostgreSQL real, conectando como
 * farmaubs_app (RLS ativo). Cada "requisição" roda numa transação própria, como o TransactionInterceptor.
 * Prova o SELECT ... FOR UPDATE (sem o lock, dois ajustes leriam o mesmo saldo e o CHECK do banco não pegaria).
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
const EMAIL_SUFIXO = "@estoque-ajustes.test";
const JUSTIFICATIVA = "Ajuste de teste de integração de concorrência";

const CONTEXTO_A1 = {
  usuarioId: USER_A,
  usuarioNome: "Farmacêutico Ajustes A",
  unidadeIds: [UBS_A1],
};

const esperar = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const ajuste = (
  tipoOperacao: "ENTRADA" | "SAIDA",
  quantidade: number,
  motivo: RegistrarAjusteLoteInputDto["motivo"],
): RegistrarAjusteLoteInputDto => ({
  tipoOperacao,
  quantidade,
  motivo,
  justificativa: JUSTIFICATIVA,
});

describe("RegistrarAjusteEstoqueUseCase + EstoqueAjustesPgRepository - integração (farmaubs_app, RLS)", () => {
  let admin: DataSource;
  let app: DataSource;
  let transactionContext: TransactionContext;
  let casoDeUso: RegistrarAjusteEstoqueUseCase;

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

  const ajustar = (
    municipioId: string,
    loteId: string,
    requisicao: RegistrarAjusteLoteInputDto,
    contexto = CONTEXTO_A1,
  ): Promise<AjusteEstoqueResultadoDto> =>
    executarNoTenant(municipioId, () =>
      casoDeUso.execute(loteId, requisicao, contexto),
    );

  async function inserirLote(
    municipioId: string,
    ubsId: string,
    numero: string,
    saldo: number,
  ): Promise<string> {
    const rows = await admin.query(
      `INSERT INTO lotes (municipio_id, ubs_id, produto_id, fabricante_id,
         numero_lote, data_validade, saldo_atual, status)
       VALUES ($1, $2, $3, $4, $5, '2030-01-01', $6, 'ATIVO') RETURNING id`,
      [municipioId, ubsId, PRODUTO, FABRICANTE, numero, saldo],
    );
    return rows[0].id;
  }

  async function saldoDoLote(loteId: string): Promise<number> {
    const rows = await admin.query(
      `SELECT saldo_atual FROM lotes WHERE id = $1::uuid`,
      [loteId],
    );
    return Number(rows[0].saldo_atual);
  }

  async function movimentacoes(loteId: string): Promise<any[]> {
    return admin.query(
      `SELECT tipo_movimentacao, quantidade, saldo_anterior, saldo_posterior,
              usuario_id, motivo, justificativa
         FROM movimentacoes_estoque
        WHERE lote_id = $1::uuid
        ORDER BY saldo_anterior`,
      [loteId],
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

    await limpar();

    const perfil = await admin.query(`SELECT id FROM perfis LIMIT 1`);
    const perfilId: string = perfil[0].id;

    await admin.query(
      `INSERT INTO municipios (id, nome, uf, codigo_ibge) VALUES
         ($1, 'Município Ajustes A', 'PI', '9900021'),
         ($2, 'Município Ajustes B', 'PI', '9900022')`,
      [MUN_A, MUN_B],
    );
    await admin.query(
      `INSERT INTO unidades_saude (id, municipio_id, nome) VALUES
         ($1, $4, 'UBS Ajustes A1'),
         ($2, $4, 'UBS Ajustes A2'),
         ($3, $5, 'UBS Ajustes B1')`,
      [UBS_A1, UBS_A2, UBS_B1, MUN_A, MUN_B],
    );
    await admin.query(
      `INSERT INTO fabricantes (id, razao_social, nome_fantasia)
       VALUES ($1, 'Fabricante Ajustes Teste', 'Fab Ajustes')`,
      [FABRICANTE],
    );
    await admin.query(
      `INSERT INTO users (id, nome_completo, email, senha_hash, perfil_id, municipio_id)
       VALUES ($1, 'Farmacêutico Ajustes A', $2, 'hash-dummy', $3, $4)`,
      [USER_A, `a${EMAIL_SUFIXO}`, perfilId, MUN_A],
    );
    await admin.query(
      `INSERT INTO produtos (id, nome_comercial, principio_ativo, apresentacao, categoria, ativo)
       VALUES ($1, 'Ajustes 01 Dipirona', 'Dipirona sódica', 'Comprimido 500 mg', 'GERAL', true)`,
      [PRODUTO],
    );

    transactionContext = new TransactionContext(app);
    casoDeUso = new RegistrarAjusteEstoqueUseCase(
      new EstoqueAjustesPgRepository(transactionContext),
    );
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

  it("duas saídas concorrentes de 7 em saldo 10: só uma passa, a outra recebe SaldoInsuficiente e o saldo fecha em 3", async () => {
    const lote = await inserirLote(MUN_A, UBS_A1, "AJ-SAIDAS", 10);
    const saida = ajuste("SAIDA", 7, "AVARIA_FISICA");

    const resultados = await Promise.allSettled([
      ajustar(MUN_A, lote, saida),
      ajustar(MUN_A, lote, saida),
    ]);

    const falhas = resultados.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(falhas).toHaveLength(1);
    expect(falhas[0].reason).toBeInstanceOf(SaldoInsuficienteException);
    expect(await saldoDoLote(lote)).toBe(3);

    const movs = await movimentacoes(lote);
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({
      tipo_movimentacao: "AJUSTE_SAIDA",
      quantidade: 7,
      saldo_anterior: 10,
      saldo_posterior: 3,
      motivo: "AVARIA_FISICA",
    });
  });

  it("duas entradas concorrentes de 5 em saldo 10: sem atualização perdida (saldo 20, cadeia 10→15→20) e auditoria completa", async () => {
    const lote = await inserirLote(MUN_A, UBS_A1, "AJ-ENTRADAS", 10);
    const entrada = ajuste("ENTRADA", 5, "CORRECAO_INVENTARIO");

    await Promise.all([
      ajustar(MUN_A, lote, entrada),
      ajustar(MUN_A, lote, entrada),
    ]);

    expect(await saldoDoLote(lote)).toBe(20);
    const movs = await movimentacoes(lote);
    expect(movs.map((m) => [m.saldo_anterior, m.saldo_posterior])).toEqual([
      [10, 15],
      [15, 20],
    ]);
    for (const m of movs) {
      expect(m).toMatchObject({
        tipo_movimentacao: "AJUSTE_ENTRADA",
        quantidade: 5,
        usuario_id: USER_A,
        motivo: "CORRECAO_INVENTARIO",
        justificativa: JUSTIFICATIVA,
      });
    }
  });

  it("o ajuste espera o lock de outra transação e parte do saldo já commitado (não do valor antigo)", async () => {
    const lote = await inserirLote(MUN_A, UBS_A1, "AJ-LOCK", 10);

    // Transação "concorrente" que segura o lock do lote.
    const qr1 = app.createQueryRunner();
    await qr1.connect();
    await qr1.startTransaction();
    let pendente: Promise<AjusteEstoqueResultadoDto> | undefined;
    try {
      await qr1.query(`SELECT set_config('app.municipio_id', $1, true)`, [
        MUN_A,
      ]);
      await qr1.query(
        `SELECT id FROM public.lotes WHERE id = $1::uuid FOR UPDATE`,
        [lote],
      );

      pendente = ajustar(
        MUN_A,
        lote,
        ajuste("ENTRADA", 5, "CORRECAO_INVENTARIO"),
      );
      pendente.catch(() => undefined);

      const estado = await Promise.race([
        pendente.then(() => "concluiu"),
        esperar(500).then(() => "bloqueado"),
      ]);
      expect(estado).toBe("bloqueado");

      await qr1.query(
        `UPDATE public.lotes SET saldo_atual = 20 WHERE id = $1::uuid`,
        [lote],
      );
      await qr1.commitTransaction();
    } catch (error) {
      await qr1.rollbackTransaction().catch(() => undefined);
      throw error;
    } finally {
      await qr1.release();
    }

    if (!pendente) throw new Error("ajuste não iniciado");
    const resultado = await pendente;

    expect(resultado.saldoAnterior).toBe(20);
    expect(resultado.saldoAtualizado).toBe(25);
    expect(await saldoDoLote(lote)).toBe(25);
    expect(await movimentacoes(lote)).toHaveLength(1);
  });

  it("saída acima do saldo dá rollback: saldo inalterado e nenhuma movimentação", async () => {
    const lote = await inserirLote(MUN_A, UBS_A1, "AJ-ACIMA", 5);

    await expect(
      ajustar(MUN_A, lote, ajuste("SAIDA", 10, "EXTRAVIO")),
    ).rejects.toBeInstanceOf(SaldoInsuficienteException);

    expect(await saldoDoLote(lote)).toBe(5);
    expect(await movimentacoes(lote)).toHaveLength(0);
  });

  it("lote de outro município (RLS) e de outra UBS do mesmo município dão LoteNaoEncontrado, sem alterar nada", async () => {
    const loteOutroMunicipio = await inserirLote(MUN_B, UBS_B1, "AJ-RLS-B", 8);
    const loteOutraUbs = await inserirLote(MUN_A, UBS_A2, "AJ-UBS-A2", 8);
    const entrada = ajuste("ENTRADA", 5, "CORRECAO_INVENTARIO");

    await expect(
      ajustar(MUN_A, loteOutroMunicipio, entrada),
    ).rejects.toBeInstanceOf(LoteNaoEncontradoException);
    await expect(ajustar(MUN_A, loteOutraUbs, entrada)).rejects.toBeInstanceOf(
      LoteNaoEncontradoException,
    );

    for (const lote of [loteOutroMunicipio, loteOutraUbs]) {
      expect(await saldoDoLote(lote)).toBe(8);
      expect(await movimentacoes(lote)).toHaveLength(0);
    }
  });
});
