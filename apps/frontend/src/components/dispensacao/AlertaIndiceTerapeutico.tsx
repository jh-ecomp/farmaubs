import {
  ehMedicamentoIndiceTerapeuticoEstreito,
  type MedicamentoBuscaDto,
} from "@farmaubs/shared";

export interface AlertaIndiceTerapeuticoProps {
  medicamento: Pick<
    MedicamentoBuscaDto,
    "principioAtivo" | "nomeComercial" | "indiceTerapeuticoEstreito"
  >;
}

/**
 * [RF010 / ADR-032]: Exibe banner clínico para medicamentos de Índice Terapêutico Estreito
 * (ex.: Digoxina, Lítio, Varfarina, Carbamazepina) orientando conferência rigorosa de dosagem.
 * @param props - Dados do medicamento selecionado.
 */
export function AlertaIndiceTerapeutico({
  medicamento,
}: AlertaIndiceTerapeuticoProps) {
  if (!ehMedicamentoIndiceTerapeuticoEstreito(medicamento)) {
    return null;
  }

  return (
    <div
      role="note"
      aria-label="Alerta de Índice Terapêutico Estreito"
      data-testid="alerta-indice-terapeutico"
      className="rounded-lg border border-purple-300 bg-purple-50 p-3 text-xs text-purple-950 flex items-start gap-2"
    >
      <span aria-hidden="true" className="text-sm font-bold text-purple-700">
        ⚕️
      </span>
      <div>
        <strong className="font-semibold">
          Atenção: Medicamento de Índice Terapêutico Estreito
        </strong>{" "}
        — oriente a posologia e confirme a dosagem com o paciente antes da
        entrega.
      </div>
    </div>
  );
}

export default AlertaIndiceTerapeutico;
