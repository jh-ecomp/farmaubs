import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { Server } from "node:http";
import { randomUUID } from "crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { DataSource } from "typeorm";
import { Workbook } from "exceljs";
import type { Worksheet } from "exceljs";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { adminDatabaseUrl } from "./test-db";
import { PerfilCodigo } from "@farmaubs/shared";

/**
 * ES-05 (#246) - GET /api/v1/estoque/relatorios/exportar-xlsx de ponta a ponta
 * (guards, DTO, caso de uso, PostgreSQL com RLS, planilha ExcelJS). O arquivo baixado é
 * aberto com ExcelJS para conferir cabeçalho institucional, aba e linhas.
 */

const uid = (sufixo: string): string =>
  `7d000000-0000-4000-8000-${sufixo.padStart(12, "0")}`;
const MUN_A = uid("a");
const MUN_B = uid("b");
const UBS_A1 = uid("a1");
const UBS_A2 = uid("a2");
const UBS_B1 = uid("b1");
const FABRICANTE = uid("d1");
const PRODUTO = uid("c1");
const USER_FARMA = uid("e1");
const USER_ADMIN = uid("e2");
const USER_B = uid("e3");
const EMAIL_SUFIXO = "@estoque-relatorios-e2e.test";
const EMAIL_FARMA = `farmaceutico${EMAIL_SUFIXO}`;
const EMAIL_ADMIN = `admin${EMAIL_SUFIXO}`;
const EMAIL_USER_B = `userb${EMAIL_SUFIXO}`;
const SENHA = "Relatorios@123456";
const NOME_FARMA = "Farmacêutico Relatórios E2E";
const ROTA = "/api/v1/estoque/relatorios/exportar-xlsx";
const MIME_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PRIMEIRA_LINHA_TABELA = 5; // linhas 1-3 institucionais, 4 em branco, 5 cabeçalho da tabela

const parserBinario = (
  res: request.Response,
  cb: (err: Error | null, body: Buffer) => void,
) => {
  const partes: Buffer[] = [];
  res.on("data", (parte: Buffer) => partes.push(Buffer.from(parte)));
  res.on("end", () => cb(null, Buffer.concat(partes)));
};

describe("GET /api/v1/estoque/relatorios/exportar-xlsx (E2E - camada C)", () => {
  let app: INestApplication;
  let admin: DataSource;
  let tokenFarma: string;
  let tokenAdmin: string;

  const PAPEIS_PERMITIDOS: string[] = [
    PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    PerfilCodigo.FARMACEUTICO_RESIDENTE,
    PerfilCodigo.GERENTE,
    PerfilCodigo.ADMINISTRADOR,
  ];
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

  // O TenantScopeGuard exige unidadeId de quem não é ADMINISTRADOR (checkUbs: true).
  const ubsPadraoPorToken = new Map<string, string>();

  const exportar = (token: string | null, query: Record<string, string>) => {
    const ubsPadrao = token ? ubsPadraoPorToken.get(token) : undefined;
    const req = request(server())
      .get(ROTA)
      .query(ubsPadrao ? { unidadeId: ubsPadrao, ...query } : query)
      .buffer(true)
      .parse(parserBinario);
    if (token) req.set("Authorization", token);
    return req;
  };

  async function abrirPlanilha(corpo: Buffer): Promise<Worksheet> {
    const wb = new Workbook();
    await wb.xlsx.load(
      corpo as unknown as Parameters<Workbook["xlsx"]["load"]>[0],
    );
    expect(wb.worksheets).toHaveLength(1);
    return wb.worksheets[0];
  }

  const celula = (ws: Worksheet, linha: number, coluna: number) =>
    ws.getRow(linha).getCell(coluna).value;

  /** Valores de uma coluna nas linhas de dados (depois do cabeçalho da tabela). */
  const coluna = (ws: Worksheet, col: number): unknown[] => {
    const valores: unknown[] = [];
    for (let r = PRIMEIRA_LINHA_TABELA + 1; r <= ws.rowCount; r++) {
      valores.push(celula(ws, r, col));
    }
    return valores;
  };

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
    extra: { motivo?: string; justificativa?: string } = {},
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
        extra.motivo ?? null,
        extra.justificativa ?? null,
        criadoEm,
      ],
    );
  }

  async function limpar(): Promise<void> {
    const municipios = [MUN_A, MUN_B];
    await admin.query(
      `DELETE FROM movimentacoes_estoque WHERE municipio_id = ANY($1::uuid[])`,
      [municipios],
    );
    await admin.query(
      `DELETE FROM lotes WHERE municipio_id = ANY($1::uuid[])`,
      [municipios],
    );
    const ids = (
      await admin.query(
        `SELECT id FROM users WHERE email LIKE $1 OR municipio_id = ANY($2::uuid[])`,
        [`%${EMAIL_SUFIXO}`, municipios],
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
      `DELETE FROM users WHERE email LIKE $1 OR municipio_id = ANY($2::uuid[])`,
      [`%${EMAIL_SUFIXO}`, municipios],
    );
    await admin.query(`DELETE FROM unidades_saude WHERE id = ANY($1::uuid[])`, [
      [UBS_A1, UBS_A2, UBS_B1],
    ]);
    await admin.query(`DELETE FROM municipios WHERE id = ANY($1::uuid[])`, [
      municipios,
    ]);
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
      `INSERT INTO municipios (id, nome, uf, codigo_ibge) VALUES
         ($1, 'Município Relatórios E2E A', 'PI', '9900051'),
         ($2, 'Município Relatórios E2E B', 'PI', '9900052')`,
      [MUN_A, MUN_B],
    );
    await admin.query(
      `INSERT INTO unidades_saude (id, municipio_id, nome) VALUES
         ($1, $4, 'UBS Relatórios E2E A1'),
         ($2, $4, 'UBS Relatórios E2E A2'),
         ($3, $5, 'UBS Relatórios E2E B1')`,
      [UBS_A1, UBS_A2, UBS_B1, MUN_A, MUN_B],
    );
    await admin.query(
      `INSERT INTO fabricantes (id, razao_social, nome_fantasia)
       VALUES ($1, 'Fabricante Relatórios E2E', 'Fab Relatórios E2E')`,
      [FABRICANTE],
    );
    await admin.query(
      `INSERT INTO produtos (id, nome_comercial, principio_ativo, apresentacao, categoria, ativo)
       VALUES ($1, 'Relatórios E2E Dipirona', 'Dipirona sódica', 'Comprimido 500 mg', 'GERAL', true)`,
      [PRODUTO],
    );

    const senhaHash = await bcrypt.hash(SENHA, 4);
    await admin.query(
      `INSERT INTO users (id, municipio_id, nome_completo, email, senha_hash, perfil_id,
                          ativo, deve_trocar_senha, tentativas_login_falhas, senha_atualizada_em)
       VALUES ($1, $2, $3, $4, $5, $6, true, false, 0, now()),
              ($7, $2, 'Administrador Relatórios E2E', $8, $5, $9, true, false, 0, now()),
              ($10, $11, 'Usuário B Relatórios E2E', $12, $5, $6, true, false, 0, now())`,
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
        USER_B,
        MUN_B,
        EMAIL_USER_B,
      ],
    );
    await admin.query(
      `INSERT INTO user_units (usuario_id, unidade_id, ativo) VALUES
         ($1, $4, true), ($2, $4, true), ($3, $5, true)`,
      [USER_FARMA, USER_ADMIN, USER_B, UBS_A1, UBS_B1],
    );

    // UBS A1: lote com histórico completo + lote zerado (não entra em saldos).
    const loteA1 = await inserirLote(MUN_A, UBS_A1, "RL-E2E-A1", 430);
    await inserirLote(MUN_A, UBS_A1, "RL-E2E-ZERO", 0);
    const mov = (
      tipo: string,
      qtd: number,
      ant: number,
      post: number,
      quando: string,
      extra: { motivo?: string; justificativa?: string } = {},
    ) =>
      inserirMovimentacao(
        MUN_A,
        UBS_A1,
        loteA1,
        USER_FARMA,
        tipo,
        qtd,
        ant,
        post,
        quando,
        extra,
      );
    await mov("ENTRADA_RECEBIMENTO", 500, 0, 500, "2026-01-01T10:00:00.000Z");
    await mov("SAIDA_DISPENSACAO", 30, 500, 470, "2026-01-02T10:00:00.000Z");
    await mov("AJUSTE_SAIDA", 10, 470, 460, "2026-01-03T10:00:00.000Z", {
      motivo: "VENCIMENTO",
      justificativa: "Lote vencido",
    });
    await mov("AJUSTE_SAIDA", 25, 460, 435, "2026-01-04T10:00:00.000Z", {
      motivo: "AVARIA_FISICA",
      justificativa: "Quebra no armazenamento",
    });
    await mov("AJUSTE_SAIDA", 5, 435, 430, "2026-01-05T10:00:00.000Z", {
      motivo: "EXTRAVIO",
      justificativa: "Extravio no armazém",
    });

    // UBS A2 (mesmo município): só o filtro ubs_id separa.
    const loteA2 = await inserirLote(MUN_A, UBS_A2, "RL-E2E-A2", 50);
    await inserirMovimentacao(
      MUN_A,
      UBS_A2,
      loteA2,
      USER_FARMA,
      "ENTRADA_RECEBIMENTO",
      50,
      0,
      50,
      "2026-01-01T10:00:00.000Z",
    );

    // UBS B1 (outro município): RLS + escopo de sessão.
    const loteB1 = await inserirLote(MUN_B, UBS_B1, "RL-E2E-B1", 70);
    await inserirMovimentacao(
      MUN_B,
      UBS_B1,
      loteB1,
      USER_B,
      "ENTRADA_RECEBIMENTO",
      70,
      0,
      70,
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
    ubsPadraoPorToken.set(tokenFarma, UBS_A1);
    ubsPadraoPorToken.set(tokenAdmin, UBS_A1);

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
          `Perfil ${codigo} Relatórios E2E`,
          email,
          senhaHash,
          perfil.id,
        ],
      );
      await admin.query(
        `INSERT INTO user_units (usuario_id, unidade_id, ativo) VALUES ($1, $2, true)`,
        [id, UBS_A1],
      );
      const tokenPerfil = await login(email, SENHA);
      ubsPadraoPorToken.set(tokenPerfil, UBS_A1);
      tokensPorPerfil.set(codigo, tokenPerfil);
    }
  });

  afterAll(async () => {
    if (app) await app.close();
    if (admin?.isInitialized) {
      await limpar();
      await admin.destroy();
    }
  });

  describe("SALDOS_ATUAIS", () => {
    it("200: baixa o XLSX com headers corretos, cabeçalho institucional e só os lotes ativos com saldo da UBS", async () => {
      const res = await exportar(tokenFarma, {
        tipoRelatorio: "SALDOS_ATUAIS",
      });

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain(MIME_XLSX);
      expect(res.headers["content-disposition"]).toMatch(
        new RegExp(
          `^attachment; filename="relatorio_estoque_SALDOS_ATUAIS_${UBS_A1}_\\d{4}-\\d{2}-\\d{2}\\.xlsx"$`,
        ),
      );
      expect(Buffer.isBuffer(res.body)).toBe(true);

      const ws = await abrirPlanilha(res.body as Buffer);
      expect(ws.name).toBe("Saldos Atuais");
      expect(String(celula(ws, 1, 1))).toBe(
        "Município de Município Relatórios E2E A - Secretaria Municipal de Saúde",
      );
      expect(String(celula(ws, 2, 1))).toContain("UBS Relatórios E2E A1");
      expect(String(celula(ws, 2, 1))).not.toContain("CNES");
      expect(String(celula(ws, 3, 1))).toMatch(
        /^Data de Emissão: \d{2}\/\d{2}\/\d{4}$/,
      );
      expect(celula(ws, PRIMEIRA_LINHA_TABELA, 1)).toBe("Medicamento");

      // Só o lote com saldo da UBS A1: sem lote zerado, sem A2, sem município B.
      expect(coluna(ws, 4)).toEqual(["RL-E2E-A1"]);
      expect(coluna(ws, 6)).toEqual([430]);
      expect(coluna(ws, 7)).toEqual(["Regular"]);
    });
  });

  describe("PERDAS_VENCIMENTO", () => {
    it("200: lista todos os motivos de perda do período (VENCIMENTO, AVARIA_FISICA e EXTRAVIO), com subtotais e Total Geral na última linha", async () => {
      const res = await exportar(tokenFarma, {
        tipoRelatorio: "PERDAS_VENCIMENTO",
        dataInicio: "2026-01-01",
        dataFim: "2026-01-31",
      });

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain(MIME_XLSX);
      expect(res.headers["content-disposition"]).toBe(
        `attachment; filename="relatorio_estoque_PERDAS_VENCIMENTO_${UBS_A1}_2026-01-01_2026-01-31.xlsx"`,
      );

      const ws = await abrirPlanilha(res.body as Buffer);
      expect(ws.name).toBe("Perdas (Vencimento e Avaria)");
      expect(String(celula(ws, 3, 1))).toContain(
        "Período: 01/01/2026 a 31/01/2026",
      );
      expect(celula(ws, PRIMEIRA_LINHA_TABELA, 5)).toBe("Motivo");

      // Ordem: perdas mais recentes primeiro.
      expect(coluna(ws, 5).slice(0, 3)).toEqual([
        "Extravio",
        "Avaria física",
        "Vencimento",
      ]);
      expect(coluna(ws, 4).slice(0, 3)).toEqual([5, 25, 10]);

      const ultima = ws.rowCount;
      expect(celula(ws, ultima, 1)).toBe("Total Geral");
      expect(celula(ws, ultima, 4)).toBe(40);
      expect(coluna(ws, 1)).toEqual(
        expect.arrayContaining([
          "Subtotal - Vencimento",
          "Subtotal - Avaria física",
          "Subtotal - Extravio",
        ]),
      );
    });
  });

  describe("MOVIMENTACOES_PERIODO", () => {
    it("200: extrato cronológico da UBS, com tipo legível, saldo resultante, responsável e hora no fuso da UBS", async () => {
      const res = await exportar(tokenFarma, {
        tipoRelatorio: "MOVIMENTACOES_PERIODO",
        dataInicio: "2026-01-01",
        dataFim: "2026-01-31",
      });

      expect(res.status).toBe(200);
      expect(res.headers["content-disposition"]).toBe(
        `attachment; filename="relatorio_estoque_MOVIMENTACOES_PERIODO_${UBS_A1}_2026-01-01_2026-01-31.xlsx"`,
      );

      const ws = await abrirPlanilha(res.body as Buffer);
      expect(ws.name).toBe("Movimentações");
      expect(coluna(ws, 2)).toEqual([
        "Entrada por Recebimento",
        "Dispensação",
        "Ajuste de Saída",
        "Ajuste de Saída",
        "Ajuste de Saída",
      ]);
      expect(coluna(ws, 6)).toEqual([500, 470, 460, 435, 430]);
      expect(new Set(coluna(ws, 7))).toEqual(new Set([NOME_FARMA]));
      // 10:00Z em America/Fortaleza (UTC-3) = 07:00 civil.
      const primeira = celula(ws, PRIMEIRA_LINHA_TABELA + 1, 1) as Date;
      expect(primeira).toBeInstanceOf(Date);
      expect(primeira.getUTCHours()).toBe(7);
      expect(primeira.getUTCDate()).toBe(1);
      // Nada de A2 nem do município B.
      expect(new Set(coluna(ws, 4))).toEqual(new Set(["RL-E2E-A1"]));
    });

    it("200: sem datas usa o período padrão (últimos 30 dias) e mostra o período no cabeçalho", async () => {
      const res = await exportar(tokenFarma, {
        tipoRelatorio: "MOVIMENTACOES_PERIODO",
      });
      expect(res.status).toBe(200);
      const ws = await abrirPlanilha(res.body as Buffer);
      expect(String(celula(ws, 3, 1))).toMatch(
        /Período: \d{2}\/\d{2}\/\d{4} a \d{2}\/\d{2}\/\d{4}$/,
      );
    });
  });

  describe("validação de parâmetros", () => {
    it("400: tipoRelatorio inválido", async () => {
      const res = await exportar(tokenFarma, { tipoRelatorio: "QUALQUER" });
      expect(res.status).toBe(400);
    });

    it("400: tipoRelatorio ausente", async () => {
      const res = await exportar(tokenFarma, {});
      expect(res.status).toBe(400);
    });

    it("400: data com horário (ISO) é rejeitada", async () => {
      const res = await exportar(tokenFarma, {
        tipoRelatorio: "MOVIMENTACOES_PERIODO",
        dataInicio: "2026-01-01T00:00:00.000Z",
        dataFim: "2026-01-31",
      });
      expect(res.status).toBe(400);
    });

    it("400: data inexistente (2026-02-31)", async () => {
      const res = await exportar(tokenFarma, {
        tipoRelatorio: "MOVIMENTACOES_PERIODO",
        dataInicio: "2026-02-31",
        dataFim: "2026-03-10",
      });
      expect(res.status).toBe(400);
    });

    it("400: dataFim anterior a dataInicio", async () => {
      const res = await exportar(tokenFarma, {
        tipoRelatorio: "MOVIMENTACOES_PERIODO",
        dataInicio: "2026-01-31",
        dataFim: "2026-01-01",
      });
      expect(res.status).toBe(400);
    });

    it("400: intervalo maior que 365 dias", async () => {
      const res = await exportar(tokenFarma, {
        tipoRelatorio: "MOVIMENTACOES_PERIODO",
        dataInicio: "2024-01-01",
        dataFim: "2026-01-01",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("autenticação, RBAC e isolamento", () => {
    it("401: sem sessão", async () => {
      const res = await exportar(null, { tipoRelatorio: "SALDOS_ATUAIS" });
      expect(res.status).toBe(401);
    });

    it.each(PAPEIS_PERMITIDOS)(
      "200: perfil %s pode exportar",
      async (codigo) => {
        const res = await exportar(tokensPorPerfil.get(codigo)!, {
          tipoRelatorio: "SALDOS_ATUAIS",
        });
        expect(res.status).toBe(200);
      },
    );


    it("403: unidadeId de outra UBS do mesmo município", async () => {
      const res = await exportar(tokenFarma, {
        tipoRelatorio: "SALDOS_ATUAIS",
        unidadeId: UBS_A2,
      });
      expect(res.status).toBe(403);
    });

    it("403: unidadeId de UBS de outro município", async () => {
      const res = await exportar(tokenFarma, {
        tipoRelatorio: "SALDOS_ATUAIS",
        unidadeId: UBS_B1,
      });
      expect(res.status).toBe(403);
    });

    it("200: unidadeId igual à UBS do próprio escopo é aceito", async () => {
      const res = await exportar(tokenFarma, {
        tipoRelatorio: "SALDOS_ATUAIS",
        unidadeId: UBS_A1,
      });
      expect(res.status).toBe(200);
    });

    it("400: unidadeId ausente retorna 400 (mesmo para ADMINISTRADOR)", async () => {
      const res = await request(server())
        .get(ROTA)
        .query({ tipoRelatorio: "SALDOS_ATUAIS" })
        .set("Authorization", tokenAdmin);
      expect(res.status).toBe(400);
    });

    it("404: ADMINISTRADOR consultando UBS de outro município é isolado pelo RLS", async () => {
      const res = await exportar(tokenAdmin, {
        tipoRelatorio: "SALDOS_ATUAIS",
        unidadeId: UBS_B1,
      });
      expect(res.status).toBe(404);
    });

    it("isolamento por município: o usuário do município B só vê os dados do B", async () => {
      const tokenB = await login(EMAIL_USER_B, SENHA);
      ubsPadraoPorToken.set(tokenB, UBS_B1);
      const res = await exportar(tokenB, { tipoRelatorio: "SALDOS_ATUAIS" });
      expect(res.status).toBe(200);
      const ws = await abrirPlanilha(res.body as Buffer);
      expect(String(celula(ws, 1, 1))).toContain("Município Relatórios E2E B");
      expect(coluna(ws, 4)).toEqual(["RL-E2E-B1"]);
    });
  });
});
