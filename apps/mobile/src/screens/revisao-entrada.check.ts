/// <reference path="../types/node-assert.d.ts" />
import assert from "node:assert/strict";
import { TipoDocumentoEntradaEnum, type CabecalhoRecebimentoDto, type ItemRecebimentoFormDto } from "@farmaubs/shared";
import { alterarQuantidade, lerEntrada, montarEntrada, temValidadeCurta, totaisDaCarga } from "./revisao-entrada.ts";

function item(id: string, produto: string, qtd: number, curta = false): ItemRecebimentoFormDto {
  return {
    idProvisorio: id,
    produtoId: produto,
    produtoNome: "Dipirona",
    concentracao: "500 mg/mL",
    formaFarmaceutica: "Solução oral",
    fabricanteId: "fab-1",
    fabricanteNome: "Prati-Donaduzzi",
    numeroLote: "LOTE-998",
    dataValidade: "2028-05-22",
    quantidadeRecebida: qtd,
    validadeCurta: curta,
  };
}

const carga = [item("a", "p1", 200), item("b", "p2", 150), item("c", "p1", 250, true)];
assert.deepEqual(totaisDaCarga(carga), { medicamentos: 2, unidades: 600 });
assert.equal(temValidadeCurta(carga), true);
assert.equal(temValidadeCurta([item("a", "p1", 10)]), false);

const alterada = alterarQuantidade(carga, "b", 50.9);
assert.equal(alterada[1]?.quantidadeRecebida, 50);
assert.equal(alterarQuantidade(carga, "b", 0)[1]?.quantidadeRecebida, 150);

const cabecalho: CabecalhoRecebimentoDto = {
  numeroDocumento: " GUIA-2026/099 ",
  tipoDocumento: TipoDocumentoEntradaEnum.GUIA_CAF,
  fornecedorOrigem: "CAF Central - SMS Parnaíba",
  dataRecebimento: "2026-11-22T15:00:00.000Z",
  observacoes: "   ",
};
const pedido = montarEntrada(cabecalho, [item("a", "p1", 10)]);
assert.equal(pedido.numeroDocumento, "GUIA-2026/099");
assert.equal("ubsId" in pedido, false);
assert.equal("observacoes" in pedido, false);
assert.equal(pedido.itens[0]?.quantidadeRecebida, 10);

const recibo = lerEntrada({
  id: "reg-1",
  numeroDocumento: "GUIA-2026/099",
  itens: [],
  avisos: [{ tipo: "VALIDADE_CURTA", lote: "LOTE-998", mensagem: "Lote LOTE-998 vence em menos de 6 meses." }],
});
assert.equal(recibo?.id, "reg-1");
assert.equal(recibo?.avisos.length, 1);
assert.equal(lerEntrada({ ok: true }), null);

console.log("revisao-entrada.check: ok");
