import assert from "node:assert/strict";
import type { UsuarioAutenticado } from "@farmaubs/shared";
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
  perfilCodigo: "FARMACEUTICO_RESPONSAVEL",
  municipioId: "m",
  unidadeIds: [],
  deveTrocarSenha: false,
};

const futura = "2026-11-14T13:00:00.000Z";
const passada = "2026-11-14T11:00:00.000Z";

assert.equal(lerSessaoGravada(null, agora).valida, false);
assert.equal(lerSessaoGravada("{", agora).motivo, "corrompida");
assert.equal(lerSessaoGravada(JSON.stringify({ id: "1" }), agora).motivo, "corrompida");
assert.equal(lerSessaoGravada(serializarSessao(usuario, passada), agora).motivo, "expirada");

const lida = lerSessaoGravada(serializarSessao(usuario, futura), agora);
assert.equal(lida.valida, true);
if (lida.valida) assert.equal(lida.usuario.email, usuario.email);

assert.equal(sessaoDeveSerApagada(401, true), true);
assert.equal(sessaoDeveSerApagada(401, false), false);
assert.equal(sessaoDeveSerApagada(500, true), false);
assert.equal(comBearer("abc", { "Content-Type": "application/json" }).Authorization, "Bearer abc");
assert.equal(MENSAGEM_SESSAO_EXPIRADA.includes("sessão expirou"), true);

console.log("session-gravada ok");
