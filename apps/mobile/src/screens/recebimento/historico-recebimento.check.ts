/// <reference path="../../types/node-assert.d.ts" />
import assert from "node:assert/strict";
import {
  CHIPS_RECEBIMENTO,
  PERIODO_INICIAL_RECEBIMENTO,
  consultaHistorico,
  estaEstornado,
  lerDetalhe,
  lerHistorico,
  textoProtocolo,
} from "./historico-recebimento.ts";

assert.equal(PERIODO_INICIAL_RECEBIMENTO, "HOJE");
assert.deepEqual(
  CHIPS_RECEBIMENTO.map((chip) => chip.rotulo),
  ["Hoje", "Últimos 7 dias", "Últimos 30 dias"],
);

const consulta = consultaHistorico("HOJE", "  GUIA-TESTE-A  ", 1);
assert.equal(consulta.periodo, "HOJE");
assert.equal(consulta.termoBusca, "GUIA-TESTE-A");
assert.equal("ubsId" in consulta, false);

const lista = lerHistorico({
  itens: [
    {
      id: "doc-1",
      numeroDocumento: "GUIA-TESTE-A",
      fornecedorOrigem: "CAF Central - SMS Parnaíba",
      dataRecebimento: "2026-11-22T18:00:00.000Z",
      status: "CONCLUIDO",
      totalItens: 1,
      totalUnidades: 200,
    },
  ],
  total: 1,
  pagina: 1,
  totalPaginas: 1,
});
assert.equal(lista?.itens[0]?.numeroDocumento, "GUIA-TESTE-A");
assert.equal(lerHistorico({ ok: true }), null);
assert.equal(estaEstornado("ESTORNADO"), true);
assert.equal(estaEstornado("CONCLUIDO"), false);

const detalhe = lerDetalhe({
  id: "doc-2",
  numeroDocumento: "NF 39100",
  fornecedorOrigem: "Distribuidora Saúde",
  dataRecebimento: "2026-11-22T18:00:00.000Z",
  status: "ESTORNADO",
  totalItens: 1,
  totalUnidades: 10,
  itens: [
    {
      id: "item-1",
      produtoNome: "Dipirona Sódica",
      concentracao: "500 mg/mL",
      fabricanteNome: "Prati-Donaduzzi",
      numeroLote: "LOTE-998",
      dataValidade: "2028-05-22",
      quantidadeRecebida: 10,
    },
  ],
});
assert.equal(detalhe?.status, "ESTORNADO");
const texto = textoProtocolo(detalhe!);
assert.equal(texto.includes("NF 39100"), true);
assert.equal(texto.includes("ESTORNADO"), true);
assert.equal(texto.includes("Cancelado"), true);
assert.equal(texto.includes("LOTE-998"), true);
assert.equal(lerDetalhe({ id: "x" }), null);

console.log("historico-recebimento.check: ok");
