import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { DataSource } from "typeorm";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { adminDatabaseUrl } from "./test-db";

/**
 * ES-03 (#244) - Camada C: POST /api/v1/estoque/lotes/:loteId/ajustes de ponta a ponta
 * (guards, validação, caso de uso, PostgreSQL com RLS) e persistência de saldo e histórico.
 */

const uid = (sufixo: string): string =>
  `7f000000-0000-4000-8000-${sufixo.padStart(12, "0")}`;
const MUN_A = uid("a");
const MUN_B = uid("b");
const UBS_A1 = uid("a1");
const UBS_A2 = uid("a2");
const UBS_B1 = uid("b1");
const FABRICANTE = uid("d1");
const PRODUTO = uid("c1");
const USER_FARMA = uid("e1");
const EMAIL_SUFIXO = "@estoque-ajustes-e2e.test";
const EMAIL_FARMA = `farmaceutico${EMAIL_SUFIXO}`;
const SENHA_FARMA = "Ajustes@123456";
const JUSTIFICATIVA = "Justificativa com tamanho válido para o ajuste";

describe("POST /api/v1/estoque/lotes/:loteId/ajustes (E2E - camada C)", () => {
  let app: INestApplication;
  let admin: DataSource;
  let tokenFarma: string;
  let contador = 0;

  const server = (): Server => app.getHttpServer() as Server;

  async function login(email: string, senha: string): Promise<string> {
    const res = await request(server())
      .post("/api/v1/acesso/login")
      .send({ email, senha });
    expect(res.status).toBe(200);
    const token = res.headers.authorization;
    expect(token).toMatch(/^Bearer [0-9a-f]{64}$/);
    return token as string;
  }

  const postar = (token: string | null, loteId: string, corpo: object) => {
    const req = request(server()).post(
      `/api/v1/estoque/lotes/${loteId}/ajustes`,
    );
    if (token) req.set("Authorization", token);
    return req.send(corpo);
  };

  async function inserirLote(
    municipioId: string,
    ubsId: string,
    saldo: number,
  ): Promise<string> {
    contador += 1;
    const rows = await admin.query(
      `INSERT INTO lotes (municipio_id, ubs_id, produto_id, fabricante_id,
         numero_lote, data_validade, saldo_atual, status)
       VALUES ($1, $2, $3, $4, $5, '2030-01-01', $6, 'ATIVO') RETURNING id`,
      [municipioId, ubsId, PRODUTO, FABRICANTE, `E2E-${contador}`, saldo],
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

  const movimentacoes = (loteId: string): Promise<any[]> =>
    admin.query(
      `SELECT municipio_id, ubs_id, tipo_movimentacao, quantidade, saldo_anterior,
              saldo_posterior, usuario_id, motivo, justificativa
         FROM movimentacoes_estoque
        WHERE lote_id = $1::uuid
        ORDER BY created_at`,
      [loteId],
    );

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
    // Remove o que referenciar o usuário de teste (vínculos com UBS, sessões, etc.), seja qual for a tabela.
    const ids = (
      await admin.query(`SELECT id FROM users WHERE email LIKE $1`, [
        `%${EMAIL_SUFIXO}`,
      ])
    ).map((u: { id: string }) => u.id);
    if (ids.length > 0) {
      const refs = await admin.query(
        `SELECT c.conrelid::regclass::text AS tabela, a.attname AS coluna
           FROM pg_constraint c
           JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
          WHERE c.contype = 'f'
            AND c.confrelid = 'public.users'::regclass
            AND c.conrelid <> 'public.users'::regclass
            AND array_length(c.conkey, 1) = 1`,
      );
      for (const r of refs) {
        await admin.query(
          `DELETE FROM ${r.tabela} WHERE ${r.coluna} = ANY($1::uuid[])`,
          [ids],
        );
      }
    }
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
    await admin.initialize();
    await limpar();

    const perfil = await admin.query(
      `SELECT id FROM perfis WHERE codigo = 'FARMACEUTICO_RESPONSAVEL'`,
    );
    await admin.query(
      `INSERT INTO municipios (id, nome, uf, codigo_ibge) VALUES
         ($1, 'Município Ajustes E2E A', 'PI', '9900031'),
         ($2, 'Município Ajustes E2E B', 'PI', '9900032')`,
      [MUN_A, MUN_B],
    );
    await admin.query(
      `INSERT INTO unidades_saude (id, municipio_id, nome) VALUES
         ($1, $4, 'UBS Ajustes E2E A1'),
         ($2, $4, 'UBS Ajustes E2E A2'),
         ($3, $5, 'UBS Ajustes E2E B1')`,
      [UBS_A1, UBS_A2, UBS_B1, MUN_A, MUN_B],
    );
    await admin.query(
      `INSERT INTO fabricantes (id, razao_social, nome_fantasia)
       VALUES ($1, 'Fabricante Ajustes E2E', 'Fab Ajustes E2E')`,
      [FABRICANTE],
    );
    await admin.query(
      `INSERT INTO produtos (id, nome_comercial, principio_ativo, apresentacao, categoria, ativo)
       VALUES ($1, 'Ajustes E2E Dipirona', 'Dipirona sódica', 'Comprimido 500 mg', 'GERAL', true)`,
      [PRODUTO],
    );
    await admin.query(
      `INSERT INTO users (id, municipio_id, nome_completo, email, senha_hash, perfil_id,
                          ativo, deve_trocar_senha, tentativas_login_falhas, senha_atualizada_em)
       VALUES ($1, $2, 'Farmacêutico Ajustes E2E', $3, $4, $5, true, false, 0, now())`,
      [
        USER_FARMA,
        MUN_A,
        EMAIL_FARMA,
        await bcrypt.hash(SENHA_FARMA, 4),
        perfil[0].id,
      ],
    );
    await admin.query(
      `INSERT INTO user_units (usuario_id, unidade_id, ativo) VALUES ($1, $2, true)`,
      [USER_FARMA, UBS_A1],
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    tokenFarma = await login(EMAIL_FARMA, SENHA_FARMA);
  });

  afterAll(async () => {
    if (app) await app.close();
    if (admin?.isInitialized) {
      await limpar();
      await admin.destroy();
    }
  });

  it("201: entrada por devolução soma ao saldo e persiste saldo e histórico", async () => {
    const lote = await inserirLote(MUN_A, UBS_A1, 10);

    const res = await postar(tokenFarma, lote, {
      tipoOperacao: "ENTRADA",
      quantidade: 5,
      motivo: "DEVOLUCAO_PACIENTE",
      justificativa: JUSTIFICATIVA,
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      loteId: lote,
      tipoOperacao: "ENTRADA",
      quantidadeAjustada: 5,
      saldoAnterior: 10,
      saldoAtualizado: 15,
      motivo: "DEVOLUCAO_PACIENTE",
      justificativa: JUSTIFICATIVA,
      realizadoPor: { id: USER_FARMA, nome: "Farmacêutico Ajustes E2E" },
    });
    expect(res.body.movimentacaoId).toEqual(expect.any(String));
    expect(res.body.dataHora).toEqual(expect.any(String));

    expect(await saldoDoLote(lote)).toBe(15);
    const movs = await movimentacoes(lote);
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({
      municipio_id: MUN_A,
      ubs_id: UBS_A1,
      tipo_movimentacao: "AJUSTE_ENTRADA",
      quantidade: 5,
      saldo_anterior: 10,
      saldo_posterior: 15,
      usuario_id: USER_FARMA,
      motivo: "DEVOLUCAO_PACIENTE",
      justificativa: JUSTIFICATIVA,
    });
  });

  it("201: saída por avaria subtrai do saldo e registra AJUSTE_SAIDA", async () => {
    const lote = await inserirLote(MUN_A, UBS_A1, 15);

    const res = await postar(tokenFarma, lote, {
      tipoOperacao: "SAIDA",
      quantidade: 2,
      motivo: "AVARIA_FISICA",
      justificativa: JUSTIFICATIVA,
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ saldoAnterior: 15, saldoAtualizado: 13 });
    expect(await saldoDoLote(lote)).toBe(13);
    const movs = await movimentacoes(lote);
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({
      tipo_movimentacao: "AJUSTE_SAIDA",
      quantidade: 2,
      saldo_anterior: 15,
      saldo_posterior: 13,
      motivo: "AVARIA_FISICA",
    });
  });

  it("201: dois ajustes seguidos formam a cadeia de saldos no histórico", async () => {
    const lote = await inserirLote(MUN_A, UBS_A1, 10);
    const corpo = {
      tipoOperacao: "ENTRADA",
      quantidade: 5,
      motivo: "CORRECAO_INVENTARIO",
      justificativa: JUSTIFICATIVA,
    };

    expect((await postar(tokenFarma, lote, corpo)).status).toBe(201);
    expect((await postar(tokenFarma, lote, corpo)).status).toBe(201);

    expect(await saldoDoLote(lote)).toBe(20);
    const movs = await movimentacoes(lote);
    expect(movs.map((m) => [m.saldo_anterior, m.saldo_posterior])).toEqual([
      [10, 15],
      [15, 20],
    ]);
  });

  it("422: saída maior que o saldo não altera o saldo nem grava movimentação", async () => {
    const lote = await inserirLote(MUN_A, UBS_A1, 5);

    const res = await postar(tokenFarma, lote, {
      tipoOperacao: "SAIDA",
      quantidade: 10,
      motivo: "EXTRAVIO",
      justificativa: JUSTIFICATIVA,
    });

    expect(res.status).toBe(422);
    expect(await saldoDoLote(lote)).toBe(5);
    expect(await movimentacoes(lote)).toHaveLength(0);
  });

  it.each([
    [
      "motivo incompatível com o tipo",
      {
        tipoOperacao: "SAIDA",
        quantidade: 1,
        motivo: "DEVOLUCAO_PACIENTE",
        justificativa: JUSTIFICATIVA,
      },
    ],
    [
      "justificativa com menos de 10 caracteres",
      {
        tipoOperacao: "ENTRADA",
        quantidade: 1,
        motivo: "CORRECAO_INVENTARIO",
        justificativa: "curta",
      },
    ],
    [
      "motivo OUTRO com justificativa de 15 caracteres (mínimo 20)",
      {
        tipoOperacao: "ENTRADA",
        quantidade: 1,
        motivo: "OUTRO",
        justificativa: "quinze caracter",
      },
    ],
    [
      "quantidade zero",
      {
        tipoOperacao: "ENTRADA",
        quantidade: 0,
        motivo: "CORRECAO_INVENTARIO",
        justificativa: JUSTIFICATIVA,
      },
    ],
    [
      "quantidade não inteira",
      {
        tipoOperacao: "ENTRADA",
        quantidade: 1.5,
        motivo: "CORRECAO_INVENTARIO",
        justificativa: JUSTIFICATIVA,
      },
    ],
    [
      "tipo de operação desconhecido",
      {
        tipoOperacao: "TRANSFERENCIA",
        quantidade: 1,
        motivo: "CORRECAO_INVENTARIO",
        justificativa: JUSTIFICATIVA,
      },
    ],
    [
      "justificativa ausente",
      {
        tipoOperacao: "ENTRADA",
        quantidade: 1,
        motivo: "CORRECAO_INVENTARIO",
      },
    ],
  ])("400: %s", async (_nome, corpo) => {
    const lote = await inserirLote(MUN_A, UBS_A1, 10);

    const res = await postar(tokenFarma, lote, corpo);

    expect(res.status).toBe(400);
    expect(await saldoDoLote(lote)).toBe(10);
    expect(await movimentacoes(lote)).toHaveLength(0);
  });

  it("400: loteId que não é UUID", async () => {
    const res = await postar(tokenFarma, "nao-e-um-uuid", {
      tipoOperacao: "ENTRADA",
      quantidade: 1,
      motivo: "CORRECAO_INVENTARIO",
      justificativa: JUSTIFICATIVA,
    });

    expect(res.status).toBe(400);
  });

  it("401: sem token de sessão", async () => {
    const lote = await inserirLote(MUN_A, UBS_A1, 10);

    const res = await postar(null, lote, {
      tipoOperacao: "ENTRADA",
      quantidade: 1,
      motivo: "CORRECAO_INVENTARIO",
      justificativa: JUSTIFICATIVA,
    });

    expect(res.status).toBe(401);
    expect(await saldoDoLote(lote)).toBe(10);
  });

  it.each([
    ["ADMINISTRADOR", "admin@farmaubs.dev", "Admin@123456"],
    ["GERENTE", "gerente@farmaubs.dev", "Gerente@123456"],
  ])(
    "403: perfil %s não pode ajustar estoque (NF009)",
    async (_perfil, email, senha) => {
      const lote = await inserirLote(MUN_A, UBS_A1, 10);
      const token = await login(email, senha);

      const res = await postar(token, lote, {
        tipoOperacao: "ENTRADA",
        quantidade: 1,
        motivo: "CORRECAO_INVENTARIO",
        justificativa: JUSTIFICATIVA,
      });

      expect(res.status).toBe(403);
      expect(await saldoDoLote(lote)).toBe(10);
      expect(await movimentacoes(lote)).toHaveLength(0);
    },
  );

  it("404: lote inexistente", async () => {
    const res = await postar(tokenFarma, randomUUID(), {
      tipoOperacao: "ENTRADA",
      quantidade: 1,
      motivo: "CORRECAO_INVENTARIO",
      justificativa: JUSTIFICATIVA,
    });

    expect(res.status).toBe(404);
  });

  it("404: lote de outra UBS do mesmo município e lote de outro município (RLS), sem alterar nada", async () => {
    const loteOutraUbs = await inserirLote(MUN_A, UBS_A2, 8);
    const loteOutroMunicipio = await inserirLote(MUN_B, UBS_B1, 8);
    const corpo = {
      tipoOperacao: "ENTRADA",
      quantidade: 5,
      motivo: "CORRECAO_INVENTARIO",
      justificativa: JUSTIFICATIVA,
    };

    for (const lote of [loteOutraUbs, loteOutroMunicipio]) {
      const res = await postar(tokenFarma, lote, corpo);
      expect(res.status).toBe(404);
      expect(await saldoDoLote(lote)).toBe(8);
      expect(await movimentacoes(lote)).toHaveLength(0);
    }
  });
});
