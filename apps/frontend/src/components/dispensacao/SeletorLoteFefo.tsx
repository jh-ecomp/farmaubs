import { useState, useEffect, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  formatarDataIsoParaBr,
  selecionarLoteSugeridoFEFO,
  type LoteDisponivelDto,
  type MedicamentoBuscaDto,
} from "@farmaubs/shared";
import { catalogoDispensacaoService } from "../../services/catalogo-dispensacao.service";
import { AlertaIndiceTerapeutico } from "./AlertaIndiceTerapeutico";

export interface ItemSelecionadoFefoPayload {
  medicamento: MedicamentoBuscaDto;
  lote: LoteDisponivelDto;
  quantidade: number;
  posologia?: string;
}

export interface SeletorLoteFefoProps {
  medicamento: MedicamentoBuscaDto;
  lotesIniciais?: LoteDisponivelDto[];
  ubsId?: string;
  onAdicionarAoCarrinho: (item: ItemSelecionadoFefoPayload) => void;
  onCancelarSelecao?: () => void;
}

/**
 * [RF010 / ADR-032]: Exibe o lote pré-selecionado automaticamente por FEFO (vencimento mais próximo),
 * permite troca manual para outro lote com saldo positivo, alerta validade curta (< 30 dias) e valida
 * a quantidade máxima contra o saldo disponível no lote.
 */
export function SeletorLoteFefo({
  medicamento,
  lotesIniciais,
  ubsId,
  onAdicionarAoCarrinho,
  onCancelarSelecao,
}: SeletorLoteFefoProps) {
  let queryClient: ReturnType<typeof useQueryClient> | null = null;
  try {
    queryClient = useQueryClient();
  } catch {
    // Permite execução resiliente em testes isolados sem QueryClientProvider
  }

  const [lotes, setLotes] = useState<LoteDisponivelDto[]>(lotesIniciais ?? []);
  const [loteSelecionadoId, setLoteSelecionadoId] = useState<string>("");
  const [mostrarSeletorManual, setMostrarSeletorManual] = useState(false);
  const [quantidade, setQuantidade] = useState<number>(1);
  const [posologia, setPosologia] = useState<string>("");
  const [carregandoLotes, setCarregandoLotes] = useState<boolean>(
    !lotesIniciais,
  );

  useEffect(() => {
    if (lotesIniciais) {
      setLotes(lotesIniciais);
      const sugerido =
        selecionarLoteSugeridoFEFO(lotesIniciais) ??
        lotesIniciais.find((l) => l.saldoDisponivel > 0 && !l.vencido) ??
        null;
      setLoteSelecionadoId(sugerido?.id ?? "");
      setCarregandoLotes(false);
      return;
    }

    let ativo = true;
    setCarregandoLotes(true);

    const carregar = async () => {
      try {
        const resposta = queryClient
          ? await queryClient.fetchQuery({
              queryKey: ["lotes-fefo", medicamento.id, ubsId],
              queryFn: () =>
                catalogoDispensacaoService.obterLotesFefo(
                  medicamento.id,
                  ubsId,
                ),
              staleTime: 15_000,
            })
          : await catalogoDispensacaoService.obterLotesFefo(
              medicamento.id,
              ubsId,
            );

        if (!ativo) return;
        const disponiveis = resposta.lotesDisponiveis ?? [];
        setLotes(disponiveis);
        const padrao =
          resposta.loteSugerido ??
          selecionarLoteSugeridoFEFO(disponiveis) ??
          disponiveis.find((l) => l.saldoDisponivel > 0 && !l.vencido) ??
          null;
        setLoteSelecionadoId(padrao?.id ?? "");
      } catch {
        if (ativo) setLotes([]);
      } finally {
        if (ativo) setCarregandoLotes(false);
      }
    };

    void carregar();
    return () => {
      ativo = false;
    };
  }, [medicamento.id, ubsId, lotesIniciais, queryClient]);

  const loteSelecionado =
    lotes.find((l) => l.id === loteSelecionadoId) ?? null;

  const saldoMaximo = loteSelecionado?.saldoDisponivel ?? 0;
  const saldoInsuficiente =
    Boolean(loteSelecionado) && quantidade > saldoMaximo;
  const quantidadeInvalida = !Number.isFinite(quantidade) || quantidade < 1;
  const loteInapto =
    !loteSelecionado ||
    loteSelecionado.vencido ||
    loteSelecionado.saldoDisponivel <= 0;

  const podeAdicionar =
    !carregandoLotes &&
    !loteInapto &&
    !quantidadeInvalida &&
    !saldoInsuficiente;

  const handleQuantidadeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setQuantidade(Number.isNaN(val) ? 0 : val);
  };

  const incrementarQuantidade = (delta: number) => {
    setQuantidade((atual) => Math.max(1, (atual || 0) + delta));
  };

  const handleConfirmarInclusao = () => {
    if (!podeAdicionar || !loteSelecionado) return;
    onAdicionarAoCarrinho({
      medicamento,
      lote: loteSelecionado,
      quantidade,
      posologia: posologia.trim() || undefined,
    });
  };

  return (
    <div
      data-testid="seletor-lote-fefo"
      className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {medicamento.principioAtivo}{" "}
            {medicamento.apresentacao ? `- ${medicamento.apresentacao}` : ""}
          </h3>
          {medicamento.nomeComercial && (
            <p className="text-xs text-slate-500">
              Referência: {medicamento.nomeComercial}
            </p>
          )}
        </div>
        {onCancelarSelecao && (
          <button
            type="button"
            onClick={onCancelarSelecao}
            className="text-xs text-slate-500 hover:text-slate-800"
          >
            Cancelar
          </button>
        )}
      </div>

      {/* Alerta clínico de Índice Terapêutico Estreito (RF010) */}
      <AlertaIndiceTerapeutico medicamento={medicamento} />

      {carregandoLotes ? (
        <p role="status" className="text-xs text-slate-600">
          Buscando lotes disponíveis no estoque...
        </p>
      ) : !loteSelecionado ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"
        >
          Nenhum lote válido com saldo disponível na unidade para este
          medicamento.
        </div>
      ) : (
        <div className="space-y-3">
          {/* Card do Lote Selecionado */}
          <div className="rounded-lg border border-emerald-300 bg-white p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {loteSelecionado.sugeridoFefo && (
                  <span
                    data-testid="badge-sugerido-fefo"
                    className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 border border-emerald-300"
                  >
                    Lote recomendado (vence primeiro)
                  </span>
                )}
                {(loteSelecionado.alertaValidadeCurta ||
                  (loteSelecionado.diasParaVencimento >= 0 &&
                    loteSelecionado.diasParaVencimento <= 30)) && (
                  <span
                    data-testid="badge-validade-curta"
                    className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 border border-amber-300"
                  >
                    ⚠️ Vence em {loteSelecionado.diasParaVencimento} dias
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-800">
                <strong>Lote:</strong> {loteSelecionado.numeroLote} |{" "}
                <strong>Validade:</strong>{" "}
                {formatarDataIsoParaBr(loteSelecionado.dataValidade)} |{" "}
                <strong>Saldo:</strong> {loteSelecionado.saldoDisponivel} un.
              </p>
            </div>

            {lotes.length > 1 && (
              <button
                type="button"
                onClick={() => setMostrarSeletorManual((prev) => !prev)}
                className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                {mostrarSeletorManual ? "Ocultar Lotes" : "Trocar Lote"}
              </button>
            )}
          </div>

          {/* Seletor manual de outros lotes físicos da UBS */}
          {mostrarSeletorManual && (
            <div>
              <label
                htmlFor="seletor-manual-lote"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Selecionar outro lote em estoque na UBS
              </label>
              <select
                id="seletor-manual-lote"
                value={loteSelecionadoId}
                onChange={(e) => setLoteSelecionadoId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              >
                {lotes.map((l) => {
                  const desabilitado = l.vencido || l.saldoDisponivel <= 0;
                  const sufixoStatus = l.vencido
                    ? " (Vencido - bloqueado)"
                    : l.saldoDisponivel <= 0
                      ? " (Sem saldo)"
                      : l.sugeridoFefo
                        ? " (Recomendado — vence primeiro)"
                        : "";
                  return (
                    <option
                      key={l.id}
                      value={l.id}
                      disabled={desabilitado}
                    >
                      Lote: {l.numeroLote} | Validade:{" "}
                      {formatarDataIsoParaBr(l.dataValidade)} | Saldo:{" "}
                      {l.saldoDisponivel} un.{sufixoStatus}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Quantidade e botões rápidos (+1, +10, +30) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label
                htmlFor="quantidade-dispensar-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Quantidade a Dispensar (un.)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="quantidade-dispensar-input"
                  type="number"
                  min={1}
                  max={saldoMaximo}
                  value={quantidade || ""}
                  onChange={handleQuantidadeChange}
                  aria-invalid={saldoInsuficiente || quantidadeInvalida}
                  className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => incrementarQuantidade(1)}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  +1
                </button>
                <button
                  type="button"
                  onClick={() => incrementarQuantidade(10)}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  +10
                </button>
                <button
                  type="button"
                  onClick={() => incrementarQuantidade(30)}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  +30
                </button>
              </div>
              {saldoInsuficiente && (
                <p
                  role="alert"
                  data-testid="alerta-saldo-insuficiente"
                  className="mt-1 text-xs font-semibold text-red-600"
                >
                  Saldo insuficiente no lote selecionado (máximo disponível:{" "}
                  {saldoMaximo} un.).
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="posologia-inicial-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Posologia recomendada (opcional)
              </label>
              <input
                id="posologia-inicial-input"
                type="text"
                placeholder="Ex.: 1 cp de 12/12h por 7 dias"
                value={posologia}
                onChange={(e) => setPosologia(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={!podeAdicionar}
              onClick={handleConfirmarInclusao}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Adicionar ao Atendimento
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SeletorLoteFefo;
