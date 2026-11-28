/// <reference path="../types/node-assert.d.ts" />
import assert from "node:assert/strict";
import type { LoteDisponivelDto, MedicamentoBuscaDto, PacienteDispensacaoRequest } from "@farmaubs/shared";
import type { ItemCarrinho } from "./carrinho.ts";
import {
  ehFalhaSaldo,
  formatarDataHoraAtendimento,
  lerResultado,
  montarPedido,
  protocoloAtendimento,
  textoComprovante,
} from "./fechamento.ts";

const paciente: PacienteDispensacaoRequest = {
  id: "pac-1",
  cns: "700400100000291",
  cpf: "24081571104",
  nomeCompleto: "Maria das Graças Veras Machado",
  dataNascimento: "1947-03-07",
};

function medicamento(parcial: Partial<MedicamentoBuscaDto>): MedicamentoBuscaDto {
  return {
    id: "med",
    principioAtivo: "Metformina",
    apresentacao: "850 mg",
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
    dataValidade: "2027-06-01",
    saldoDisponivel: 80,
    sugeridoFefo: true,
    diasParaVencimento: 90,
    alertaValidadeCurta: false,
    vencido: false,
    ...parcial,
  };
}

const comum: ItemCarrinho = {
  medicamento: medicamento({}),
  lote: lote(),
  quantidade: 30,
  posologia: "1 cp a cada 8h por 5 dias",
};

const pedidoComum = montarPedido(paciente, [comum], "2026-11-18", "ubs-1");
assert.equal(pedidoComum.receitaEmissaoEm, undefined);
assert.equal(pedidoComum.itens[0]?.quantidadeDispensada, 30);
assert.equal(pedidoComum.ubsId, "ubs-1");

const azitro: ItemCarrinho = {
  medicamento: medicamento({ id: "azi", principioAtivo: "Azitromicina", antimicrobiano: true }),
  lote: lote({ id: "lote-azi", numeroLote: "AZ1" }),
  quantidade: 3,
  posologia: "",
};
const pedidoAzi = montarPedido(paciente, [azitro], "2026-11-18", null);
assert.equal(pedidoAzi.receitaEmissaoEm, "2026-11-18");
assert.equal(pedidoAzi.ubsId, undefined);
assert.equal(pedidoAzi.itens[0]?.posologia, undefined);

assert.equal(ehFalhaSaldo(409, "conflito"), true);
assert.equal(
  ehFalhaSaldo(400, 'Saldo insuficiente no lote "L1": disponível 2, solicitado 30.'),
  true,
);
assert.equal(ehFalhaSaldo(400, "Receita de antimicrobiano ausente."), false);

assert.equal(protocoloAtendimento("DISP-1790"), "#DISP-1790");
assert.equal(protocoloAtendimento("#DSP-2026-0089"), "#DSP-2026-0089");
assert.equal(formatarDataHoraAtendimento(new Date(2026, 10, 20, 14, 5)), "20/11/2026 14:05");

const recibo = lerResultado({
  id: "disp-1",
  numeroAtendimento: "DISP-1790",
  dataAtendimento: "2026-11-20T15:00:00.000Z",
  status: "concluida",
  paciente: { id: "pac-1", nomeCompleto: paciente.nomeCompleto, cpf: paciente.cpf, cns: paciente.cns },
  dispensador: { id: "farm-1", nomeCompleto: "Farmacêutico Parnaíba" },
  itens: [
    {
      itemId: "item-1",
      medicamentoId: "med",
      medicamentoNome: "Metformina",
      loteId: "lote",
      numeroLote: "L1",
      quantidadeDispensada: 30,
      saldoRestanteLote: 50,
    },
  ],
});
assert.equal(recibo?.numeroAtendimento, "DISP-1790");
assert.equal(recibo?.dispensador.nomeCompleto, "Farmacêutico Parnaíba");
assert.equal(lerResultado({ id: "x" }), null);

const texto = textoComprovante({
  numeroAtendimento: "DISP-1790",
  dataHora: "20/11/2026 12:00",
  ubsNome: "UBS Centro",
  farmaceutico: "Farmacêutico Parnaíba",
  pacienteNome: paciente.nomeCompleto,
  linhas: [{ nome: "Metformina", lote: "L1", quantidade: 30, posologia: "1 cp a cada 8h por 5 dias" }],
});
assert.ok(texto.includes("Atendimento #DISP-1790"));
assert.ok(texto.includes("1 cp a cada 8h por 5 dias"));
assert.ok(texto.includes("UBS Centro"));
