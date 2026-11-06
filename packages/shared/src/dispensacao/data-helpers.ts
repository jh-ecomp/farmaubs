export interface IntervaloDatasEfetivo {
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
}

export interface ValidacaoIntervaloHistoricoResultado {
  valido: boolean;
  dataInicioEfetiva: string;
  dataFimEfetiva: string;
  motivo?: "FORMATO_INVALIDO" | "FIM_ANTERIOR_INICIO" | "INTERVALO_EXCEDE_365_DIAS";
}

/**
 * Retorna o intervalo temporal padrão de ontem (D-1) e hoje (D0) no formato ISO (AAAA-MM-DD) (RF012).
 * @param dataReferencia Data base para o cálculo (padrão: agora).
 * @returns Objeto contendo dataInicio (ontem) e dataFim (hoje).
 */
export function obterIntervaloOntemHoje(
  dataReferencia: Date = new Date(),
): IntervaloDatasEfetivo {
  const hojeUtc = new Date(
    Date.UTC(
      dataReferencia.getUTCFullYear(),
      dataReferencia.getUTCMonth(),
      dataReferencia.getUTCDate(),
    ),
  );
  const ontemUtc = new Date(hojeUtc);
  ontemUtc.setUTCDate(hojeUtc.getUTCDate() - 1);

  return {
    dataInicio: ontemUtc.toISOString().slice(0, 10),
    dataFim: hojeUtc.toISOString().slice(0, 10),
  };
}

/**
 * Resolve e valida o intervalo de datas para consulta ou exportação do histórico de dispensas,
 * aplicando D-1/D0 quando omitido e validando o limite máximo de 365 dias corridos (RF012).
 * @param dataInicio Data inicial opcional (AAAA-MM-DD).
 * @param dataFim Data final opcional (AAAA-MM-DD).
 * @param dataReferencia Data base para fallback padrão (padrão: agora).
 * @returns Resultado com as datas efetivas e status de validade.
 */
export function resolverIntervaloHistoricoDispensacoes(
  dataInicio?: string | null,
  dataFim?: string | null,
  dataReferencia: Date = new Date(),
): ValidacaoIntervaloHistoricoResultado {
  const padrao = obterIntervaloOntemHoje(dataReferencia);
  const inicioEfetivo = dataInicio?.trim() ? dataInicio.trim() : padrao.dataInicio;
  const fimEfetivo = dataFim?.trim() ? dataFim.trim() : padrao.dataFim;

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(inicioEfetivo) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(fimEfetivo)
  ) {
    return {
      valido: false,
      dataInicioEfetiva: inicioEfetivo,
      dataFimEfetiva: fimEfetivo,
      motivo: "FORMATO_INVALIDO",
    };
  }

  const dtInicio = new Date(`${inicioEfetivo}T00:00:00Z`);
  const dtFim = new Date(`${fimEfetivo}T00:00:00Z`);

  if (
    Number.isNaN(dtInicio.getTime()) ||
    Number.isNaN(dtFim.getTime()) ||
    dtInicio.toISOString().slice(0, 10) !== inicioEfetivo ||
    dtFim.toISOString().slice(0, 10) !== fimEfetivo
  ) {
    return {
      valido: false,
      dataInicioEfetiva: inicioEfetivo,
      dataFimEfetiva: fimEfetivo,
      motivo: "FORMATO_INVALIDO",
    };
  }

  if (fimEfetivo < inicioEfetivo) {
    return {
      valido: false,
      dataInicioEfetiva: inicioEfetivo,
      dataFimEfetiva: fimEfetivo,
      motivo: "FIM_ANTERIOR_INICIO",
    };
  }

  const diffDias = Math.round(
    (dtFim.getTime() - dtInicio.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDias > 365) {
    return {
      valido: false,
      dataInicioEfetiva: inicioEfetivo,
      dataFimEfetiva: fimEfetivo,
      motivo: "INTERVALO_EXCEDE_365_DIAS",
    };
  }

  return {
    valido: true,
    dataInicioEfetiva: inicioEfetivo,
    dataFimEfetiva: fimEfetivo,
  };
}

