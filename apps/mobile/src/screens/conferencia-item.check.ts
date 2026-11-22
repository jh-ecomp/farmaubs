/// <reference path="../types/node-assert.d.ts" />
import assert from "node:assert/strict";
import type { FabricanteResponseDto, ProdutoCatalogoResponseDto } from "@farmaubs/shared";
import {
  avaliarValidade,
  erroDoItem,
  lerProdutosCatalogo,
  mensagemValidadeCurta,
  montarItemConferencia,
  nomeDoProduto,
  somarPasso,
} from "./conferencia-item.ts";

const hoje = new Date("2026-11-22T15:00:00Z");
const produto: ProdutoCatalogoResponseDto = {
  id: "p1",
  principioAtivo: "Dipirona Sódica",
  nomeComercial: "Dipirona Gotas",
  dosagem: "500 mg/mL",
  formaFarmaceutica: "Solução oral",
  categoria: "ANALGESICO",
  antimicrobiano: false,
  ativo: true,
};
const fabricante: FabricanteResponseDto = {
  id: "f1",
  razaoSocial: "Prati, Donaduzzi & Cia Ltda",
  nomeFantasia: "Prati-Donaduzzi",
  ativo: true,
};

assert.equal(nomeDoProduto(produto), "Dipirona Sódica 500 mg/mL - Solução oral");
assert.equal(avaliarValidade("2026-10-22", hoje)?.status, "VENCIDO");
assert.equal(avaliarValidade("2026-12-22", hoje)?.status, "VALIDADE_CURTA");
assert.equal(avaliarValidade("2028-05-22", hoje)?.status, "NORMAL");
assert.equal(avaliarValidade("", hoje), null);
assert.match(mensagemValidadeCurta(30), /vence em 30 dias/);

assert.equal(erroDoItem(null, "f1", "LOTE-998", "2028-05-22", "200", hoje)?.includes("medicamento"), true);
assert.equal(erroDoItem(produto, "", "LOTE-998", "2028-05-22", "200", hoje)?.includes("fabricante"), true);
assert.equal(erroDoItem(produto, "f1", "LOTE-998", "2026-10-22", "200", hoje)?.startsWith("❌"), true);
assert.equal(erroDoItem(produto, "f1", "LOTE-998", "2028-05-22", "200", hoje), null);
assert.equal(erroDoItem(produto, "f1", "LOTE-998", "2026-12-22", "200", hoje), null);

assert.equal(somarPasso("", 10), "10");
assert.equal(somarPasso("10", 50), "60");
assert.equal(somarPasso("60", 100), "160");

const item = montarItemConferencia(produto, fabricante, " lote-998 ", "2028-05-22", 200, hoje);
assert.equal(item.numeroLote, "LOTE-998");
assert.equal(item.fabricanteNome, "Prati-Donaduzzi");
assert.equal(item.quantidadeRecebida, 200);
assert.equal(item.validadeCurta, false);

const curto = montarItemConferencia(produto, fabricante, "LT1", "2026-12-22", 10, hoje);
assert.equal(curto.validadeCurta, true);

assert.equal(lerProdutosCatalogo([{ id: "p1", principioAtivo: "Dipirona Sódica" }])?.[0]?.principioAtivo, "Dipirona Sódica");
assert.equal(lerProdutosCatalogo([{ id: "x" }]), null);
