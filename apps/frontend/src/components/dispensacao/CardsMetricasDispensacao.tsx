export interface CardsMetricasDispensacaoProps {
  totalAtendimentosHoje: number;
  totalUnidadesHoje: number;
  totalPacientesHoje: number;
  unidadeNome?: string;
}

/**
 * [RF010 / NF001]: Cartões de métricas operacionais rápidas do dia na bancada de dispensação da UBS.
 */
export function CardsMetricasDispensacao({
  totalAtendimentosHoje,
  totalUnidadesHoje,
  totalPacientesHoje,
  unidadeNome,
}: CardsMetricasDispensacaoProps) {
  return (
    <section
      aria-label="Indicadores de Dispensação do Dia"
      data-testid="cards-metricas-dispensacao"
      className="grid grid-cols-1 sm:grid-cols-3 gap-3"
    >
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-slate-500">
            Atendimentos Hoje {unidadeNome ? `(${unidadeNome})` : ""}
          </span>
          <p
            data-testid="metrica-atendimentos-hoje"
            className="text-2xl font-bold text-slate-900 mt-0.5"
          >
            {totalAtendimentosHoje}
          </p>
        </div>
        <span
          aria-hidden="true"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700 font-bold text-base"
        >
          📋
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-slate-500">
            Unidades Dispensadas Hoje
          </span>
          <p
            data-testid="metrica-unidades-hoje"
            className="text-2xl font-bold text-emerald-700 mt-0.5"
          >
            {totalUnidadesHoje}
          </p>
        </div>
        <span
          aria-hidden="true"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 font-bold text-base"
        >
          💊
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-slate-500">
            Pacientes Atendidos no Dia
          </span>
          <p
            data-testid="metrica-pacientes-hoje"
            className="text-2xl font-bold text-indigo-700 mt-0.5"
          >
            {totalPacientesHoje}
          </p>
        </div>
        <span
          aria-hidden="true"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 font-bold text-base"
        >
          👥
        </span>
      </div>
    </section>
  );
}

export default CardsMetricasDispensacao;
