import React, { useEffect, useRef, useState } from "react";
import type {
  ConsultarSaldosQueryDto,
  FiltroStatusEstoque,
  FiltroValidadeSaldos,
} from "@farmaubs/shared";
import { useDebounce } from "../../../hooks/useDebounce";

export interface EstoqueFiltrosBarProps {
  valores: ConsultarSaldosQueryDto;
  onChange: (novosFiltros: Partial<ConsultarSaldosQueryDto>) => void;
  onLimpar: () => void;
}

export const CATEGORIAS_REMUME_OPCOES = [
  { valor: "", rotulo: "Todas as Categorias (REMUME)" },
  { valor: "BASICO", rotulo: "Componente Básico" },
  { valor: "ANTIBIOTICO", rotulo: "Antimicrobianos / Antibióticos" },
  { valor: "ANTI-HIPERTENSIVO", rotulo: "Anti-hipertensivos" },
  { valor: "ANTIDIABETICO", rotulo: "Antidiabéticos / Hipoglicemiantes" },
  { valor: "ANALGESICO", rotulo: "Analgésicos e Antitérmicos" },
  { valor: "ANTI-INFLAMATORIO", rotulo: "Anti-inflamatórios" },
  { valor: "GASTRICO", rotulo: "Gástricos e Antissecretores" },
  { valor: "CONTROLADO", rotulo: "Controle Especial" },
] as const;

const ROTULO_VALIDADE: Record<FiltroValidadeSaldos, string> = {
  TODOS: "Todas as Validades",
  MES_CORRENTE: "Vencendo no Mês Vigente",
  VALIDADE_90D: "Validade Curta (< 90 dias)",
  VENCIDOS: "Vencidos",
};

const ROTULO_STATUS: Record<FiltroStatusEstoque, string> = {
  TODOS: "Todos os Status",
  REGULAR: "Apenas em Estoque",
  BAIXO_ESTOQUE: "Baixo Estoque / Risco de Ruptura",
  ZERADO: "Zerados",
};

/**
 * [ES-08 / RF005 / RF022 / NF007]: Barra de filtros avançados da tela de Controle de Estoque.
 * Inclui busca textual com debounce de 300ms, filtro de validade no mês vigente, categorias da REMUME e nível de saldo.
 * @param props - Estado atual dos filtros e callbacks de alteração e limpeza.
 */
export const EstoqueFiltrosBar: React.FC<EstoqueFiltrosBarProps> = ({
  valores,
  onChange,
  onLimpar,
}) => {
  const [termoDigitado, setTermoDigitado] = useState<string>(
    valores.termo ?? "",
  );
  const termoDebounced = useDebounce(termoDigitado, 300);
  const ultimoTermoEmitido = useRef<string>(valores.termo ?? "");

  // Sincroniza caso o filtro externo seja limpo pelo pai
  useEffect(() => {
    const externo = valores.termo ?? "";
    if (externo !== ultimoTermoEmitido.current && externo !== termoDigitado) {
      setTermoDigitado(externo);
      ultimoTermoEmitido.current = externo;
    }
  }, [valores.termo, termoDigitado]);

  // Dispara busca com debounce de 300ms e reseta para a página 1
  useEffect(() => {
    if (termoDebounced !== ultimoTermoEmitido.current) {
      ultimoTermoEmitido.current = termoDebounced;
      onChange({
        termo: termoDebounced || undefined,
        pagina: 1,
      });
    }
  }, [termoDebounced, onChange]);

  const handleLimparTermo = () => {
    setTermoDigitado("");
    ultimoTermoEmitido.current = "";
    onChange({ termo: undefined, pagina: 1 });
  };

  const handleLimparTodos = () => {
    setTermoDigitado("");
    ultimoTermoEmitido.current = "";
    onLimpar();
  };

  const filtroValidadeAtual: FiltroValidadeSaldos =
    valores.filtroValidade ?? "TODOS";
  const statusEstoqueAtual: FiltroStatusEstoque =
    valores.statusEstoque ?? "TODOS";
  const categoriaAtual = valores.categoria ?? "";

  const possuiFiltrosAtivos =
    Boolean(termoDigitado.trim()) ||
    Boolean(categoriaAtual) ||
    filtroValidadeAtual !== "TODOS" ||
    statusEstoqueAtual !== "TODOS";

  return (
    <div
      aria-label="Filtros de consulta de estoque"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        {/* 1. Campo de Busca Textual com Debounce 300ms */}
        <div className="md:col-span-4">
          <label
            htmlFor="estoque-busca-termo"
            className="mb-1 block text-xs font-semibold text-slate-700"
          >
            Buscar Medicamento ou Lote
          </label>
          <div className="relative">
            <span
              className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500"
              aria-hidden="true"
            >
              <span className="material-symbols-outlined text-lg">search</span>
            </span>
            <input
              id="estoque-busca-termo"
              type="text"
              data-testid="input-busca-estoque"
              value={termoDigitado}
              onChange={(e) => setTermoDigitado(e.target.value)}
              placeholder="Nome, princípio ativo ou código do lote..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-9 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 focus:outline-none"
            />
            {termoDigitado.length > 0 && (
              <button
                type="button"
                aria-label="Limpar texto da busca"
                data-testid="btn-limpar-termo-busca"
                onClick={handleLimparTermo}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-500 hover:text-slate-800"
              >
                <span className="material-symbols-outlined text-base">
                  close
                </span>
              </button>
            )}
          </div>
        </div>

        {/* 2. Filtro de Validade Dedicado (RF022 - Mês Vigente em destaque) */}
        <div className="md:col-span-3">
          <label
            htmlFor="estoque-filtro-validade"
            className="mb-1 block text-xs font-semibold text-slate-700"
          >
            Validade Sanitária
          </label>
          <select
            id="estoque-filtro-validade"
            data-testid="select-filtro-validade"
            value={filtroValidadeAtual}
            onChange={(e) =>
              onChange({
                filtroValidade: e.target.value as FiltroValidadeSaldos,
                pagina: 1,
              })
            }
            className={`w-full rounded-lg border py-2 px-3 text-sm font-medium focus:ring-2 focus:outline-none ${
              filtroValidadeAtual === "MES_CORRENTE" ||
              filtroValidadeAtual === "VALIDADE_90D"
                ? "border-amber-400 bg-amber-50 text-amber-900 focus:border-amber-600 focus:ring-amber-500/20"
                : "border-slate-300 bg-white text-slate-900 focus:border-blue-700 focus:ring-blue-700/20"
            }`}
          >
            <option value="TODOS">Todas as Validades</option>
            <option value="MES_CORRENTE">Vencendo no Mês Vigente</option>
            <option value="VALIDADE_90D">Validade Curta (&lt; 90 dias)</option>
            <option value="VENCIDOS">Vencidos</option>
          </select>
        </div>

        {/* 3. Filtro por Categoria Clínica da REMUME */}
        <div className="md:col-span-3">
          <label
            htmlFor="estoque-filtro-categoria"
            className="mb-1 block text-xs font-semibold text-slate-700"
          >
            Categoria Clínica (REMUME)
          </label>
          <select
            id="estoque-filtro-categoria"
            data-testid="select-filtro-categoria"
            value={categoriaAtual}
            onChange={(e) =>
              onChange({
                categoria: e.target.value || undefined,
                pagina: 1,
              })
            }
            className="w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 focus:outline-none"
          >
            {CATEGORIAS_REMUME_OPCOES.map((cat) => (
              <option key={cat.valor} value={cat.valor}>
                {cat.rotulo}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Filtro por Nível de Estoque */}
        <div className="md:col-span-2">
          <label
            htmlFor="estoque-filtro-status"
            className="mb-1 block text-xs font-semibold text-slate-700"
          >
            Nível de Estoque
          </label>
          <select
            id="estoque-filtro-status"
            data-testid="select-filtro-status"
            value={statusEstoqueAtual}
            onChange={(e) =>
              onChange({
                statusEstoque: e.target.value as FiltroStatusEstoque,
                pagina: 1,
              })
            }
            className="w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 focus:outline-none"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="REGULAR">Apenas em Estoque</option>
            <option value="BAIXO_ESTOQUE">
              Baixo Estoque / Risco de Ruptura
            </option>
            <option value="ZERADO">Zerados</option>
          </select>
        </div>
      </div>

      {/* Chips de Filtros Ativos e Botão Limpar Filtros */}
      {possuiFiltrosAtivos && (
        <div
          data-testid="barra-chips-filtros-ativos"
          className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"
        >
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600">
              Filtros ativos:
            </span>

            {termoDigitado.trim() && (
              <span
                data-testid="chip-filtro-termo"
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-800"
              >
                Busca: &ldquo;{termoDigitado.trim()}&rdquo;
              </span>
            )}

            {filtroValidadeAtual !== "TODOS" && (
              <span
                data-testid="chip-filtro-validade"
                className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 font-semibold text-amber-900"
              >
                <span
                  className="material-symbols-outlined text-sm"
                  aria-hidden="true"
                >
                  schedule
                </span>
                {ROTULO_VALIDADE[filtroValidadeAtual]}
              </span>
            )}

            {categoriaAtual && (
              <span
                data-testid="chip-filtro-categoria"
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-800"
              >
                Categoria: {categoriaAtual}
              </span>
            )}

            {statusEstoqueAtual !== "TODOS" && (
              <span
                data-testid="chip-filtro-status"
                className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-800"
              >
                {ROTULO_STATUS[statusEstoqueAtual]}
              </span>
            )}
          </div>

          <button
            type="button"
            data-testid="btn-limpar-filtros-estoque"
            onClick={handleLimparTodos}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:ring-2 focus:ring-blue-700 focus:outline-none"
          >
            <span
              className="material-symbols-outlined text-sm"
              aria-hidden="true"
            >
              filter_alt_off
            </span>
            <span>Limpar Filtros</span>
          </button>
        </div>
      )}
    </div>
  );
};
