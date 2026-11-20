/// <reference path="../types/node-assert.d.ts" />
import assert from "node:assert/strict";
import {
  cnsDeveSerBuscado,
  cpfDeveSerBuscado,
  erroCpfAoSair,
  lerHistorico,
  lerListaPacientes,
  mensagemAlertaRetirada,
  MENSAGEM_CPF_INVALIDO,
  pacientePronto,
  retiradaRecente,
} from "./paciente-form.ts";

assert.equal(cpfDeveSerBuscado("11122233344"), false);
assert.equal(erroCpfAoSair("11122233344"), MENSAGEM_CPF_INVALIDO);
assert.equal(erroCpfAoSair("52998224725"), null);
assert.equal(cpfDeveSerBuscado("52998224725"), true);
assert.equal(cnsDeveSerBuscado("111111111111111"), false);
assert.equal(cnsDeveSerBuscado("123456789012345"), true);

assert.equal(
  pacientePronto("123456789012345", "529.982.247-25", "Ana Souza", "01/01/1990"),
  true,
);
assert.equal(pacientePronto("123456789012345", "111.222.333-44", "Ana Souza", "01/01/1990"), false);
assert.equal(pacientePronto("123456789012345", "529.982.247-25", "An", "01/01/1990"), false);

assert.equal(
  mensagemAlertaRetirada(12),
  "⚠️ Retirada recente há 12 dias. Tratamento padrão de 30 dias em curso.",
);
assert.equal(retiradaRecente({ diasDesdeUltimaRetirada: 12, possivelUsoIrracional: true }), true);
assert.equal(retiradaRecente({ diasDesdeUltimaRetirada: 40, possivelUsoIrracional: false }), false);

const lista = lerListaPacientes([
  {
    id: "p1",
    cns: "123456789012345",
    cpf: "52998224725",
    nomeCompleto: "Ana Souza",
    dataNascimento: "1990-01-01",
  },
]);
assert.equal(lista.length, 1);
assert.equal(lista[0].nomeCompleto, "Ana Souza");
assert.equal(lerListaPacientes({ termo: "x" }).length, 0);

const historico = lerHistorico({
  itensConsumo: [
    {
      dispensacaoId: "d1",
      medicamentoNome: "Enalapril 10mg",
      dataDispensacao: "2026-11-07",
      quantidadeDispensada: 30,
      diasDesdeUltimaRetirada: 12,
      possivelUsoIrracional: true,
    },
  ],
});
assert.equal(historico[0].medicamentoNome, "Enalapril 10mg");
assert.equal(retiradaRecente(historico[0]), true);
