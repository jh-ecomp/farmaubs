import type {
  StatusEstoque,
  StatusValidadeLote,
} from "../estoque/saldos.types";
import {
  classificarValidadeLote,
  verificarRiscoRuptura,
  type ClassificacaoValidadeLote,
} from "./criticidade-estoque";

/** Traduz a classificação da ES-01 no status semântico do lote (prioridade: vencido, mês, 90d). */
export function statusValidadePorClassificacao(
  c: ClassificacaoValidadeLote,
): StatusValidadeLote {
  if (c.vencido) return "VENCIDO";
  if (c.vencendoMesCorrente) return "MES_CORRENTE";
  if (c.validadeCurta90d) return "CURTA_90D";
  return "REGULAR";
}

/**
 * Status semântico de validade de um lote.
 * @param validade 'AAAA-MM-DD'.
 * @param hoje 'AAAA-MM-DD' (fuso da UBS).
 * @throws RangeError se alguma data for inválida.
 */
export function calcularStatusValidade(
  validade: string,
  hoje: string,
): StatusValidadeLote {
  return statusValidadePorClassificacao(classificarValidadeLote(validade, hoje));
}

/** Ordena lotes por validade crescente (FEFO); empate pelo número do lote. Não altera o array de entrada. */
export function ordenarLotesSaldoPorFEFO<
  T extends { dataValidade: string; numeroLote: string },
>(lotes: readonly T[]): T[] {
  return [...lotes].sort(
    (a, b) =>
      a.dataValidade.localeCompare(b.dataValidade) ||
      a.numeroLote.localeCompare(b.numeroLote),
  );
}

/**
 * Situação do saldo: ZERADO (saldo 0), BAIXO_ESTOQUE (risco de ruptura da ES-01) ou REGULAR.
 */
export function calcularStatusEstoque(
  saldoTotal: number,
  consumoMedioDiario: number,
): StatusEstoque {
  if (saldoTotal <= 0) return "ZERADO";
  return verificarRiscoRuptura({ saldoAtual: saldoTotal, consumoMedioDiario })
    ? "BAIXO_ESTOQUE"
    : "REGULAR";
}
