import React, { useEffect, useRef, useState } from "react";
import type {
  ExportarRelatorioEstoqueQueryDto,
  TipoRelatorioEstoque,
} from "@farmaubs/shared";
import {
  estoqueService,
  obterUnidadeAtivaEstoque,
} from "../../../services/estoque.service";
import { CATEGORIAS_REMUME_OPCOES } from "./EstoqueFiltrosBar";

export interface ModalExportarRelatoriosEstoqueProps {
  aberto: boolean;
  onFechar: () => void;
  unidadeId?: string;
  onSucesso?: (mensagem: string) => void;
  onExportar?: (
    filtros: ExportarRelatorioEstoqueQueryDto,
  ) => Promise<{ blob: Blob; nomeArquivo: string }>;
}

export type AtalhoPeriodoRelatorio =
  | "MES_ATUAL"
  | "MES_ANTERIOR"
  | "ULTIMOS_90_DIAS"
  | "PERSONALIZADO";

function paraIsoLocal(d: Date): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function calcularIntervaloAtalhoRelatorio(
  atalho: Exclude<AtalhoPeriodoRelatorio, "PERSONALIZADO">,
  base: Date = new Date(),
): { dataInicio: string; dataFim: string } {
  if (atalho === "MES_ATUAL") {
    const inicio = new Date(base.getFullYear(), base.getMonth(), 1);
    return { dataInicio: paraIsoLocal(inicio), dataFim: paraIsoLocal(base) };
  }
  if (atalho === "MES_ANTERIOR") {
    const inicio = new Date(base.getFullYear(), base.getMonth() - 1, 1);
    const fim = new Date(base.getFullYear(), base.getMonth(), 0);
    return { dataInicio: paraIsoLocal(inicio), dataFim: paraIsoLocal(fim) };
  }
  // ULTIMOS_90_DIAS
  const inicio = new Date(base);
  inicio.setDate(base.getDate() - 90);
  return { dataInicio: paraIsoLocal(inicio), dataFim: paraIsoLocal(base) };
}

/**
 * [ES-10 / RF020 / RF028 / ADR-032]: Modal acessível para exportação de relatórios de estoque em planilha Excel (.xlsx).
 * Suporta relatórios de Saldos Atuais, Perdas por Vencimento e Avarias e Movimentações do Período.
 */
export const ModalExportarRelatoriosEstoque: React.FC<
  ModalExportarRelatoriosEstoqueProps
> = ({ aberto, onFechar, unidadeId, onSucesso, onExportar }) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  const intervaloInicial = calcularIntervaloAtalhoRelatorio("MES_ATUAL");
  const [tipoRelatorio, setTipoRelatorio] =
    useState<TipoRelatorioEstoque>("SALDOS_ATUAIS");
  const [atalhoPeriodo, setAtalhoPeriodo] =
    useState<AtalhoPeriodoRelatorio>("MES_ATUAL");
  const [dataInicio, setDataInicio] = useState<string>(
    intervaloInicial.dataInicio,
  );
  const [dataFim, setDataFim] = useState<string>(intervaloInicial.dataFim);
  const [principioAtivo, setPrincipioAtivo] = useState<string>("");
  const [categoria, setCategoria] = useState<string>("");
  const [exportando, setExportando] = useState<boolean>(false);
  const [erroExportacao, setErroExportacao] = useState<string | null>(null);

  useEffect(() => {
    if (aberto) {
      const padrao = calcularIntervaloAtalhoRelatorio("MES_ATUAL");
      setTipoRelatorio("SALDOS_ATUAIS");
      setAtalhoPeriodo("MES_ATUAL");
      setDataInicio(padrao.dataInicio);
      setDataFim(padrao.dataFim);
      setPrincipioAtivo("");
      setCategoria("");
      setExportando(false);
      setErroExportacao(null);
    }
  }, [aberto]);

  // Gerencia tecla Escape e Focus Trap (ADR-032)
  useEffect(() => {
    if (!aberto) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onFechar();
        return;
      }

      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [aberto, onFechar]);

  if (!aberto) {
    return null;
  }

  const handleSelecionarAtalho = (novoAtalho: AtalhoPeriodoRelatorio) => {
    setAtalhoPeriodo(novoAtalho);
    setErroExportacao(null);
    if (novoAtalho !== "PERSONALIZADO") {
      const range = calcularIntervaloAtalhoRelatorio(novoAtalho);
      setDataInicio(range.dataInicio);
      setDataFim(range.dataFim);
    }
  };

  const intervaloInvalido =
    Boolean(dataInicio) && Boolean(dataFim) && dataFim < dataInicio;

  const podeBaixar =
    Boolean(dataInicio) &&
    Boolean(dataFim) &&
    !intervaloInvalido &&
    !exportando;

  const dispararDownloadNavegador = (blob: Blob, nomeArquivo: string) => {
    if (typeof window === "undefined") return;
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nomeArquivo;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    } catch {
      // Em ambientes de teste sem suporte a createObjectURL completo
    }
  };

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeBaixar) return;

    setExportando(true);
    setErroExportacao(null);

    const query: ExportarRelatorioEstoqueQueryDto = {
      unidadeId: obterUnidadeAtivaEstoque(unidadeId),
      tipoRelatorio,
      dataInicio,
      dataFim,
      principioAtivo: principioAtivo.trim() || undefined,
      categoria: categoria || undefined,
    };

    try {
      const resultado = onExportar
        ? await onExportar(query)
        : await estoqueService.exportarRelatorioXlsx(query);

      dispararDownloadNavegador(resultado.blob, resultado.nomeArquivo);

      const mensagemToast =
        tipoRelatorio === "PERDAS_VENCIMENTO"
          ? "Relatório de perdas exportado com sucesso"
          : tipoRelatorio === "MOVIMENTACOES_PERIODO"
            ? "Relatório de movimentações exportado com sucesso"
            : "Relatório de saldos exportado com sucesso";

      onSucesso?.(mensagemToast);
      onFechar();
    } catch (err: unknown) {
      setErroExportacao(
        err instanceof Error
          ? err.message
          : "Não foi possível gerar a planilha Excel (.xlsx).",
      );
    } finally {
      setExportando(false);
    }
  };

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-exportar-relatorios-titulo"
        data-testid="modal-exportar-relatorios-estoque"
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800"
              aria-hidden="true"
            >
              <span className="material-symbols-outlined text-xl">
                download
              </span>
            </span>
            <div>
              <h2
                id="modal-exportar-relatorios-titulo"
                className="text-base font-bold text-slate-900"
              >
                Exportar Relatórios de Estoque (.xlsx)
              </h2>
              <p className="text-xs text-slate-600">
                Planilha estruturada para pedido mensal CAF e auditoria (RF020)
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Fechar modal de exportação"
            data-testid="btn-fechar-modal-exportar"
            onClick={onFechar}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleDownload} className="mt-4 space-y-4" noValidate>
          {/* 1. Seletor de Tipo de Relatório */}
          <div>
            <label
              htmlFor="relatorio-tipo-select"
              className="mb-1 block text-xs font-bold text-slate-700"
            >
              Tipo de Relatório <span className="text-rose-700">*</span>
            </label>
            <select
              id="relatorio-tipo-select"
              data-testid="select-tipo-relatorio-estoque"
              value={tipoRelatorio}
              onChange={(e) =>
                setTipoRelatorio(e.target.value as TipoRelatorioEstoque)
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 focus:outline-none"
            >
              <option value="SALDOS_ATUAIS">Saldos Atuais</option>
              <option value="PERDAS_VENCIMENTO">
                Perdas por Vencimento e Avarias
              </option>
              <option value="MOVIMENTACOES_PERIODO">
                Movimentações do Período
              </option>
            </select>
          </div>

          {/* 2. Seletor de Período com Atalhos */}
          <div>
            <span className="mb-1.5 block text-xs font-bold text-slate-700">
              Período de Apuração
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  { id: "MES_ATUAL", rotulo: "Mês Atual" },
                  { id: "MES_ANTERIOR", rotulo: "Mês Anterior" },
                  { id: "ULTIMOS_90_DIAS", rotulo: "Últimos 90 dias" },
                  { id: "PERSONALIZADO", rotulo: "Período Personalizado" },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`btn-atalho-periodo-${item.id}`}
                  aria-pressed={atalhoPeriodo === item.id}
                  onClick={() => handleSelecionarAtalho(item.id)}
                  className={`rounded-lg border px-2.5 py-2 text-xs font-semibold transition-all ${
                    atalhoPeriodo === item.id
                      ? "border-blue-700 bg-blue-50 text-blue-900 ring-1 ring-blue-700"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {item.rotulo}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Datas Início e Fim */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="relatorio-data-inicio"
                className="mb-1 block text-xs font-bold text-slate-700"
              >
                Data Início
              </label>
              <input
                id="relatorio-data-inicio"
                type="date"
                data-testid="input-relatorio-data-inicio"
                value={dataInicio}
                onChange={(e) => {
                  setAtalhoPeriodo("PERSONALIZADO");
                  setDataInicio(e.target.value);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="relatorio-data-fim"
                className="mb-1 block text-xs font-bold text-slate-700"
              >
                Data Fim
              </label>
              <input
                id="relatorio-data-fim"
                type="date"
                data-testid="input-relatorio-data-fim"
                value={dataFim}
                onChange={(e) => {
                  setAtalhoPeriodo("PERSONALIZADO");
                  setDataFim(e.target.value);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 focus:outline-none"
              />
            </div>
          </div>

          {intervaloInvalido && (
            <p
              role="alert"
              data-testid="erro-intervalo-datas-relatorio"
              className="text-xs font-semibold text-rose-700"
            >
              A data final não pode ser anterior à data inicial
            </p>
          )}

          {/* 4. Filtros Opcionais: Princípio Ativo e Categoria */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="relatorio-principio-ativo"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Princípio Ativo (Opcional)
              </label>
              <input
                id="relatorio-principio-ativo"
                type="text"
                data-testid="input-relatorio-principio-ativo"
                value={principioAtivo}
                onChange={(e) => setPrincipioAtivo(e.target.value)}
                placeholder="Ex: Losartana, Amoxicilina..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="relatorio-categoria"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Categoria Clínica (Opcional)
              </label>
              <select
                id="relatorio-categoria"
                data-testid="select-relatorio-categoria"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 focus:outline-none"
              >
                {CATEGORIAS_REMUME_OPCOES.map((op) => (
                  <option key={op.valor} value={op.valor}>
                    {op.rotulo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {erroExportacao && (
            <div
              role="alert"
              data-testid="erro-api-exportar-relatorio"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800"
            >
              {erroExportacao}
            </div>
          )}

          {/* Rodapé */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              data-testid="btn-cancelar-exportacao"
              onClick={onFechar}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              data-testid="btn-baixar-planilha-excel"
              disabled={!podeBaixar}
              aria-busy={exportando}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span
                className="material-symbols-outlined text-sm"
                aria-hidden="true"
              >
                {exportando ? "hourglass_top" : "download"}
              </span>
              <span>
                {exportando ? "Gerando planilha..." : "Baixar Planilha Excel"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
