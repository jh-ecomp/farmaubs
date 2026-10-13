import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "chai";
import * as crypto from "crypto";
import type { DataSource } from "typeorm";
import { SessionPgRepository } from "../../../src/modules/acesso/infrastructure/adapters/session-pg.repository";

type QueryCall = { sql: string; params: unknown[] };

// DataSource falso: registra cada query enviada ao banco e devolve as linhas configuradas.
// O adaptador real (SessionPgRepository) é quem roda; só o driver é simulado.
function makeFakeDataSource(rows: unknown[] = []) {
  const calls: QueryCall[] = [];
  const ds = {
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      return rows;
    },
  } as unknown as DataSource;
  return { ds, calls };
}

function sha256(valor: string): string {
  return crypto.createHash("sha256").update(valor).digest("hex");
}

function linhaDeSessao(overrides: Record<string, unknown> = {}) {
  const agora = new Date();
  return {
    id: "sessao-1",
    usuario_id: "user-1",
    municipio_id: "mun-1",
    perfil_codigo: "FARMACEUTICO_RESPONSAVEL",
    unidade_ids: ["ubs-1", "ubs-2"],
    nome_completo: "Farmacêutico Teste",
    email: "farmaceutico@ubs.gov.br",
    deve_trocar_senha: false,
    status: "ativa",
    expira_em: new Date(agora.getTime() + 3_600_000).toISOString(),
    criado_em: agora.toISOString(),
    ultima_atividade_em: agora.toISOString(),
    ...overrides,
  };
}

// ── Cenário 1: geração de token e persistência do hash ──────────────────────

Given(
  "que o serviço solicita a criação de sessão para o usuário {string}",
  function (this: any, userId: string) {
    const { ds, calls } = makeFakeDataSource();
    this.calls = calls;
    this.repo = new SessionPgRepository(ds);
    this.params = {
      usuarioId: userId,
      expiraEm: new Date(Date.now() + 3_600_000),
    };
  },
);

When("o método criarSessao for executado", async function (this: any) {
  this.token = await this.repo.criarSessao(this.params);
});

Then(
  "um token em texto puro de 64 caracteres hexadecimais deve ser retornado",
  function (this: any) {
    expect(this.token).to.match(/^[0-9a-f]{64}$/);
  },
);

Then(
  "o adaptador deve gravar o hash SHA-256 desse token na tabela sessions",
  function (this: any) {
    const chamada = (this.calls as QueryCall[]).find((c) =>
      c.sql.includes("auth_criar_sessao"),
    );
    expect(chamada, "auth_criar_sessao deve ser chamada").to.not.equal(undefined);
    expect(chamada!.params[0]).to.equal(this.params.usuarioId);
    expect(chamada!.params[1]).to.equal(sha256(this.token));
  },
);

Then(
  "o token em texto puro jamais deve ser gravado no banco",
  function (this: any) {
    expect(JSON.stringify(this.calls)).to.not.include(this.token);
  },
);

// ── Cenário 2: snapshot completo de segurança ───────────────────────────────

Given("que existe uma sessão ativa registrada", function (this: any) {
  const { ds, calls } = makeFakeDataSource([linhaDeSessao()]);
  this.calls = calls;
  this.repo = new SessionPgRepository(ds);
  this.validHash = sha256("token-valido");
});

When(
  "o método buscarPorTokenHash for chamado com o hash válido",
  async function (this: any) {
    this.snapshot = await this.repo.buscarPorTokenHash(this.validHash);
    expect(this.calls[0].params[0]).to.equal(this.validHash);
  },
);

Then(
  "o snapshot retornado deve conter o perfilCodigo {string}",
  function (this: any, perfil: string) {
    expect(this.snapshot).to.not.equal(null);
    expect(this.snapshot.perfilCodigo).to.equal(perfil);
    expect(this.snapshot.municipioId).to.equal("mun-1");
  },
);

Then(
  "a lista unidadeIds com as UBSs vinculadas ao usuário",
  function (this: any) {
    expect(this.snapshot.unidadeIds).to.deep.equal(["ubs-1", "ubs-2"]);
  },
);

Then("o status {string}", function (this: any, status: string) {
  expect(this.snapshot.status).to.equal(status);
});

// ── Cenário 3: sessão expirada ──────────────────────────────────────────────
// O filtro "expira_em > now()" mora na função SQL, então aqui o banco simulado
// responde sem linhas (como responderia). O filtro real é exercitado no teste
// de integração com Postgres.

Given(
  "que o token apresentado pertence a uma sessão com expira_em no passado",
  function (this: any) {
    const { ds, calls } = makeFakeDataSource([]);
    this.calls = calls;
    this.repo = new SessionPgRepository(ds);
    this.expiredHash = sha256("token-expirado");
  },
);

When(
  "o método buscarPorTokenHash for executado",
  async function (this: any) {
    this.snapshot = await this.repo.buscarPorTokenHash(this.expiredHash);
  },
);

Then("o retorno deve ser nulo", function (this: any) {
  expect(this.snapshot).to.equal(null);
});
