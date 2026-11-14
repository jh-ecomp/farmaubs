export type MotivoReceitaInvalida =
  | "AUSENTE"
  | "DATA_INVALIDA"
  | "DATA_FUTURA"
  | "PRAZO_EXPIRADO";

export interface ValidacaoReceitaAntimicrobianoResultado {
  valida: boolean;
  motivo?: MotivoReceitaInvalida;
  diasDecorridos?: number;
}

/**
 * Valida a data de emissão da receita médica quando há medicamento antimicrobiano na dispensa,
 * exigindo data válida não futura e com no máximo 10 dias corridos (RF010).
 * @param receitaEmissaoEm Data de emissão da receita no formato ISO (AAAA-MM-DD).
 * @param contemAntimicrobiano Indica se ao menos um item da dispensação é antimicrobiano.
 * @param dataReferencia Data base do atendimento (padrão: hoje).
 * @returns Resultado indicando se a receita é válida e eventual motivo de rejeição.
 */
export function validarReceitaAntimicrobiano(
  receitaEmissaoEm: string | undefined | null,
  contemAntimicrobiano: boolean,
  dataReferencia: Date = new Date(),
): ValidacaoReceitaAntimicrobianoResultado {
  if (!contemAntimicrobiano) {
    return { valida: true };
  }

  const emissaoStr = receitaEmissaoEm ? receitaEmissaoEm.trim() : "";
  if (!emissaoStr) {
    return { valida: false, motivo: "AUSENTE" };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(emissaoStr)) {
    return { valida: false, motivo: "DATA_INVALIDA" };
  }

  const emissaoUtc = new Date(`${emissaoStr}T00:00:00Z`);
  if (
    Number.isNaN(emissaoUtc.getTime()) ||
    emissaoUtc.toISOString().slice(0, 10) !== emissaoStr
  ) {
    return { valida: false, motivo: "DATA_INVALIDA" };
  }

  const hojeStr = dataReferencia.toISOString().slice(0, 10);
  const hojeUtc = new Date(`${hojeStr}T00:00:00Z`);

  if (emissaoStr > hojeStr) {
    return { valida: false, motivo: "DATA_FUTURA" };
  }

  const diasDecorridos = Math.round(
    (hojeUtc.getTime() - emissaoUtc.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diasDecorridos > 10) {
    return {
      valida: false,
      motivo: "PRAZO_EXPIRADO",
      diasDecorridos,
    };
  }

  return {
    valida: true,
    diasDecorridos,
  };
}

