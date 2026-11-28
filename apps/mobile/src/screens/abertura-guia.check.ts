/// <reference path="../types/node-assert.d.ts" />
import assert from "node:assert/strict";
import { FORNECEDORES_INSTITUCIONAIS_PADRAO } from "@farmaubs/shared";
import {
  aplicarDia,
  aplicarHora,
  erroNumeroDocumento,
  fornecedorPadrao,
  montarCabecalho,
  podeProsseguirGuia,
  rotuloTipoGuia,
  TIPOS_GUIA,
} from "./abertura-guia.ts";

assert.equal(fornecedorPadrao(), "CAF Central - SMS Parnaíba");
assert.equal(TIPOS_GUIA[0]?.rotulo, "Guia CAF");
assert.equal(TIPOS_GUIA[0]?.valor, "GUIA_CAF");
assert.equal(rotuloTipoGuia("REMESSA_DLOG"), "Remessa DLOG");
assert.equal(rotuloTipoGuia("DOACAO"), "Doação");
assert.equal(FORNECEDORES_INSTITUCIONAIS_PADRAO.length >= 2, true);

const agora = new Date(2026, 10, 20, 14, 5, 30);
assert.equal(podeProsseguirGuia("", "GUIA_CAF", fornecedorPadrao(), agora, ""), false);
assert.equal(podeProsseguirGuia("A", "GUIA_CAF", fornecedorPadrao(), agora, ""), false);
assert.equal(erroNumeroDocumento("A"), "Informe o número do documento fiscal ou guia da CAF");
assert.equal(podeProsseguirGuia("GUIA-2026/099", "GUIA_CAF", fornecedorPadrao(), agora, ""), true);
assert.equal(podeProsseguirGuia("GUIA-2026/099", "OUTRO", fornecedorPadrao(), agora, ""), false);
assert.equal(erroNumeroDocumento("x".repeat(101)), "O número do documento não pode exceder 100 caracteres.");

const cabecalho = montarCabecalho("  GUIA-2026/099 ", "GUIA_CAF", fornecedorPadrao(), agora, "  ");
assert.equal(cabecalho.numeroDocumento, "GUIA-2026/099");
assert.equal(cabecalho.fornecedorOrigem, "CAF Central - SMS Parnaíba");
assert.equal(cabecalho.observacoes, undefined);
assert.equal(cabecalho.dataRecebimento, agora.toISOString());

const comNota = montarCabecalho("NF1", "NOTA_FISCAL", "Secretaria Estadual de Saúde (SESAPI)", agora, " caixa amassada ");
assert.equal(comNota.observacoes, "caixa amassada");
assert.equal(comNota.tipoDocumento, "NOTA_FISCAL");

const outroDia = aplicarDia(agora, new Date(2026, 9, 3, 1, 2, 3));
assert.equal(outroDia.getDate(), 3);
assert.equal(outroDia.getMonth(), 9);
assert.equal(outroDia.getHours(), 14);
assert.equal(outroDia.getMinutes(), 5);

const outraHora = aplicarHora(agora, new Date(2026, 0, 1, 8, 40, 50));
assert.equal(outraHora.getDate(), 20);
assert.equal(outraHora.getHours(), 8);
assert.equal(outraHora.getMinutes(), 40);
assert.equal(outraHora.getSeconds(), 0);
