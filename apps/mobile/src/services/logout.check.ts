/// <reference path="../types/node-assert.d.ts" />
import assert from "node:assert/strict";
import { encerrarSessao, MENSAGEM_CONFIRMAR_SAIDA } from "./logout.ts";

const ordem: string[] = [];
await encerrarSessao(
  async () => {
    ordem.push("api");
  },
  async () => {
    ordem.push("local");
  },
);
assert.deepEqual(ordem, ["api", "local"]);

let limpou = false;
await assert.rejects(
  encerrarSessao(
    async () => {
      throw new Error("offline");
    },
    async () => {
      limpou = true;
    },
  ),
);
assert.equal(limpou, true);
assert.equal(MENSAGEM_CONFIRMAR_SAIDA, "Deseja realmente sair do FarmaUBS?");

console.log("logout ok");
