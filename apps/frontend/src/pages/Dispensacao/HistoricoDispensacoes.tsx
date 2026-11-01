import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  formatarCPF,
  formatarDataIsoParaBr,
  obterIntervaloOntemHoje,
  type DispensacaoItemListaDto,
  type ListarDispensacoesQuery,
} from "@farmaubs/shared";
import { dispensacaoService } from "../../services/dispensacao.service";
import {
  FiltrosHistoricoDispensacao,
  type AtalhoPeriodoHistorico,
} from "../../components/dispensacao/FiltrosHistoricoDispensacao";
import { BotaoExportarXlsx } from "../../components/dispensacao/BotaoExportarXlsx";
import { ModalEstornoDispensacao } from "../../components/dispensacao/ModalEstornoDispensacao";

export interface HistoricoDispensacoesProps {
  ubsId?: string;
  dataReferencia?: Date;
}

/**
 * [RF012 / RF028 / ADR-032]: Painel de histórico de dispensações da UBS com filtro temporal padrão "Ontem e Hoje",
 * filtros combinados, exportação direta em planilha Excel (.xlsx) e modal de estorno de atendimento.
 */
export function HistoricoDispensacoes({
  ubsId,
  dataReferencia,
}: HistoricoDispensacoesProps) {
  let queryClient: ReturnType<typeof useQueryClient> | null = null;
  try {
    queryClient = useQueryClient();
  } catch {
    // Permite execução resiliente em testes isolados sem QueryClientProvider
  }

  const intervaloInicial = obterIntervaloOntemHoje(
    dataReferencia ?? new Date(),
  );

  const [atalhoAtivo, setAtalhoAtivo] =
    useState<AtalhoPeriodoHistorico>("ONTEM_E_HOJE");
  const [filtros, setFiltros] = useState<ListarDispensacoesQuery>({
    ubsId,
    pagina: 1,
    limite: 20,
    dataInicio: intervaloInicial.dataInicio,
    dataFim: intervaloInicial.dataFim,
  });

  const [itens, setItens] = useState<DispensacaoItemListaDto[]>([]);
  const [totalItens, setTotalItens] = useState<number>(0);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [mensagemFeedback, setMensagemFeedback] = useState<{
    tipo: "sucesso" | "erro";
    texto: string;
  } | null>(null);

  const [atendimentoParaEstorno, setAtendimentoParaEstorno] =
    useState<DispensacaoItemListaDto | null>(null);
  const [processandoEstorno, setProcessandoEstorno] = useState(false);

  const carregarHistorico = useCallback(
    async (queryAtual: ListarDispensacoesQuery) => {
      setCarregando(true);
      try {
        const resposta = await dispensacaoService.listarDispensacoes(queryAtual);
        setItens(resposta.itens ?? []);
        setTotalItens(resposta.totalItens ?? 0);
      } catch (err) {
        setMensagemFeedback({
          tipo: "erro",
          texto:
            err instanceof Error
              ? err.message
              : "Erro ao consultar histórico de dispensas.",
        });
      } finally {
        setCarregando(false);
      }
    },
    [],
  );

  useEffect(() => {
    void carregarHistorico(filtros);
  }, [filtros, carregarHistorico]);

  const handleAlterarFiltros = (
    novosFiltros: ListarDispensacoesQuery,
    novoAtalho: AtalhoPeriodoHistorico,
  ) => {
    setAtalhoAtivo(novoAtalho);
    setFiltros(novosFiltros);
  };

  const handleConfirmarEstorno = async (
    dispensacaoId: string,
    motivoEstorno: string,
  ) => {
    setProcessandoEstorno(true);
    try {
      await dispensacaoService.estornarDispensacao(dispensacaoId, {
        ubsId,
        motivoEstorno,
      });

      // Atualiza imediatamente o status da linha na tabela para "Estornada"
      setItens((atuais) =>
        atuais.map((item) =>
          item.id === dispensacaoId ? { ...item, status: "estornada" } : item,
        ),
      );
      setAtendimentoParaEstorno(null);
      setMensagemFeedback({
        tipo: "sucesso",
        texto:
          "Atendimento estornado com sucesso! Os saldos foram restituídos aos lotes da UBS.",
      });

      if (queryClient) {
        void queryClient.invalidateQueries({ queryKey: ["estoque-saldos"] });
        void queryClient.invalidateQueries({ queryKey: ["ultimas-dispensas"] });
      }
    } catch (err) {
      setMensagemFeedback({
        tipo: "erro",
        texto:
          err instanceof Error
            ? err.message
            : "Não foi possível estornar o atendimento.",
      });
    } finally {
      setProcessandoEstorno(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="painel-historico-dispensacoes">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Histórico de Atendimentos da Unidade
          </h2>
          <p className="text-xs text-slate-500">
            Consulte os atendimentos realizados, baixe relatórios em planilha ou
            estorne entregas quando necessário
          </p>
        </div>

        <BotaoExportarXlsx
          filtros={filtros}
          onErroExportacao={(texto) =>
            setMensagemFeedback({ tipo: "erro", texto })
          }
        />
      </div>

      {mensagemFeedback && (
        <div
          role="status"
          data-testid="toast-historico-feedback"
          className={`rounded-xl border p-3 text-xs font-medium flex items-center justify-between ${
            mensagemFeedback.tipo === "sucesso"
              ? "border-emerald-300 bg-emerald-50 text-emerald-950"
              : "border-red-300 bg-red-50 text-red-900"
          }`}
        >
          <span>{mensagemFeedback.texto}</span>
          <button
            type="button"
            onClick={() => setMensagemFeedback(null)}
            className="text-xs underline ml-3"
          >
            Fechar
          </button>
        </div>
      )}

      <FiltrosHistoricoDispensacao
        filtros={filtros}
        atalhoAtivo={atalhoAtivo}
        onAlterarFiltros={handleAlterarFiltros}
        dataReferencia={dataReferencia}
      />

      {/* Tabela Semântica de Histórico */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <span>
            Registros localizados: <strong>{totalItens}</strong>
          </span>
        </div>

        {carregando ? (
          <div className="p-8 text-center text-xs text-slate-500" role="status">
            Carregando histórico de dispensações...
          </div>
        ) : itens.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Nenhuma dispensação encontrada para o período e filtros
            selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              aria-label="Tabela de Histórico de Dispensações"
              className="w-full text-left text-xs border-collapse"
            >
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                  <th scope="col" className="py-3 px-4 font-semibold">
                    Atendimento / Data
                  </th>
                  <th scope="col" className="py-3 px-4 font-semibold">
                    Paciente
                  </th>
                  <th scope="col" className="py-3 px-4 font-semibold">
                    Medicamentos Dispensados
                  </th>
                  <th scope="col" className="py-3 px-4 font-semibold">
                    Dispensador
                  </th>
                  <th scope="col" className="py-3 px-4 font-semibold">
                    Status
                  </th>
                  <th
                    scope="col"
                    className="py-3 px-4 font-semibold text-right"
                  >
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {itens.map((item) => {
                  const dataIso =
                    item.dataAtendimento instanceof Date
                      ? item.dataAtendimento.toISOString().slice(0, 10)
                      : String(item.dataAtendimento).slice(0, 10);

                  return (
                    <tr
                      key={item.id}
                      data-testid={`linha-historico-${item.id}`}
                      className="hover:bg-slate-50/70"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          #{item.numeroAtendimento}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {formatarDataIsoParaBr(dataIso)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {item.pacienteNome}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          CPF: {formatarCPF(item.pacienteCpf)} | CNS:{" "}
                          {item.pacienteCns}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-800">
                        <div>{item.medicamentosResumo}</div>
                        <div className="text-[11px] text-slate-500">
                          {item.totalItens}{" "}
                          {item.totalItens === 1 ? "item" : "itens"}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {item.dispensadorNome}
                      </td>
                      <td className="py-3 px-4">
                        {item.status === "estornada" ? (
                          <span
                            data-testid={`status-atendimento-${item.id}`}
                            className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-800 border border-red-300"
                          >
                            Estornada
                          </span>
                        ) : (
                          <span
                            data-testid={`status-atendimento-${item.id}`}
                            className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-300"
                          >
                            Concluída
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {item.status === "concluida" && (
                          <button
                            type="button"
                            onClick={() => setAtendimentoParaEstorno(item)}
                            className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                          >
                            Estornar
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
      </div>

      <ModalEstornoDispensacao
        atendimento={atendimentoParaEstorno}
        processando={processandoEstorno}
        onConfirmarEstorno={handleConfirmarEstorno}
        onFechar={() => setAtendimentoParaEstorno(null)}
      />
    </div>
  );
}

export default HistoricoDispensacoes;
