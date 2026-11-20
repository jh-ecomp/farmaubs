import React, { useEffect, useState } from "react";
import type {
  EstoqueMetricasResponseDto,
  FiltroCardsEstoque,
} from "@farmaubs/shared";
import { estoqueService } from "../../../services/estoque.service";

export interface EstoqueCardsMetricasProps {
  metricas?: EstoqueMetricasResponseDto | null;
  carregando?: boolean;
  unidadeId?: string;
  filtroAtivo?: FiltroCardsEstoque;
  onFiltrarPorCard?: (filtro: FiltroCardsEstoque) => void;
}

/**
 * [ES-06 / RF018 / RF022 / RF023 / ADR-032]: Cartões superiores de métricas consolidadas de estoque da UBS.
 * Exibe total de medicamentos, unidades físicas, itens em risco de ruptura e lotes vencendo no mês corrente (em destaque laranja).
 * @param props - Métricas opcionais, flag de carregamento, filtro ativo e callback de atalho de filtragem.
 */
export const EstoqueCardsMetricas: React.FC<EstoqueCardsMetricasProps> = ({
  metricas: metricasProp,
  carregando: carregandoProp,
  unidadeId,
  filtroAtivo,
  onFiltrarPorCard,
}) => {
  const deveBuscarAutomaticamente =
    metricasProp === undefined && carregandoProp === undefined;

  const [metricasFetched, setMetricasFetched] =
    useState<EstoqueMetricasResponseDto | null>(null);
  const [carregandoFetched, setCarregandoFetched] = useState<boolean>(
    deveBuscarAutomaticamente,
  );

  useEffect(() => {
    if (!deveBuscarAutomaticamente) return;
    let cancelado = false;
    setCarregandoFetched(true);
    estoqueService
      .obterMetricas(unidadeId)
      .then((dados) => {
        if (!cancelado) setMetricasFetched(dados);
      })
      .catch(() => {
        // Falha silenciosa preservando estado zerado
      })
      .finally(() => {
        if (!cancelado) setCarregandoFetched(false);
      });
    return () => {
      cancelado = true;
    };
  }, [deveBuscarAutomaticamente, unidadeId]);

  const metricas =
    metricasProp !== undefined ? metricasProp : metricasFetched;
  const carregando =
    carregandoProp !== undefined ? carregandoProp : carregandoFetched;

  const [filtroLocal, setFiltroLocal] = useState<FiltroCardsEstoque>({});

  const filtroEfetivo = filtroAtivo ?? filtroLocal;
  const rupturaAtiva = filtroEfetivo.statusEstoque === "BAIXO_ESTOQUE";
  const validadeMesAtiva = filtroEfetivo.filtroValidade === "MES_CORRENTE";

  const handleClickRuptura = () => {
    const proximoStatus = rupturaAtiva ? "TODOS" : "BAIXO_ESTOQUE";
    const novoFiltro: FiltroCardsEstoque = {
      statusEstoque: proximoStatus,
    };
    setFiltroLocal(novoFiltro);
    onFiltrarPorCard?.({ statusEstoque: "BAIXO_ESTOQUE" });
  };

  const handleClickValidadeMes = () => {
    const proximoValidade = validadeMesAtiva ? "TODOS" : "MES_CORRENTE";
    const novoFiltro: FiltroCardsEstoque = {
      filtroValidade: proximoValidade,
    };
    setFiltroLocal(novoFiltro);
    onFiltrarPorCard?.({ filtroValidade: "MES_CORRENTE" });
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    acao: () => void,
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      acao();
    }
  };

  if (carregando) {
    return (
      <section
        aria-label="Indicadores de estoque carregando"
        aria-busy="true"
        data-testid="estoque-metricas-skeleton"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {[1, 2, 3, 4].map((idx) => (
          <div
            key={idx}
            className="animate-pulse rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
          >
            <div className="mb-3 h-4 w-1/2 rounded bg-slate-200" />
            <div className="mb-2 h-8 w-1/3 rounded bg-slate-200" />
            <div className="h-3 w-2/3 rounded bg-slate-100" />
          </div>
        ))}
      </section>
    );
  }

  const totalMedicamentos = metricas?.totalMedicamentosAtivos ?? 0;
  const totalUnidades = metricas?.totalUnidadesFisicas ?? 0;
  const riscoRuptura = metricas?.itensRiscoRuptura ?? 0;
  const validadeMesAtual = metricas?.lotesValidadeMesAtual ?? 0;
  const validadeCurta90d = metricas?.lotesValidadeCurta90d ?? 0;
  const lotesVencidos = metricas?.lotesVencidos ?? 0;

  return (
    <section
      aria-label="Indicadores consolidados do estoque da UBS"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {/* Card 1: Total de Medicamentos */}
      <div
        data-testid="card-total-medicamentos"
        className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold tracking-wider text-slate-600 uppercase">
            Total de Medicamentos
          </span>
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700"
            aria-hidden="true"
          >
            <span className="material-symbols-outlined text-xl">
              inventory_2
            </span>
          </span>
        </div>
        <div className="mt-2">
          <span
            data-testid="valor-total-medicamentos"
            className="text-2xl font-bold text-slate-900"
          >
            {totalMedicamentos}
          </span>
          <p className="mt-1 text-xs text-slate-600">
            Itens ativos catalogados na unidade
          </p>
        </div>
      </div>

      {/* Card 2: Unidades Físicas em Prateleira */}
      <div
        data-testid="card-total-unidades"
        className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold tracking-wider text-slate-600 uppercase">
            Unidades Físicas em Prateleira
          </span>
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700"
            aria-hidden="true"
          >
            <span className="material-symbols-outlined text-xl">
              medication
            </span>
          </span>
        </div>
        <div className="mt-2">
          <span
            data-testid="valor-total-unidades"
            className="text-2xl font-bold text-slate-900"
          >
            {totalUnidades.toLocaleString("pt-BR")}
          </span>
          <p className="mt-1 text-xs text-slate-600">
            Saldo físico consolidado não vencido
          </p>
        </div>
      </div>

      {/* Card 3: Itens em Risco de Ruptura / Baixo Estoque (Interativo) */}
      <div
        role="button"
        tabIndex={0}
        aria-pressed={rupturaAtiva}
        aria-label={`Itens em Risco de Ruptura: ${riscoRuptura}. Clique para filtrar itens com baixo estoque.`}
        data-testid="card-risco-ruptura"
        data-active={rupturaAtiva ? "true" : "false"}
        onClick={handleClickRuptura}
        onKeyDown={(e) => handleKeyDown(e, handleClickRuptura)}
        className={`flex cursor-pointer flex-col justify-between rounded-xl border p-4 shadow-xs transition-all focus:ring-2 focus:ring-blue-700 focus:outline-none ${
          rupturaAtiva
            ? "border-rose-500 bg-rose-50/70 ring-2 ring-rose-500/30"
            : "border-slate-200 bg-white hover:border-rose-300 hover:bg-slate-50"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold tracking-wider text-slate-700 uppercase">
            Itens em Risco de Ruptura
          </span>
          <span
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${
              riscoRuptura > 0
                ? "bg-rose-100 text-rose-800"
                : "bg-emerald-100 text-emerald-800"
            }`}
            aria-hidden="true"
          >
            <span className="material-symbols-outlined text-xl">
              {riscoRuptura > 0 ? "warning" : "verified"}
            </span>
          </span>
        </div>
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <span
              data-testid="valor-risco-ruptura"
              className={`text-2xl font-bold ${
                riscoRuptura > 0 ? "text-rose-800" : "text-emerald-800"
              }`}
            >
              {riscoRuptura}
            </span>
            {riscoRuptura === 0 && (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                Estoque Saudável
              </span>
            )}
            {rupturaAtiva && (
              <span
                data-testid="indicador-card-ruptura-ativo"
                className="inline-flex items-center rounded-full bg-rose-200 px-2 py-0.5 text-xs font-semibold text-rose-900"
              >
                Filtro ativo
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Cobertura crítica ou saldo zerado (clique para filtrar)
          </p>
        </div>
      </div>

      {/* Card 4: Lotes Vencendo no Mês / Validade Curta (Destaque Laranja RF022 - Interativo) */}
      <div
        role="button"
        tabIndex={0}
        aria-pressed={validadeMesAtiva}
        aria-label={`Lotes Vencendo no Mês: ${validadeMesAtual}. Clique para filtrar lotes com vencimento no mês corrente.`}
        data-testid="card-validade-mes"
        data-active={validadeMesAtiva ? "true" : "false"}
        onClick={handleClickValidadeMes}
        onKeyDown={(e) => handleKeyDown(e, handleClickValidadeMes)}
        className={`flex cursor-pointer flex-col justify-between rounded-xl border p-4 shadow-xs transition-all focus:ring-2 focus:ring-amber-700 focus:outline-none ${
          validadeMesAtiva
            ? "border-amber-600 bg-amber-100/80 text-amber-900 ring-2 ring-amber-500/40"
            : "border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400 hover:bg-amber-100/60"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold tracking-wider text-amber-900 uppercase">
            Lotes Vencendo no Mês
          </span>
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-200/80 text-amber-900"
            aria-hidden="true"
          >
            <span className="material-symbols-outlined text-xl">
              event_busy
            </span>
          </span>
        </div>
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <span
              data-testid="valor-validade-mes"
              className="text-2xl font-bold text-amber-900"
            >
              {validadeMesAtual}
            </span>
            <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
              {validadeCurta90d} em até 90d
            </span>
            {validadeMesAtiva && (
              <span
                data-testid="indicador-card-validade-ativo"
                className="inline-flex items-center rounded-full bg-amber-300 px-2 py-0.5 text-xs font-bold text-amber-950"
              >
                Filtro ativo
              </span>
            )}
          </div>
          <p className="mt-1 text-xs font-medium text-amber-900">
            {lotesVencidos > 0
              ? `${lotesVencidos} lote(s) vencido(s) • Clique para isolar mês atual`
              : "Prioridade FEFO no mês vigente (clique para filtrar)"}
          </p>
        </div>
      </div>
    </section>
  );
};
