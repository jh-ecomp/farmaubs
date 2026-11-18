/// <reference path="../types/node-assert.d.ts" />
import assert from "node:assert/strict";
import {
  acaoDoToque,
  CANAL_ALERTA_SESSAO,
  CORPO_ALERTA_SESSAO,
  instanteAlerta,
  lerExpiresAtHeader,
  lerRenovarSessao,
  MENSAGEM_SESSAO_ESTENDIDA,
  MENSAGEM_SESSAO_INATIVIDADE,
  NOME_CANAL_ALERTA_SESSAO,
} from "./alerta-sessao.ts";

const fim = Date.parse("2026-11-15T12:00:00.000Z");
const antes = Date.parse("2026-11-15T10:00:00.000Z");
assert.equal(instanteAlerta("2026-11-15T12:00:00.000Z", antes), fim - 5 * 60 * 1000);
assert.equal(instanteAlerta("2026-11-15T12:00:00.000Z", fim - 60_000), null);
assert.equal(instanteAlerta("nao-e-data", antes), null);

assert.equal(acaoDoToque("2026-11-15T12:00:00.000Z", fim - 60_000), "renovar");
assert.equal(acaoDoToque("2026-11-15T12:00:00.000Z", fim), "expirada");
assert.equal(lerExpiresAtHeader("2026-11-15T12:00:00.000Z"), "2026-11-15T12:00:00.000Z");
assert.equal(lerExpiresAtHeader("ruim"), null);
assert.equal(lerRenovarSessao({ expiresAt: "2026-11-15T13:00:00.000Z", ttlSeconds: 3600 }), "2026-11-15T13:00:00.000Z");
assert.equal(lerRenovarSessao({}), null);
assert.equal(CANAL_ALERTA_SESSAO, "farmaubs-session-alerts");
assert.equal(NOME_CANAL_ALERTA_SESSAO, "Alertas de Sessão e Segurança");
assert.equal(CORPO_ALERTA_SESSAO.includes("5 minutos"), true);
assert.equal(MENSAGEM_SESSAO_ESTENDIDA, "Sessão estendida com sucesso.");
assert.equal(MENSAGEM_SESSAO_INATIVIDADE.includes("inatividade"), true);

console.log("alerta-sessao ok");
