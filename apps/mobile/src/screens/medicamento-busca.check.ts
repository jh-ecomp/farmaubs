/// <reference path="../types/node-assert.d.ts" />
import assert from "node:assert/strict";
import {
  lerListaMedicamentos,
  lerSugestaoFefo,
  loteBloqueado,
  mensagemSaldoInsuficiente,
  quantidadeExcedeSaldo,
  termoDeveBuscar,
  textoBadgeFefo,
} from "./medicamento-busca.ts";

assert.equal(termoDeveBuscar(" m"), false);
assert.equal(termoDeveBuscar("me"), true);
assert.equal(quantidadeExcedeSaldo(20, 15), true);
assert.equal(quantidadeExcedeSaldo(15, 15), false);
assert.equal(quantidadeExcedeSaldo(0, 15), true);
assert.equal(mensagemSaldoInsuficiente(15), "Saldo insuficiente no lote selecionado (máximo disponível: 15 un.).");
assert.equal(loteBloqueado({ saldoDisponivel: 0, vencido: false }), true);
assert.equal(loteBloqueado({ saldoDisponivel: 4, vencido: true }), true);
assert.equal(loteBloqueado({ saldoDisponivel: 4, vencido: false }), false);

const lista = lerListaMedicamentos([
  {
    id: "med-1",
    principioAtivo: "Metformina",
    apresentacao: "850 mg",
    antimicrobiano: false,
    saldoTotalUbs: 40,
  },
  { id: "" },
]);
assert.equal(lista.length, 1);
assert.equal(lista[0].principioAtivo, "Metformina");

const sugestao = lerSugestaoFefo({
  medicamento: lista[0],
  loteSugerido: {
    id: "lote-a",
    numeroLote: "L1",
    dataValidade: "2026-12-01",
    saldoDisponivel: 10,
    sugeridoFefo: true,
    diasParaVencimento: 11,
    alertaValidadeCurta: true,
    vencido: false,
  },
  lotesDisponiveis: [
    {
      id: "lote-a",
      numeroLote: "L1",
      dataValidade: "2026-12-01",
      saldoDisponivel: 10,
      sugeridoFefo: true,
      diasParaVencimento: 11,
      alertaValidadeCurta: true,
      vencido: false,
    },
  ],
});
assert.equal(sugestao?.loteSugerido?.sugeridoFefo, true);
assert.equal(
  textoBadgeFefo(sugestao!.loteSugerido!),
  "[Sugerido pelo Sistema (FEFO)] Lote: L1 | Vence: 01/12/2026 | Saldo: 10 un.",
);
assert.equal(lerSugestaoFefo({}), null);
