/// <reference path="../types/node-assert.d.ts" />
import assert from "node:assert/strict";
import { PerfilCodigo, type UsuarioAutenticado } from "@farmaubs/shared";
import {
  comBearer,
  lerSessaoGravada,
  MENSAGEM_SESSAO_EXPIRADA,
  serializarSessao,
  sessaoDeveSerApagada,
} from "./session-gravada.ts";

const agora = Date.parse("2026-11-14T12:00:00.000Z");

const usuario: UsuarioAutenticado = {
  id: "1",
  nomeCompleto: "Ana Souza",
  email: "ana.souza@farmaubs.local",
  perfilCodigo: PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
  municipioId: "m",
  unidadeIds: [],
  deveTrocarSenha: false,
};

const futura = "2026-11-14T13:00:00.000Z";
const passada = "2026-11-14T11:00:00.000Z";

assert.equal(lerSessaoGravada(null, agora).valida, false);

const jsonRuim = lerSessaoGravada("{", agora);
const incompleta = lerSessaoGravada(JSON.stringify({ id: "1" }), agora);
const vencida = lerSessaoGravada(serializarSessao(usuario, passada), agora);
if (jsonRuim.valida || incompleta.valida || vencida.valida) throw new Error("sessao valida");
assert.equal(jsonRuim.motivo, "corrompida");
assert.equal(incompleta.motivo, "corrompida");
assert.equal(vencida.motivo, "expirada");

const lida = lerSessaoGravada(serializarSessao(usuario, futura), agora);
assert.equal(lida.valida, true);
if (lida.valida) assert.equal(lida.usuario.email, usuario.email);

assert.equal(sessaoDeveSerApagada(401, true), true);
assert.equal(sessaoDeveSerApagada(401, false), false);
assert.equal(sessaoDeveSerApagada(500, true), false);
assert.equal(comBearer("abc", { "Content-Type": "application/json" }).Authorization, "Bearer abc");
assert.equal(MENSAGEM_SESSAO_EXPIRADA.includes("sessão expirou"), true);

console.log("session-gravada ok");
