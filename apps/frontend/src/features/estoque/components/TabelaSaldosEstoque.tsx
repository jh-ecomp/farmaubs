import React, { useState } from "react";
import {
  ordenarLotesSaldoPorFEFO,
  type LoteEstoqueDto,
  type MedicamentoSaldoItemDto,
  type StatusEstoque,
  type StatusValidadeLote,
} from "@farmaubs/shared";

export interface TabelaSaldosEstoqueProps {
  medicamentos: MedicamentoSaldoItemDto[];
  carregando: boolean;
  onAbrirAjuste: (
    lote: LoteEstoqueDto,
    medicamento: MedicamentoSaldoItemDto,
  ) => void;
  onAbrirRastreabilidade: (
    lote: LoteEstoqueDto,
    medicamento: MedicamentoSaldoItemDto,
  ) => void;
  pagina?: number;
  totalPaginas?: number;
  totalRegistros?: number;
  onMudarPagina?: (novaPagina: number) => void;
  podeAjustarEstoque?: boolean;
}

/**
 * Formata uma data ISO 'AAAA-MM-DD' para o padrão brasileiro 'DD/MM/AAAA'.
 * @param isoDate - String no formato AAAA-MM-DD.
 * @returns Data formatada em DD/MM/AAAA.
 */
function formatarDataPtBr(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate || "");
  if (!match) return isoDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/**
 * Retorna a configuração visual e semântica do badge de status consolidado do medicamento.
 * @param status - REGULAR, BAIXO_ESTOQUE ou ZERADO.
 */
function obterConfigStatusEstoque(status: StatusEstoque) {
  if (status === "ZERADO") {
    return {
      rotulo: "Zerado",
      classes: "border border-rose-200 bg-rose-100 text-rose-900",
      icone: "error",
    };
  }
  if (status === "BAIXO_ESTOQUE") {
    return {
      rotulo: "Baixo Estoque",
      classes: "border border-amber-300 bg-amber-100 text-amber-900",
      icone: "warning",
    };
  }
  return {
    rotulo: "Regular",
    classes: "border border-emerald-200 bg-emerald-100 text-emerald-900",
    icone: "check_circle",
  };
}

/**
 * [RF022 / ADR-032]: Retorna a configuração do badge de validade do lote com destaque em cor laranja para o mês corrente / 90 dias.
 * Garante contraste WCAG 2.1 AA (> 4.5:1) para aprovação no @axe-core/playwright.
 * @param statusValidade - Status semântico de validade do lote.
 */
function obterConfigValidadeLote(statusValidade: StatusValidadeLote) {
  if (statusValidade === "VENCIDO") {
    return {
      rotulo: "Vencido",
      cor: "vermelho",
      classes: "border border-rose-300 bg-rose-100 text-rose-900",
      icone: "cancel",
    };
  }
  if (statusValidade === "MES_CORRENTE") {
    return {
      rotulo: "Vence no Mês",
      cor: "laranja",
      classes: "border border-amber-400 bg-amber-100 text-amber-900",
      icone: "event_busy",
    };
  }
  if (statusValidade === "CURTA_90D") {
    return {
      rotulo: "Validade Curta (< 90d)",
      cor: "laranja",
      classes: "border border-amber-300 bg-amber-100 text-amber-900",
      icone: "schedule",
    };
  }
  return {
    rotulo: "Regular",
    cor: "verde",
    classes: "border border-emerald-200 bg-emerald-100 text-emerald-900",
    icone: "verified",
  };
}

/**
 * [ES-07 / RF005 / RF022 / ADR-032]: Tabela principal de saldos de estoque com expansão em cascata (accordion) por lotes FEFO.
 * Destaca lotes com vencimento no mês corrente ou em até 90 dias com badges na cor laranja vibrante.
 */
export const TabelaSaldosEstoque: React.FC<TabelaSaldosEstoqueProps> = ({
  medicamentos,
  carregando,
  onAbrirAjuste,
  onAbrirRastreabilidade,
  pagina = 1,
  totalPaginas = 1,
  totalRegistros,
  onMudarPagina,
  podeAjustarEstoque = true,
}) => {
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});

  const alternarExpansao = (produtoId: string) => {
    setExpandidos((prev) => ({
      ...prev,
      [produtoId]: !prev[produtoId],
    }));
  };

  if (carregando) {
    return (
      <div
        role="status"
        aria-label="Carregando tabela de saldos de estoque"
        aria-busy="true"
        data-testid="tabela-saldos-skeleton"
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs"
      >
        <div className="space-y-4">
          {[1, 2, 3, 4].map((row) => (
            <div
              key={row}
              className="flex animate-pulse items-center justify-between border-b border-slate-100 pb-3"
            >
              <div className="h-5 w-1/3 rounded bg-slate-200" />
              <div className="h-5 w-1/5 rounded bg-slate-200" />
              <div className="h-5 w-16 rounded bg-slate-200" />
              <div className="h-5 w-20 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!medicamentos || medicamentos.length === 0) {
    return (
      <div
        data-testid="tabela-saldos-vazia"
        className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-xs"
      >
        <span
          className="material-symbols-outlined mb-2 text-4xl text-slate-400"
          aria-hidden="true"
        >
          inventory
        </span>
        <h3 className="text-base font-bold text-slate-800">
          Nenhum medicamento encontrado
        </h3>
        <p className="mt-1 max-w-md text-xs text-slate-600">
          Não há registros de saldo na unidade que correspondam aos critérios de
          busca ou filtros selecionados.
        </p>
      </div>
    );
  }

  const totalExibido = totalRegistros ?? medicamentos.length;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
      <div className="overflow-x-auto">
        <table
          aria-label="Tabela de saldos de medicamentos e lotes da UBS"
          data-testid="tabela-saldos-estoque"
          className="w-full border-collapse text-left text-sm"
        >
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold tracking-wider text-slate-600 uppercase">
              <th scope="col" className="w-12 px-4 py-3 text-center">
                Lotes
              </th>
              <th scope="col" className="px-4 py-3">
                Medicamento &amp; Apresentação
              </th>
              <th scope="col" className="px-4 py-3">
                Princípio Ativo &amp; Categoria
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Saldo Total UBS
              </th>
              <th scope="col" className="px-4 py-3 text-center">
                Status do Estoque
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {medicamentos.map((med) => {
              const estaExpandido = Boolean(expandidos[med.produtoId]);
              const lotesOrdenados = ordenarLotesSaldoPorFEFO(med.lotes || []);
              const statusCfg = obterConfigStatusEstoque(med.statusEstoque);
              const subtabelaId = `subtabela-lotes-${med.produtoId}`;

              const possuiLoteCriticoValidade = lotesOrdenados.some(
                (l) =>
                  l.statusValidade === "MES_CORRENTE" ||
                  l.statusValidade === "CURTA_90D",
              );

              return (
                <React.Fragment key={med.produtoId}>
                  {/* Linha Principal do Medicamento */}
                  <tr
                    data-testid={`linha-medicamento-${med.produtoId}`}
                    className={`transition-colors hover:bg-slate-50/80 ${
                      estaExpandido ? "bg-blue-50/30" : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        aria-expanded={estaExpandido}
                        aria-controls={subtabelaId}
                        aria-label={`Expandir lotes de ${med.nome}`}
                        data-testid={`btn-expandir-${med.produtoId}`}
                        onClick={() => alternarExpansao(med.produtoId)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 focus:ring-2 focus:ring-blue-700 focus:outline-none"
                      >
                        <span
                          className={`material-symbols-outlined text-lg transition-transform ${
                            estaExpandido ? "rotate-180" : ""
                          }`}
                          aria-hidden="true"
                        >
                          expand_more
                        </span>
                      </button>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {med.nome}
                          </span>
                          {possuiLoteCriticoValidade && (
                            <span
                              title="Possui lote(s) com vencimento próximo"
                              className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900"
                            >
                              <span
                                className="material-symbols-outlined text-xs"
                                aria-hidden="true"
                              >
                                schedule
                              </span>
                              Alerta FEFO
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-600">
                          {med.concentracao} • {med.formaFarmaceutica} (
                          {lotesOrdenados.length}{" "}
                          {lotesOrdenados.length === 1 ? "lote" : "lotes"})
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-800">
                          {med.principioAtivo}
                        </span>
                        <span className="mt-0.5 inline-flex w-fit items-center rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          {med.categoria}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <span
                        data-testid={`saldo-total-${med.produtoId}`}
                        className="text-base font-bold text-slate-900"
                      >
                        {med.saldoTotal.toLocaleString("pt-BR")}
                      </span>{" "}
                      <span className="text-xs text-slate-600">
                        {med.unidadeMedida}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span
                        data-testid={`status-estoque-${med.produtoId}`}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${statusCfg.classes}`}
                      >
                        <span
                          className="material-symbols-outlined text-sm"
                          aria-hidden="true"
                        >
                          {statusCfg.icone}
                        </span>
                        {statusCfg.rotulo}
                      </span>
                    </td>
                  </tr>

                  {/* Subtabela Expandida de Lotes Físicos (Ordenação FEFO) */}
                  {estaExpandido && (
                    <tr
                      id={subtabelaId}
                      data-testid={`subtabela-lotes-${med.produtoId}`}
                      className="bg-slate-50/90"
                    >
                      <td colSpan={5} className="px-6 py-4">
                        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-bold tracking-wider text-slate-700 uppercase">
                              Lotes Físicos Ordenados por FEFO — {med.nome}
                            </span>
                            <span className="text-xs text-slate-600">
                              Primeiro que vence, primeiro que sai
                            </span>
                          </div>

                          {lotesOrdenados.length === 0 ? (
                            <p className="py-3 text-center text-xs text-slate-600">
                              Nenhum lote físico ativo registrado para este
                              medicamento.
                            </p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table
                                aria-label={`Lotes do medicamento ${med.nome}`}
                                className="w-full border-collapse text-left text-xs"
                              >
                                <thead>
                                  <tr className="border-b border-slate-200 bg-slate-100/80 font-bold text-slate-700">
                                    <th scope="col" className="px-3 py-2">
                                      Código do Lote
                                    </th>
                                    <th scope="col" className="px-3 py-2">
                                      Fabricante / Laboratório
                                    </th>
                                    <th scope="col" className="px-3 py-2">
                                      Data de Validade
                                    </th>
                                    <th
                                      scope="col"
                                      className="px-3 py-2 text-center"
                                    >
                                      Situação de Validade
                                    </th>
                                    <th
                                      scope="col"
                                      className="px-3 py-2 text-right"
                                    >
                                      Saldo do Lote
                                    </th>
                                    <th
                                      scope="col"
                                      className="px-3 py-2 text-right"
                                    >
                                      Ações Operacionais
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {lotesOrdenados.map((lote, index) => {
                                    const valCfg = obterConfigValidadeLote(
                                      lote.statusValidade,
                                    );
                                    return (
                                      <tr
                                        key={lote.id}
                                        data-testid={`linha-lote-${lote.numeroLote}`}
                                        className="hover:bg-slate-50"
                                      >
                                        <td className="px-3 py-2.5">
                                          <div className="flex items-center gap-1.5">
                                            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono font-bold text-slate-900">
                                              {lote.numeroLote}
                                            </span>
                                            {index === 0 &&
                                              lote.statusValidade !==
                                                "VENCIDO" &&
                                              lote.saldoAtual > 0 && (
                                                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-900">
                                                  1º FEFO
                                                </span>
                                              )}
                                          </div>
                                        </td>

                                        <td className="px-3 py-2.5 font-medium text-slate-700">
                                          {lote.fabricanteNome}
                                        </td>

                                        <td className="px-3 py-2.5 font-semibold text-slate-900">
                                          {formatarDataPtBr(lote.dataValidade)}
                                        </td>

                                        <td className="px-3 py-2.5 text-center">
                                          <span
                                            data-testid={`badge-validade-${lote.numeroLote}`}
                                            data-cor-badge={valCfg.cor}
                                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${valCfg.classes}`}
                                          >
                                            <span
                                              className="material-symbols-outlined text-xs"
                                              aria-hidden="true"
                                            >
                                              {valCfg.icone}
                                            </span>
                                            {valCfg.rotulo}
                                          </span>
                                        </td>

                                        <td
                                          data-testid={`saldo-lote-${lote.numeroLote}`}
                                          className="px-3 py-2.5 text-right font-bold text-slate-900"
                                        >
                                          {lote.saldoAtual.toLocaleString(
                                            "pt-BR",
                                          )}{" "}
                                          <span className="font-normal text-slate-600">
                                            {med.unidadeMedida}
                                          </span>
                                        </td>

                                        <td className="px-3 py-2.5 text-right">
                                          <div className="inline-flex items-center justify-end gap-1.5">
                                            {podeAjustarEstoque && (
                                              <button
                                                type="button"
                                                data-testid={`btn-ajuste-lote-${lote.numeroLote}`}
                                                onClick={() =>
                                                  onAbrirAjuste(lote, med)
                                                }
                                                className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-900 transition-colors hover:bg-blue-100 focus:ring-2 focus:ring-blue-700 focus:outline-none"
                                              >
                                                <span
                                                  className="material-symbols-outlined text-sm"
                                                  aria-hidden="true"
                                                >
                                                  tune
                                                </span>
                                                <span>Ajuste (+/-)</span>
                                              </button>
                                            )}

                                            <button
                                              type="button"
                                              data-testid={`btn-rastreabilidade-lote-${lote.numeroLote}`}
                                              onClick={() =>
                                                onAbrirRastreabilidade(
                                                  lote,
                                                  med,
                                                )
                                              }
                                              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus:ring-2 focus:ring-blue-700 focus:outline-none"
                                            >
                                              <span
                                                className="material-symbols-outlined text-sm"
                                                aria-hidden="true"
                                              >
                                                history
                                              </span>
                                              <span>
                                                Ficha de Rastreabilidade
                                              </span>
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Rodapé com Controles Acessíveis de Paginação */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
        <div className="flex items-center gap-4">
          <span data-testid="resumo-paginacao-saldos">
            Exibindo <strong>{medicamentos.length}</strong> de{" "}
            <strong>{totalExibido}</strong> medicamento(s) • Página{" "}
            <strong>{pagina}</strong> de{" "}
            <strong>{Math.max(1, totalPaginas)}</strong>
          </span>
        </div>

        <nav
          aria-label="Paginação da tabela de saldos"
          className="flex items-center gap-2"
        >
          <button
            type="button"
            aria-label="Página anterior"
            data-testid="btn-pagina-anterior"
            disabled={pagina <= 1}
            onClick={() => onMudarPagina?.(pagina - 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            type="button"
            aria-label="Próxima página"
            data-testid="btn-proxima-pagina"
            disabled={pagina >= totalPaginas}
            onClick={() => onMudarPagina?.(pagina + 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Próxima
          </button>
        </nav>
      </div>
    </div>
  );
};
