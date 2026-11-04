import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  FiltroHistoricoRecebimento,
  HistoricoRecebimentoPaginado,
  ItemResumoHistoricoRecebimento,
} from "@farmaubs/shared";
import { recebimentoService } from "../../../services/recebimento.service";
import { TermoRecebimentoModal } from "./TermoRecebimentoModal";
import { EstornoEntradaModal } from "./EstornoEntradaModal";
import {
  Calendar,
  Download,
  FileText,
  RotateCcw,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";

type AtalhoPeriodo =
  | "ONTEM_E_HOJE"
  | "ULTIMOS_7_DIAS"
  | "ULTIMOS_30_DIAS"
  | "ESTE_MES"
  | "PERSONALIZADO";

/**
 * Formata uma instância de Date como YYYY-MM-DD local.
 * @param d - Instância de Date.
 * @returns String YYYY-MM-DD.
 */
function paraIsoLocalDate(d: Date): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/**
 * Formata string YYYY-MM-DD para DD/MM/YYYY.
 * @param iso - Data YYYY-MM-DD.
 * @returns Data DD/MM/YYYY.
 */
function formatarDataCurtaPtBr(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/**
 * Calcula o intervalo de datas (YYYY-MM-DD) para um atalho predefinido.
 * @param atalho - Identificador do atalho de período.
 * @param base - Data base de referência (padrão: hoje).
 * @returns Objeto com dataInicio e dataFim em YYYY-MM-DD.
 */
function calcularIntervaloAtalho(
  atalho: Exclude<AtalhoPeriodo, "PERSONALIZADO">,
  base: Date = new Date(),
): { dataInicio: string; dataFim: string; rotulo: string } {
  const fim = new Date(base);
  const inicio = new Date(base);

  if (atalho === "ONTEM_E_HOJE") {
    inicio.setDate(fim.getDate() - 1);
    return {
      dataInicio: paraIsoLocalDate(inicio),
      dataFim: paraIsoLocalDate(fim),
      rotulo: `Ontem e Hoje (${formatarDataCurtaPtBr(paraIsoLocalDate(inicio))} até ${formatarDataCurtaPtBr(paraIsoLocalDate(fim))})`,
    };
  }

  if (atalho === "ULTIMOS_7_DIAS") {
    inicio.setDate(fim.getDate() - 7);
    return {
      dataInicio: paraIsoLocalDate(inicio),
      dataFim: paraIsoLocalDate(fim),
      rotulo: "Últimos 7 dias",
    };
  }

  if (atalho === "ULTIMOS_30_DIAS") {
    inicio.setDate(fim.getDate() - 30);
    return {
      dataInicio: paraIsoLocalDate(inicio),
      dataFim: paraIsoLocalDate(fim),
      rotulo: "Últimos 30 dias",
    };
  }

  // ESTE_MES
  inicio.setDate(1);
  return {
    dataInicio: paraIsoLocalDate(inicio),
    dataFim: paraIsoLocalDate(fim),
    rotulo: "Este Mês",
  };
}

/**
 * Painel de histórico e conferência de guias de recebimento com filtro padrão D-1/D0,
 * exportação em Excel (.xlsx), emissão do Termo SUS e estorno auditável.
 */
export const HistoricoRecebimentosPainel: React.FC = () => {
  const queryClient = useQueryClient();

  const intervaloInicial = calcularIntervaloAtalho("ONTEM_E_HOJE");

  const [atalhoAtivo, setAtalhoAtivo] =
    useState<AtalhoPeriodo>("ONTEM_E_HOJE");
  const [dataInicioInput, setDataInicioInput] = useState(
    intervaloInicial.dataInicio,
  );
  const [dataFimInput, setDataFimInput] = useState(intervaloInicial.dataFim);
  const [erroPeriodo, setErroPeriodo] = useState<string | null>(null);

  const [filtrosDataAplicados, setFiltrosDataAplicados] = useState<{
    dataInicio: string;
    dataFim: string;
    rotulo: string;
  }>(intervaloInicial);

  const [buscaDigitada, setBuscaDigitada] = useState("");
  const [termoBuscaDebounced, setTermoBuscaDebounced] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<
    "TODOS" | "CONCLUIDO" | "ESTORNADO"
  >("TODOS");
  const [pagina, setPagina] = useState(1);

  // Modais e estados auxiliares
  const [exportandoXlsx, setExportandoXlsx] = useState(false);
  const [mensagemFeedback, setMensagemFeedback] = useState<string | null>(null);
  const [entradaComprovante, setEntradaComprovante] =
    useState<ItemResumoHistoricoRecebimento | null>(null);
  const [entradaEstorno, setEntradaEstorno] =
    useState<ItemResumoHistoricoRecebimento | null>(null);
  const [estornosRecentes, setEstornosRecentes] = useState<
    Record<string, { motivoEstorno: string; dataEstorno: Date | string }>
  >({});

  // Debounce 300ms da busca textual
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTermoBuscaDebounced(buscaDigitada.trim());
      setPagina(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [buscaDigitada]);

  const queryParams: FiltroHistoricoRecebimento = {
    periodo: "CUSTOMIZADO",
    dataInicio: filtrosDataAplicados.dataInicio,
    dataFim: filtrosDataAplicados.dataFim,
    termoBusca: termoBuscaDebounced || undefined,
    status: statusFiltro,
    pagina,
    limite: 20,
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["ultimos-recebimentos", queryParams],
    queryFn: () => recebimentoService.listarHistorico(queryParams),
  });

  const handleSelecionarAtalho = (novoAtalho: AtalhoPeriodo) => {
    setErroPeriodo(null);
    setAtalhoAtivo(novoAtalho);

    if (novoAtalho !== "PERSONALIZADO") {
      const calculado = calcularIntervaloAtalho(novoAtalho);
      setDataInicioInput(calculado.dataInicio);
      setDataFimInput(calculado.dataFim);
      setFiltrosDataAplicados(calculado);
      setPagina(1);
    }
  };

  const handleAplicarPeriodoPersonalizado = (e: React.FormEvent) => {
    e.preventDefault();
    setErroPeriodo(null);

    if (!dataInicioInput || !dataFimInput) {
      setErroPeriodo("Informe a data inicial e a data final para filtrar.");
      return;
    }

    if (dataInicioInput > dataFimInput) {
      setErroPeriodo("A data inicial não pode ser posterior à data final");
      return;
    }

    setFiltrosDataAplicados({
      dataInicio: dataInicioInput,
      dataFim: dataFimInput,
      rotulo: `${formatarDataCurtaPtBr(dataInicioInput)} até ${formatarDataCurtaPtBr(dataFimInput)}`,
    });
    setPagina(1);
  };

  const handleExportarXlsx = async () => {
    if (exportandoXlsx) return;
    setExportandoXlsx(true);
    try {
      const { blob, nomeArquivo } =
        await recebimentoService.exportarHistoricoXlsx(queryParams);
      if (typeof URL.createObjectURL === "function") {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = nomeArquivo;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }
    } catch {
      // Erro silencioso ou notificado na UI
    } finally {
      setExportandoXlsx(false);
    }
  };

  const itens = (data?.itens ?? []).map((item) => {
    const estornoLocal = estornosRecentes[item.id];
    if (!estornoLocal) return item;
    return {
      ...item,
      status: "ESTORNADO" as const,
      podeEstornar: false,
      motivoEstorno: estornoLocal.motivoEstorno,
      dataEstorno: estornoLocal.dataEstorno,
    };
  });

  return (
    <section
      aria-labelledby="titulo-historico-recebimentos"
      className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4"
    >
      {/* Cabeçalho e Botão Exportar Excel */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h2
            id="titulo-historico-recebimentos"
            className="text-base font-semibold text-slate-900"
          >
            Últimos Recebimentos Registrados
          </h2>
          <p className="text-xs text-slate-500">
            Consulte as guias abastecidas, emita o comprovante oficial ou realize o estorno em caso de erro de digitação.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportarXlsx}
          disabled={exportandoXlsx}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-700 bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
        >
          {exportandoXlsx ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Gerando planilha...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>Exportar Excel (.xlsx)</span>
            </>
          )}
        </button>
      </div>

      {mensagemFeedback && (
        <div
          role="status"
          className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs font-medium text-emerald-800"
        >
          <span>{mensagemFeedback}</span>
          <button
            type="button"
            onClick={() => setMensagemFeedback(null)}
            className="text-emerald-700 underline ml-3"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Barra de Atalhos Temporais e Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Atalhos de período"
          className="flex flex-wrap items-center gap-1.5"
        >
          {(
            [
              { id: "ONTEM_E_HOJE", label: "Ontem e Hoje" },
              { id: "ULTIMOS_7_DIAS", label: "Últimos 7 dias" },
              { id: "ULTIMOS_30_DIAS", label: "Últimos 30 dias" },
              { id: "ESTE_MES", label: "Este Mês" },
              { id: "PERSONALIZADO", label: "Período Personalizado" },
            ] as { id: AtalhoPeriodo; label: string }[]
          ).map((btn) => {
            const ativo = atalhoAtivo === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                aria-pressed={ativo}
                onClick={() => handleSelecionarAtalho(btn.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  ativo
                    ? "bg-teal-700 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {btn.label}
              </button>
            );
          })}
        </div>

        <div
          data-testid="badge-periodo-ativo"
          className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-medium text-teal-800"
        >
          <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Exibindo recebimentos de: {filtrosDataAplicados.rotulo}</span>
        </div>
      </div>

      {/* Seletor de Período Personalizado */}
      {atalhoAtivo === "PERSONALIZADO" && (
        <form
          onSubmit={handleAplicarPeriodoPersonalizado}
          className="flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 border border-slate-200 p-3"
        >
          <div>
            <label
              htmlFor="dataInicioHistorico"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              De
            </label>
            <input
              id="dataInicioHistorico"
              type="date"
              value={dataInicioInput}
              onChange={(e) => setDataInicioInput(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
            />
          </div>
          <div>
            <label
              htmlFor="dataFimHistorico"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Até
            </label>
            <input
              id="dataFimHistorico"
              type="date"
              value={dataFimInput}
              onChange={(e) => setDataFimInput(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
          >
            Filtrar Período
          </button>

          {erroPeriodo && (
            <p role="alert" className="w-full text-xs font-semibold text-red-600">
              {erroPeriodo}
            </p>
          )}
        </form>
      )}

      {/* Busca Textual e Filtro de Status */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-8 relative">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            aria-label="Buscar por Nº da Guia, Fornecedor ou Lote"
            value={buscaDigitada}
            onChange={(e) => setBuscaDigitada(e.target.value)}
            placeholder="Buscar por Nº da Guia, Nota Fiscal, Fornecedor ou Lote..."
            className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>
        <div className="md:col-span-4">
          <select
            aria-label="Filtrar por situação da guia"
            value={statusFiltro}
            onChange={(e) => {
              setStatusFiltro(
                e.target.value as "TODOS" | "CONCLUIDO" | "ESTORNADO",
              );
              setPagina(1);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="TODOS">Todas as situações</option>
            <option value="CONCLUIDO">Efetivados</option>
            <option value="ESTORNADO">Estornados</option>
          </select>
        </div>
      </div>

      {/* Estados de Carregamento / Erro / Tabela */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
          <span>Carregando histórico de recebimentos...</span>
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-4 text-xs text-red-700"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            {error instanceof Error
              ? error.message
              : "Não foi possível carregar o histórico de recebimentos."}
          </span>
        </div>
      ) : itens.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-500">
          Nenhum recebimento encontrado para o período e filtros selecionados.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
              <tr>
                <th className="px-3.5 py-2.5 font-semibold">Data/Hora</th>
                <th className="px-3.5 py-2.5 font-semibold">
                  Nº Documento / Tipo
                </th>
                <th className="px-3.5 py-2.5 font-semibold">
                  Fornecedor / Origem
                </th>
                <th className="px-3.5 py-2.5 font-semibold">
                  Qtd. Itens / Unidades
                </th>
                <th className="px-3.5 py-2.5 font-semibold">
                  Farmacêutico Recebedor
                </th>
                <th className="px-3.5 py-2.5 font-semibold">Status</th>
                <th className="px-3.5 py-2.5 font-semibold text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {itens.map((item) => {
                const estornado = item.status === "ESTORNADO";
                return (
                  <tr
                    key={item.id}
                    className={
                      estornado ? "bg-slate-50/70 text-slate-500" : "hover:bg-slate-50/60"
                    }
                  >
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      {new Date(item.dataRecebimento).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3.5 py-3">
                      <span
                        className={`font-semibold ${
                          estornado
                            ? "line-through text-slate-500"
                            : "text-slate-900"
                        }`}
                      >
                        {item.numeroDocumento}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        {item.tipoDocumento}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 font-medium text-slate-800">
                      {item.fornecedorOrigem}
                    </td>
                    <td className="px-3.5 py-3">
                      <span className="font-semibold text-slate-900">
                        {item.totalItens} itens
                      </span>{" "}
                      <span className="text-slate-500">
                        ({item.totalUnidades} un.)
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-slate-700">
                      {item.usuarioRecebedorNome}
                    </td>
                    <td className="px-3.5 py-3">
                      {estornado ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-800">
                          <XCircle className="w-3 h-3" aria-hidden="true" />
                          <span>ESTORNADO</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                          <span>EFETIVADO</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-3 text-right whitespace-nowrap space-x-2">
                      <button
                        type="button"
                        onClick={() => setEntradaComprovante(item)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <FileText className="w-3.5 h-3.5 text-teal-700" />
                        <span>Comprovante</span>
                      </button>

                      {!estornado && item.podeEstornar !== false && (
                        <button
                          type="button"
                          onClick={() => setEntradaEstorno(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Estornar</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal do Termo de Recebimento de Carga SUS */}
      <TermoRecebimentoModal
        aberto={Boolean(entradaComprovante)}
        resumoEntrada={entradaComprovante}
        onFechar={() => setEntradaComprovante(null)}
      />

      {/* Modal de Estorno */}
      <EstornoEntradaModal
        aberto={Boolean(entradaEstorno)}
        entrada={entradaEstorno}
        onFechar={() => setEntradaEstorno(null)}
        onSucessoEstorno={(resultado) => {
          setEstornosRecentes((prev) => ({
            ...prev,
            [resultado.id]: {
              motivoEstorno: resultado.motivoEstorno,
              dataEstorno: resultado.dataEstorno,
            },
          }));
          queryClient.setQueriesData<HistoricoRecebimentoPaginado>(
            { queryKey: ["ultimos-recebimentos"] },
            (antigo) => {
              if (!antigo) return antigo;
              return {
                ...antigo,
                itens: antigo.itens.map((it) =>
                  it.id === resultado.id
                    ? {
                        ...it,
                        status: "ESTORNADO",
                        podeEstornar: false,
                        motivoEstorno: resultado.motivoEstorno,
                        dataEstorno: resultado.dataEstorno,
                      }
                    : it,
                ),
              };
            },
          );
          void queryClient.invalidateQueries({
            queryKey: ["ultimos-recebimentos"],
          });
          void queryClient.invalidateQueries({
            queryKey: ["estoque-atual"],
          });
          setEntradaEstorno(null);
          setMensagemFeedback(
            `Guia ${resultado.numeroDocumento} estornada com sucesso. O saldo dos lotes foi atualizado.`,
          );
        }}
      />
    </section>
  );
};
