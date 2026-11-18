/// <reference path="../types/node-assert.d.ts" />
import assert from "node:assert/strict";
import {
  checklistSenha,
  MENSAGEM_SENHA_ALTERADA,
  MENSAGEM_SENHAS_DIFERENTES,
  podeSalvarSenha,
  senhasCoincidem,
} from "./senha-forte.ts";

const fraca = checklistSenha("senha123");
assert.equal(fraca.find((item) => item.id === "maiuscula")?.atendido, false);
assert.equal(fraca.find((item) => item.id === "especial")?.atendido, false);
assert.equal(podeSalvarSenha("senha123", "senha123"), false);

const forte = "NovaSenha@2026";
assert.equal(checklistSenha(forte).every((item) => item.atendido), true);
assert.equal(senhasCoincidem(forte, forte), true);
assert.equal(senhasCoincidem(forte, "outra"), false);
assert.equal(podeSalvarSenha(forte, forte), true);
assert.equal(MENSAGEM_SENHAS_DIFERENTES, "As senhas não coincidem");
assert.equal(MENSAGEM_SENHA_ALTERADA.includes("Senha alterada"), true);

console.log("senha-forte ok");
