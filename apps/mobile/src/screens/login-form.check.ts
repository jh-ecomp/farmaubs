import assert from "node:assert/strict";
import {
  classificarErroLogin,
  lerLoginSucesso,
  MENSAGEM_CAMPOS_VAZIOS,
  MENSAGEM_EMAIL_INVALIDO,
  validarCamposLogin,
} from "./login-form.ts";

assert.equal(validarCamposLogin("", ""), MENSAGEM_CAMPOS_VAZIOS);
assert.equal(validarCamposLogin("a", "senha"), MENSAGEM_EMAIL_INVALIDO);
assert.equal(validarCamposLogin("farmaceutico@ubs.gov.br", "SenhaForte@2026"), null);

assert.equal(classificarErroLogin(401, undefined).tipo, "credenciais");
assert.equal(classificarErroLogin(429, 15).tipo, "bloqueio");
assert.equal(classificarErroLogin(423, 15).tipo, "bloqueio");
assert.equal(classificarErroLogin(500, undefined).tipo, "rede");

assert.equal(lerLoginSucesso({ token: "", usuario: { id: "1" } }), null);
assert.equal(
  lerLoginSucesso({ token: "abc", usuario: { id: "1", deveTrocarSenha: false } })?.token,
  "abc",
);

console.log("login-form ok");
