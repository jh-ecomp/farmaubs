/// <reference path="../types/node-assert.d.ts" />
import assert from "node:assert/strict";
import {
  DURACAO_BANNER_RESTABELECIDO_MS,
  estadoConectividade,
  MENSAGEM_ACAO_OFFLINE,
  MENSAGEM_CONEXAO_RESTABELECIDA,
  MENSAGEM_MODO_OFFLINE,
  proximaFase,
  redeEstaOffline,
} from "./conectividade.ts";

assert.equal(redeEstaOffline({ isConnected: false, isInternetReachable: false }), true);
assert.equal(redeEstaOffline({ isConnected: true, isInternetReachable: false }), true);
assert.equal(redeEstaOffline({ isConnected: true, isInternetReachable: null }), false);
assert.equal(redeEstaOffline({ isConnected: null, isInternetReachable: null }), false);

assert.deepEqual(estadoConectividade({ isConnected: false, isInternetReachable: false, type: "none" }), {
  online: false,
  tipoConexao: "none",
});
assert.equal(estadoConectividade({ isConnected: true, isInternetReachable: true, type: "wifi" }).online, true);

assert.equal(proximaFase("oculto", false), "oculto");
assert.equal(proximaFase("oculto", true), "offline");
assert.equal(proximaFase("offline", true), "offline");
assert.equal(proximaFase("offline", false), "restabelecida");
assert.equal(proximaFase("restabelecida", false), "restabelecida");
assert.equal(DURACAO_BANNER_RESTABELECIDO_MS, 3000);
assert.equal(MENSAGEM_MODO_OFFLINE.startsWith("Modo sem conexão"), true);
assert.equal(MENSAGEM_CONEXAO_RESTABELECIDA, "Conexão restabelecida");
assert.equal(MENSAGEM_ACAO_OFFLINE, "Ação indisponível sem conexão com a internet");

console.log("conectividade ok");
