import {
  JANELA_VALIDADE_CURTA_DIAS,
  MARGEM_SEGURANCA_DIAS_PADRAO,
  TEMPO_ENTREGA_CAF_DIAS_PADRAO,
} from "../constants/criticidade-estoque";

const MS_POR_DIA = 86_400_000;
const FORMATO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Resultado da classificação de validade de um lote. */
export interface ClassificacaoValidadeLote {
  vencido: boolean;
  vencendoMesCorrente: boolean;
  validadeCurta90d: boolean;
}

/** Entrada do cálculo de risco de ruptura. */
export interface EntradaRiscoRuptura {
  saldoAtual: number;
  consumoMedioDiario: number;
  tempoEntregaCafDias?: number;
  margemSegurancaDias?: number;
}

/**
 * Converte 'AAAA-MM-DD' em dados UTC, rejeitando datas inexistentes.
 * @throws RangeError se o formato ou a data forem inválidos.
 */
function paraUtc(data: string): { ms: number; ano: number; mes: number } {
  const partes = FORMATO_DATA.exec(data);
  if (!partes) {
    throw new RangeError(`Data inválida (esperado AAAA-MM-DD): ${data}`);
  }
  const ano = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  const ms = Date.UTC(ano, mes - 1, dia);
  const d = new Date(ms);
  if (
    d.getUTCFullYear() !== ano ||
    d.getUTCMonth() !== mes - 1 ||
    d.getUTCDate() !== dia
  ) {
    throw new RangeError(`Data inexistente: ${data}`);
  }
  return { ms, ano, mes };
}

/**
 * Classifica a validade de um lote em relação a "hoje".
 * Vencido (validade < hoje) não conta como mês corrente nem 90d;
 * 90d é inclusivo e contém o mês corrente.
 * @param validade Data de validade 'AAAA-MM-DD'.
 * @param hoje Data de referência 'AAAA-MM-DD' (America/Fortaleza).
 * @throws RangeError se alguma data for inválida.
 */
export function classificarValidadeLote(
  validade: string,
  hoje: string,
): ClassificacaoValidadeLote {
  const v = paraUtc(validade);
  const h = paraUtc(hoje);
  const dias = Math.round((v.ms - h.ms) / MS_POR_DIA);
  const vencido = dias < 0;
  return {
    vencido,
    vencendoMesCorrente: !vencido && v.ano === h.ano && v.mes === h.mes,
    validadeCurta90d: !vencido && dias <= JANELA_VALIDADE_CURTA_DIAS,
  };
}

/**
 * Calcula o consumo médio diário (CMD).
 * @throws RangeError se diasApurados <= 0 ou totalDispensado < 0.
 */
export function calcularConsumoMedioDiario(
  totalDispensado: number,
  diasApurados: number,
): number {
  if (!Number.isFinite(diasApurados) || diasApurados <= 0) {
    throw new RangeError("diasApurados deve ser maior que zero");
  }
  if (!Number.isFinite(totalDispensado) || totalDispensado < 0) {
    throw new RangeError("totalDispensado não pode ser negativo");
  }
  return totalDispensado / diasApurados;
}

/**
 * Calcula a cobertura em dias (saldo / CMD).
 * @returns null quando CMD <= 0 (cobertura indefinida).
 * @throws RangeError se saldo < 0.
 */
export function calcularCoberturaDias(
  saldo: number,
  consumoMedioDiario: number,
): number | null {
  if (!Number.isFinite(saldo) || saldo < 0) {
    throw new RangeError("saldo não pode ser negativo");
  }
  if (!(consumoMedioDiario > 0)) return null;
  return saldo / consumoMedioDiario;
}

/**
 * Indica risco de ruptura: saldo 0 é sempre risco; CMD 0 com saldo > 0 não é;
 * caso contrário, risco se cobertura <= entrega CAF + margem.
 */
export function verificarRiscoRuptura(entrada: EntradaRiscoRuptura): boolean {
  const {
    saldoAtual,
    consumoMedioDiario,
    tempoEntregaCafDias = TEMPO_ENTREGA_CAF_DIAS_PADRAO,
    margemSegurancaDias = MARGEM_SEGURANCA_DIAS_PADRAO,
  } = entrada;
  const cobertura = calcularCoberturaDias(saldoAtual, consumoMedioDiario);
  if (saldoAtual === 0) return true;
  if (cobertura === null) return false;
  return cobertura <= tempoEntregaCafDias + margemSegurancaDias;
}
