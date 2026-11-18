/// <reference path="../types/node-assert.d.ts" />
import assert from "node:assert/strict";
import {
  escolherIdUnidade,
  comUnidade,
  lerCatalogoUnidades,
  mensagemUnidadeAlterada,
  podeAlternarUnidade,
  unidadesAutorizadas,
} from "./unidade-ativa.ts";

const catalogo = [
  { id: "a", nome: "UBS Jardim Primavera" },
  { id: "b", nome: "UBS Vila Nova" },
  { id: "c", nome: "UBS Centro" },
];

assert.deepEqual(
  unidadesAutorizadas(catalogo, ["b", "a"]).map((unidade) => unidade.id),
  ["a", "b"],
);
assert.equal(escolherIdUnidade(["a", "b"], "b"), "b");
assert.equal(escolherIdUnidade(["a", "b"], "sumiu"), "a");
assert.equal(escolherIdUnidade(["a"], null), "a");
assert.equal(escolherIdUnidade([], "a"), null);
assert.equal(podeAlternarUnidade(1), false);
assert.equal(podeAlternarUnidade(2), true);
assert.equal(mensagemUnidadeAlterada("UBS Vila Nova"), "Unidade alterada para UBS Vila Nova");
assert.deepEqual(lerCatalogoUnidades([{ id: "a", nome: "UBS" }, { id: "" }, null]), [
  { id: "a", nome: "UBS" },
]);
assert.equal(comUnidade("a", { Authorization: "Bearer t" })["x-unidade-id"], "a");
assert.equal(comUnidade("a", { Authorization: "Bearer t" }).Authorization, "Bearer t");

console.log("unidade-ativa ok");
