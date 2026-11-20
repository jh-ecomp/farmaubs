/// <reference path="../types/node-assert.d.ts" />
import assert from "node:assert/strict";
import type { LoteDisponivelDto, MedicamentoBuscaDto } from "@farmaubs/shared";
import {
  alterarQuantidade,
  incluirNoCarrinho,
  isoDaDataLocal,
  mensagemReceitaVencida,
  podeRevisarAtendimento,
  totaisDoCarrinho,
  type ItemCarrinho,
} from "./carrinho.ts";

const hoje = new Date("2026-11-20T15:00:00Z");

function medicamento(parcial: Partial<MedicamentoBuscaDto>): MedicamentoBuscaDto {
  return {
    id: "med",
    principioAtivo: "Losartana",
    apresentacao: "50 mg",
    categoria: "",
    antimicrobiano: false,
    saldoTotalUbs: 100,
    ...parcial,
  };
}

function lote(parcial: Partial<LoteDisponivelDto> = {}): LoteDisponivelDto {
  return {
    id: "lote",
    numeroLote: "L1",
    dataValidade: "2027-01-01",
    saldoDisponivel: 80,
    sugeridoFefo: true,
    diasParaVencimento: 40,
    alertaValidadeCurta: false,
    vencido: false,
    ...parcial,
  };
}

const comum = incluirNoCarrinho([], {
  medicamento: medicamento({ id: "a" }),
  lote: lote({ id: "la", saldoDisponivel: 80 }),
  quantidade: 30,
});
const dois = incluirNoCarrinho(comum, {
  medicamento: medicamento({ id: "b", principioAtivo: "Metformina" }),
  lote: lote({ id: "lb" }),
  quantidade: 30,
});
const ajustado = alterarQuantidade(dois, "b", "lb", 40);
assert.equal(totaisDoCarrinho(ajustado).totalUnidades, 70);
assert.equal(totaisDoCarrinho(ajustado).totalItens, 2);

const azitro: ItemCarrinho[] = incluirNoCarrinho([], {
  medicamento: medicamento({ id: "z", principioAtivo: "Azitromicina", antimicrobiano: true }),
  lote: lote(),
  quantidade: 6,
});
assert.equal(podeRevisarAtendimento(azitro, "", hoje), false);
assert.equal(podeRevisarAtendimento(azitro, "2026-11-08", hoje), false);
assert.equal(podeRevisarAtendimento(azitro, "2026-11-18", hoje), true);
assert.equal(podeRevisarAtendimento(azitro, "2026-11-21", hoje), false);
assert.equal(mensagemReceitaVencida(12), "❌ Receita médica vencida há 12 dias. Dispensação bloqueada pela legislação sanitária.");
assert.equal(isoDaDataLocal(new Date(2026, 10, 8)), "2026-11-08");
