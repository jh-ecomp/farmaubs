import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { Server } from "node:http";
import { randomUUID } from "crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { DataSource } from "typeorm";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { adminDatabaseUrl } from "./test-db";
import { PerfilCodigo } from "@farmaubs/shared";

/**
 * ES-04 (#245) - GET /api/v1/estoque/lotes/:loteId/rastreabilidade de ponta a ponta
 * (guards, ParseUUIDPipe, caso de uso, PostgreSQL com RLS). O isolamento entre UBSs do
 * mesmo município vem só do filtro ubs_id, então o 404 entre UBSs é testado aqui.
 */

const uid = (sufixo: string): string =>
  `7e000000-0000-4000-8000-${sufixo.padStart(12, "0")}`;
const MUN_A = uid("a");
const UBS_A1 = uid("a1");
const UBS_A2 = uid("a2");
const FABRICANTE = uid("d1");
const PRODUTO = uid("c1");
const USER_FARMA = uid("e1");
const USER_ADMIN = uid("e2");
const EMAIL_SUFIXO = "@estoque-rastreab-e2e.test";
const EMAIL_FARMA = `farmaceutico${EMAIL_SUFIXO}`;
const EMAIL_ADMIN = `admin${EMAIL_SUFIXO}`;
const SENHA = "Rastreab@123456";
const NOME_FARMA = "Farmacêutico Rastreab E2E";

describe("GET /api/v1/estoque/lotes/:loteId/rastreabilidade (E2E - camada C)", () => {
  let app: INestApplication;
  let admin: DataSource;
  let tokenFarma: string;
  let tokenAdmin: string;
  let loteA1: string;
  let loteA2: string;

  const PAPEIS_PERMITIDOS: string[] = [
    PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    PerfilCodigo.FARMACEUTICO_RESIDENTE,
    PerfilCodigo.GERENTE,
  ];
  const PAPEIS_BLOQUEADOS: string[] = Object.values(PerfilCodigo).filter(
    (p) => !PAPEIS_PERMITIDOS.includes(p),
  );
  const tokensPorPerfil = new Map<string, string>();

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

  const consultar = (token: string | null, loteId: string) => {
    const req = request(server()).get(
      `/api/v1/estoque/lotes/${loteId}/rastreabilidade`,
    );
    if (token) req.set("Authorization", token);
    return req;
  };

  async function inserirLote(
    ubsId: string,
    numero: string,
    saldo: number,
  ): Promise<string> {
    const rows = await admin.query(
      `INSERT INTO lotes (municipio_id, ubs_id, produto_id, fabricante_id,
         numero_lote, data_validade, saldo_atual, status, created_at)
       VALUES ($1, $2, $3, $4, $5, '2030-01-01', $6, 'ATIVO', '2026-01-01T09:00:00.000Z')
       RETURNING id`,
      [MUN_A, ubsId, PRODUTO, FABRICANTE, numero, saldo],
    );
    return rows[0].id;
  }

  async function inserirMovimentacao(
    ubsId: string,
    loteId: string,
    tipo: string,
    quantidade: number,
    anterior: number,
    posterior: number,
    criadoEm: string,
    extra: { motivo?: string; justificativa?: string } = {},
  ): Promise<void> {
    await admin.query(
      `INSERT INTO movimentacoes_estoque
         (municipio_id, ubs_id, lote_id, tipo_movimentacao, quantidade,
          saldo_anterior, saldo_posterior, usuario_id, motivo, justificativa, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz)`,
      [
        MUN_A,
        ubsId,
        loteId,
        tipo,
        quantidade,
        anterior,
        posterior,
        USER_FARMA,
        extra.motivo ?? null,
        extra.justificativa ?? null,
        criadoEm,
      ],
    );
  }

  async function limpar(): Promise<void> {
    await admin.query(
      `DELETE FROM movimentacoes_estoque WHERE municipio_id = $1::uuid`,
      [MUN_A],
    );
    await admin.query(`DELETE FROM lotes WHERE municipio_id = $1::uuid`, [
      MUN_A,
    ]);
    // Remove o que referenciar os usuários de teste (vínculos com UBS, sessões, etc.), seja qual for a tabela.
    const ids = (
      await admin.query(
        `SELECT id FROM users WHERE email LIKE $1 OR municipio_id = $2::uuid`,
        [`%${EMAIL_SUFIXO}`, MUN_A],
      )
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
    await admin.query(
      `DELETE FROM users WHERE email LIKE $1 OR municipio_id = $2::uuid`,
      [`%${EMAIL_SUFIXO}`, MUN_A],
    );
    await admin.query(`DELETE FROM unidades_saude WHERE id = ANY($1::uuid[])`, [
      [UBS_A1, UBS_A2],
    ]);
    await admin.query(`DELETE FROM municipios WHERE id = $1::uuid`, [MUN_A]);
    await admin.query(`DELETE FROM produtos WHERE id = $1`, [PRODUTO]);
    await admin.query(`DELETE FROM fabricantes WHERE id = $1`, [FABRICANTE]);
  }

  beforeAll(async () => {
    admin = new DataSource({ type: "postgres", url: adminDatabaseUrl() });
    await admin.initialize();
    await limpar();

    const perfilFarma = await admin.query(
      `SELECT id FROM perfis WHERE codigo = 'FARMACEUTICO_RESPONSAVEL'`,
    );
    const perfilAdmin = await admin.query(
      `SELECT id FROM perfis WHERE codigo = 'ADMINISTRADOR'`,
    );
    await admin.query(
      `INSERT INTO municipios (id, nome, uf, codigo_ibge)
       VALUES ($1, 'Município Rastreab E2E', 'PI', '9900041')`,
      [MUN_A],
    );
    await admin.query(
      `INSERT INTO unidades_saude (id, municipio_id, nome) VALUES
         ($1, $3, 'UBS Rastreab E2E A1'),
         ($2, $3, 'UBS Rastreab E2E A2')`,
      [UBS_A1, UBS_A2, MUN_A],
    );
    await admin.query(
      `INSERT INTO fabricantes (id, razao_social, nome_fantasia)
       VALUES ($1, 'Fabricante Rastreab E2E', 'Fab Rastreab E2E')`,
      [FABRICANTE],
    );
    await admin.query(
      `INSERT INTO produtos (id, nome_comercial, principio_ativo, apresentacao, categoria, ativo)
       VALUES ($1, 'Rastreab E2E Dipirona', 'Dipirona sódica', 'Comprimido 500 mg', 'GERAL', true)`,
      [PRODUTO],
    );

    const senhaHash = await bcrypt.hash(SENHA, 4);
    await admin.query(
      `INSERT INTO users (id, municipio_id, nome_completo, email, senha_hash, perfil_id,
                          ativo, deve_trocar_senha, tentativas_login_falhas, senha_atualizada_em)
       VALUES ($1, $2, $3, $4, $5, $6, true, false, 0, now()),
              ($7, $2, 'Administrador Rastreab E2E', $8, $5, $9, true, false, 0, now())`,
      [
        USER_FARMA,
        MUN_A,
        NOME_FARMA,
        EMAIL_FARMA,
        senhaHash,
        perfilFarma[0].id,
        USER_ADMIN,
        EMAIL_ADMIN,
        perfilAdmin[0].id,
      ],
    );
    await admin.query(
      `INSERT INTO user_units (usuario_id, unidade_id, ativo) VALUES
         ($1, $3, true), ($2, $3, true)`,
      [USER_FARMA, USER_ADMIN, UBS_A1],
    );

    loteA1 = await inserirLote(UBS_A1, "RT-E2E-A1", 460);
    await inserirMovimentacao(
      UBS_A1,
      loteA1,
      "ENTRADA_RECEBIMENTO",
      500,
      0,
      500,
      "2026-01-01T10:00:00.000Z",
    );
    await inserirMovimentacao(
      UBS_A1,
      loteA1,
      "SAIDA_DISPENSACAO",
      30,
      500,
      470,
      "2026-01-02T10:00:00.000Z",
    );
    await inserirMovimentacao(
      UBS_A1,
      loteA1,
      "AJUSTE_SAIDA",
      10,
      470,
      460,
      "2026-01-03T10:00:00.000Z",
      {
        motivo: "AVARIA_FISICA",
        justificativa: "Quebra no armazenamento",
      },
    );

    loteA2 = await inserirLote(UBS_A2, "RT-E2E-A2", 50);
    await inserirMovimentacao(
      UBS_A2,
      loteA2,
      "ENTRADA_RECEBIMENTO",
      50,
      0,
      50,
      "2026-01-01T10:00:00.000Z",
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    tokenFarma = await login(EMAIL_FARMA, SENHA);
    tokenAdmin = await login(EMAIL_ADMIN, SENHA);

    for (const codigo of Object.values(PerfilCodigo)) {
      if (codigo === PerfilCodigo.FARMACEUTICO_RESPONSAVEL) {
        tokensPorPerfil.set(codigo, tokenFarma);
        continue;
      }
      if (codigo === PerfilCodigo.ADMINISTRADOR) {
        tokensPorPerfil.set(codigo, tokenAdmin);
        continue;
      }
      const [perfil] = await admin.query(
        `SELECT id FROM perfis WHERE codigo = $1`,
        [codigo],
      );
      if (!perfil)
        throw new Error(`Perfil ausente no banco de teste: ${codigo}`);
      const id = randomUUID();
      const email = `${codigo.toLowerCase()}${EMAIL_SUFIXO}`;
      await admin.query(
        `INSERT INTO users (id, municipio_id, nome_completo, email, senha_hash, perfil_id,
                            ativo, deve_trocar_senha, tentativas_login_falhas, senha_atualizada_em)
         VALUES ($1, $2, $3, $4, $5, $6, true, false, 0, now())`,
        [
          id,
          MUN_A,
          `Perfil ${codigo} Rastreab E2E`,
          email,
          senhaHash,
          perfil.id,
        ],
      );
      await admin.query(
        `INSERT INTO user_units (usuario_id, unidade_id, ativo) VALUES ($1, $2, true)`,
        [id, UBS_A1],
      );
      tokensPorPerfil.set(codigo, await login(email, SENHA));
    }
  });

  afterAll(async () => {
    if (app) await app.close();
    if (admin?.isInitialized) {
      await limpar();
      await admin.destroy();
    }
  });

  it("200: devolve a linha do tempo com saldo inicial, saldo atual e tipos traduzidos, sem campos internos", async () => {
    const res = await consultar(tokenFarma, loteA1);

    expect(res.status).toBe(200);
    expect(res.body.lote).toMatchObject({
      id: loteA1,
      numeroLote: "RT-E2E-A1",
      dataValidade: "2030-01-01",
      dataCadastro: "2026-01-01T09:00:00.000Z",
      saldoInicial: 500,
      saldoAtual: 460,
      fabricanteNome: "Fab Rastreab E2E",
    });
    expect(res.body.medicamento).toMatchObject({
      id: PRODUTO,
      principioAtivo: "Dipirona sódica",
    });
    expect(
      res.body.movimentacoes.map(
        (m: { tipoMovimentacao: string }) => m.tipoMovimentacao,
      ),
    ).toEqual(["ENTRADA_RECEBIMENTO", "SAIDA_DISPENSACAO", "AJUSTE_SAIDA"]);
    expect(
      res.body.movimentacoes.map(
        (m: { saldoResultante: number }) => m.saldoResultante,
      ),
    ).toEqual([500, 470, 460]);
    expect(res.body.movimentacoes[2]).toMatchObject({
      quantidade: 10,
      motivo: "AVARIA_FISICA",
      justificativa: "Quebra no armazenamento",
      usuarioResponsavel: { id: USER_FARMA, nome: NOME_FARMA },
    });
    for (const m of res.body.movimentacoes) {
      expect(m).not.toHaveProperty("tipoBanco");
      expect(m).not.toHaveProperty("saldoAnterior");
    }
  });

  it("404: lote de outra UBS do mesmo município (só o filtro ubs_id protege)", async () => {
    const res = await consultar(tokenFarma, loteA2);
    expect(res.status).toBe(404);
  });

  it("404: lote inexistente", async () => {
    const res = await consultar(
      tokenFarma,
      "7e000000-0000-4000-8000-0000000000ff",
    );
    expect(res.status).toBe(404);
  });

  it("400: loteId que não é UUID", async () => {
    const res = await consultar(tokenFarma, "nao-e-um-uuid");
    expect(res.status).toBe(400);
  });

  it("401: sem sessão", async () => {
    const res = await consultar(null, loteA1);
    expect(res.status).toBe(401);
  });

  it.each(PAPEIS_PERMITIDOS)(
    "200: perfil %s pode consultar (NF009)",
    async (codigo) => {
      const res = await consultar(tokensPorPerfil.get(codigo)!, loteA1);
      expect(res.status).toBe(200);
    },
  );

  it.each(PAPEIS_BLOQUEADOS)(
    "403: perfil %s sem permissão de consulta (NF009)",
    async (codigo) => {
      const res = await consultar(tokensPorPerfil.get(codigo)!, loteA1);
      expect(res.status).toBe(403);
    },
  );
});
