import { useState } from "react";
import {
  formatarDataIsoParaBr,
  obterIntervaloOntemHoje,
  type ListarDispensacoesQuery,
} from "@farmaubs/shared";

export type AtalhoPeriodoHistorico =
  | "HOJE"
  | "ONTEM_E_HOJE"
  | "ULTIMOS_7_DIAS"
  | "ULTIMOS_30_DIAS"
  | "PERSONALIZADO";

export interface FiltrosHistoricoDispensacaoProps {
  filtros: ListarDispensacoesQuery;
  atalhoAtivo: AtalhoPeriodoHistorico;
  onAlterarFiltros: (
    novosFiltros: ListarDispensacoesQuery,
    atalho: AtalhoPeriodoHistorico,
  ) => void;
  dataReferencia?: Date;
}

/**
 * [RF012]: Calcula o intervalo de datas ISO (AAAA-MM-DD) para os atalhos rápidos do histórico.
 */
export function calcularIntervaloPorAtalho(
  atalho: Exclude<AtalhoPeriodoHistorico, "PERSONALIZADO">,
  dataRef: Date = new Date(),
): { dataInicio: string; dataFim: string } {
  const baseOntemHoje = obterIntervaloOntemHoje(dataRef);
  const hojeIso = baseOntemHoje.dataFim;

  if (atalho === "HOJE") {
    return { dataInicio: hojeIso, dataFim: hojeIso };
  }
  if (atalho === "ONTEM_E_HOJE") {
    return baseOntemHoje;
  }

  const dtHojeUtc = new Date(`${hojeIso}T00:00:00Z`);
  const diasSubtrair = atalho === "ULTIMOS_7_DIAS" ? 6 : 29;
  const dtInicioUtc = new Date(dtHojeUtc);
  dtInicioUtc.setUTCDate(dtHojeUtc.getUTCDate() - diasSubtrair);

  return {
    dataInicio: dtInicioUtc.toISOString().slice(0, 10),
    dataFim: hojeIso,
  };
}

/**
 * [RF012 / ADR-032]: Barra de filtros do histórico de dispensas com atalho padrão "Ontem e Hoje" (D-1 e D0),
 * seletor de range customizado com validação de datas e filtros combinados (paciente, medicamento, categoria e status).
 */
export function FiltrosHistoricoDispensacao({
  filtros,
  atalhoAtivo,
  onAlterarFiltros,
  dataReferencia,
}: FiltrosHistoricoDispensacaoProps) {
  const padraoOntemHoje = obterIntervaloOntemHoje(dataReferencia ?? new Date());
  const dataInicioAtual = filtros.dataInicio || padraoOntemHoje.dataInicio;
  const dataFimAtual = filtros.dataFim || padraoOntemHoje.dataFim;

  const [erroIntervalo, setErroIntervalo] = useState<string | null>(null);

  const selecionarAtalho = (atalho: AtalhoPeriodoHistorico) => {
    setErroIntervalo(null);
    if (atalho === "PERSONALIZADO") {
      onAlterarFiltros(
        {
          ...filtros,
          dataInicio: dataInicioAtual,
          dataFim: dataFimAtual,
          pagina: 1,
        },
        "PERSONALIZADO",
      );
      return;
    }

    const intervalo = calcularIntervaloPorAtalho(atalho, dataReferencia);
    onAlterarFiltros(
      {
        ...filtros,
        dataInicio: intervalo.dataInicio,
        dataFim: intervalo.dataFim,
        pagina: 1,
      },
      atalho,
    );
  };

  const handleDataPersonalizadaChange = (
    campo: "dataInicio" | "dataFim",
    valor: string,
  ) => {
    const novoInicio = campo === "dataInicio" ? valor : dataInicioAtual;
    const novoFim = campo === "dataFim" ? valor : dataFimAtual;

    if (novoInicio && novoFim && novoFim < novoInicio) {
      setErroIntervalo(
        "A Data Fim não pode ser anterior à Data Início selecionada.",
      );
      return;
    }

    setErroIntervalo(null);
    onAlterarFiltros(
      {
        ...filtros,
        dataInicio: novoInicio,
        dataFim: novoFim,
        pagina: 1,
      },
      "PERSONALIZADO",
    );
  };

  const rotuloAtalho =
    atalhoAtivo === "ONTEM_E_HOJE"
      ? "Ontem e Hoje"
      : atalhoAtivo === "HOJE"
        ? "Hoje"
        : atalhoAtivo === "ULTIMOS_7_DIAS"
          ? "Últimos 7 dias"
          : atalhoAtivo === "ULTIMOS_30_DIAS"
            ? "Últimos 30 dias"
            : "Período Personalizado";

  return (
    <section
      aria-label="Filtros do Histórico de Dispensações"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-4"
    >
      {/* Linha Superior: Atalhos Temporais e Badge do Período Vigente */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Atalhos de período"
          className="flex flex-wrap items-center gap-1.5"
        >
          {(
            [
              { id: "HOJE", label: "Hoje" },
              { id: "ONTEM_E_HOJE", label: "Ontem e Hoje" },
              { id: "ULTIMOS_7_DIAS", label: "Últimos 7 dias" },
              { id: "ULTIMOS_30_DIAS", label: "Últimos 30 dias" },
              { id: "PERSONALIZADO", label: "Período Personalizado" },
            ] as const
          ).map((item) => {
            const ativo = atalhoAtivo === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={ativo}
                onClick={() => selecionarAtalho(item.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  ativo
                    ? "bg-blue-700 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <span
          data-testid="badge-periodo-vigente"
          className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900 border border-blue-200"
        >
          {rotuloAtalho}: {formatarDataIsoParaBr(dataInicioAtual)} a{" "}
          {formatarDataIsoParaBr(dataFimAtual)}
        </span>
      </div>

      {/* Seletor de Range Customizado (Datas Início e Fim) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 items-end">
        <div>
          <label
            htmlFor="filtro-data-inicio"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Data Início
          </label>
          <input
            id="filtro-data-inicio"
            type="date"
            value={dataInicioAtual}
            onChange={(e) =>
              handleDataPersonalizadaChange("dataInicio", e.target.value)
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
          />
        </div>

        <div>
          <label
            htmlFor="filtro-data-fim"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Data Fim
          </label>
          <input
            id="filtro-data-fim"
            type="date"
            value={dataFimAtual}
            onChange={(e) =>
              handleDataPersonalizadaChange("dataFim", e.target.value)
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
          />
        </div>

        {/* Filtro por Paciente */}
        <div>
          <label
            htmlFor="filtro-paciente-termo"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Paciente (CPF, CNS ou Nome)
          </label>
          <input
            id="filtro-paciente-termo"
            type="text"
            placeholder="Buscar paciente..."
            value={filtros.pacienteTermo ?? ""}
            onChange={(e) =>
              onAlterarFiltros(
                {
                  ...filtros,
                  pacienteTermo: e.target.value || undefined,
                  pagina: 1,
                },
                atalhoAtivo,
              )
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
          />
        </div>

        {/* Filtro por Medicamento */}
        <div>
          <label
            htmlFor="filtro-medicamento-termo"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Medicamento
          </label>
          <input
            id="filtro-medicamento-termo"
            type="text"
            placeholder="Ex.: Losartana..."
            value={filtros.medicamentoTermo ?? ""}
            onChange={(e) =>
              onAlterarFiltros(
                {
                  ...filtros,
                  medicamentoTermo: e.target.value || undefined,
                  pagina: 1,
                },
                atalhoAtivo,
              )
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
          />
        </div>

        {/* Filtro por Categoria */}
        <div>
          <label
            htmlFor="filtro-categoria-select"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Categoria
          </label>
          <select
            id="filtro-categoria-select"
            value={filtros.categoria ?? ""}
            onChange={(e) =>
              onAlterarFiltros(
                {
                  ...filtros,
                  categoria: e.target.value || undefined,
                  pagina: 1,
                },
                atalhoAtivo,
              )
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
          >
            <option value="">Todas as categorias</option>
            <option value="BASICO">Componente Básico</option>
            <option value="ANTIMICROBIANO">Antimicrobianos</option>
            <option value="CONTROLADO">Controle Especial</option>
            <option value="ESTRATEGICO">Componente Estratégico</option>
          </select>
        </div>

        {/* Filtro por Status */}
        <div>
          <label
            htmlFor="filtro-status-select"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Status do Atendimento
          </label>
          <select
            id="filtro-status-select"
            value={filtros.status ?? ""}
            onChange={(e) =>
              onAlterarFiltros(
                {
                  ...filtros,
                  status: (e.target.value || undefined) as
                    | "concluida"
                    | "estornada"
                    | undefined,
                  pagina: 1,
                },
                atalhoAtivo,
              )
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
          >
            <option value="">Todas</option>
            <option value="concluida">Apenas Concluídas</option>
            <option value="estornada">Estornadas</option>
          </select>
        </div>
      </div>

      {erroIntervalo && (
        <p
          role="alert"
          data-testid="erro-intervalo-datas"
          className="text-xs font-semibold text-red-600"
        >
          {erroIntervalo}
        </p>
      )}
    </section>
  );
}

export default FiltrosHistoricoDispensacao;
