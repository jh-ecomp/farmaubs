/// <reference path="../types/node-assert.d.ts" />
import assert from "node:assert/strict";
import {
  consultasDaBusca,
  intervaloDoPeriodo,
  juntarItens,
  lerPagina,
  rotuloStatus,
  ultimosDigitosCpf,
} from "./historico-dispensacao.ts";

const hoje = new Date("2026-11-20T15:00:00Z");

assert.deepEqual(intervaloDoPeriodo("ONTEM_E_HOJE", hoje), {
  dataInicio: "2026-11-19",
  dataFim: "2026-11-20",
});
assert.deepEqual(intervaloDoPeriodo("HOJE", hoje), {
  dataInicio: "2026-11-20",
  dataFim: "2026-11-20",
});
assert.deepEqual(intervaloDoPeriodo("ULTIMOS_7_DIAS", hoje), {
  dataInicio: "2026-11-14",
  dataFim: "2026-11-20",
});
assert.deepEqual(intervaloDoPeriodo("ESTE_MES", hoje), {
  dataInicio: "2026-11-01",
  dataFim: "2026-11-20",
});

const base = { ubsId: "ubs-1", pagina: 2, limite: 20, dataInicio: "2026-11-19", dataFim: "2026-11-20" };
assert.equal(consultasDaBusca(base, "  ").length, 1);
const buscas = consultasDaBusca(base, "Maria");
assert.equal(buscas[0]?.pacienteTermo, "Maria");
assert.equal(buscas[0]?.pagina, 1);
assert.equal(buscas[1]?.medicamentoTermo, "Maria");
assert.equal(buscas[1]?.pacienteTermo, undefined);

const repetido = {
  id: "1",
  numeroAtendimento: "DISP-1",
  dataAtendimento: "2026-11-20T15:00:00.000Z",
  status: "concluida" as const,
  pacienteNome: "Maria",
  pacienteCpf: "24081571104",
  pacienteCns: "1",
  dispensadorNome: "Farma",
  totalItens: 1,
  medicamentosResumo: "Losartana (30)",
};
assert.equal(juntarItens([{ ...vazio(1), itens: [repetido] }, { ...vazio(1), itens: [repetido] }]).length, 1);
assert.equal(ultimosDigitosCpf("240.815.711-04"), "1104");
assert.equal(rotuloStatus("estornada"), "Estornada");
assert.equal(rotuloStatus("concluida"), "Concluída");

const pagina = lerPagina({
  itens: [repetido],
  totalItens: 1,
  pagina: 1,
  limite: 20,
  totalPaginas: 1,
  dataInicioEfetiva: "2026-11-19",
  dataFimEfetiva: "2026-11-20",
});
assert.equal(pagina?.itens[0]?.numeroAtendimento, "DISP-1");
assert.equal(lerPagina({ itens: [{ id: "x" }] }), null);

function vazio(paginaNumero: number) {
  return {
    itens: [],
    totalItens: 0,
    pagina: paginaNumero,
    limite: 20,
    totalPaginas: 1,
    dataInicioEfetiva: "",
    dataFimEfetiva: "",
  };
}
