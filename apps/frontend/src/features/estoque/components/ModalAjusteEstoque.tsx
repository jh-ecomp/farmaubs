import React, { useEffect, useRef, useState } from "react";
import {
  JUSTIFICATIVA_AJUSTE_MAX,
  JUSTIFICATIVA_AJUSTE_MIN,
  JUSTIFICATIVA_AJUSTE_MIN_OUTRO,
  MOTIVOS_AJUSTE_ENTRADA,
  MOTIVOS_AJUSTE_SAIDA,
  motivoCompativelComTipo,
  saldoSuficiente,
  validarJustificativaAjuste,
  type AjusteEstoqueResultadoDto,
  type LoteEstoqueDto,
  type MedicamentoSaldoItemDto,
  type MotivoAjuste,
  type RegistrarAjusteLoteInputDto,
  type TipoOperacaoAjuste,
} from "@farmaubs/shared";
import { useQueryClient } from "@tanstack/react-query";
import { estoqueService } from "../../../services/estoque.service";

export interface ModalAjusteEstoqueProps {
  aberto: boolean;
  lote: LoteEstoqueDto | null;
  medicamento: MedicamentoSaldoItemDto | null;
  onFechar: () => void;
  onSucesso?: (
    resultado: AjusteEstoqueResultadoDto,
    mensagem: string,
  ) => void;
  onConfirmarAjuste?: (
    loteId: string,
    payload: RegistrarAjusteLoteInputDto,
  ) => Promise<AjusteEstoqueResultadoDto>;
}

const ROTULOS_MOTIVOS_AJUSTE: Record<MotivoAjuste, string> = {
  CORRECAO_INVENTARIO: "Correção de Inventário",
  DEVOLUCAO_PACIENTE: "Devolução de Paciente",
  VENCIMENTO: "Validade Vencida",
  AVARIA_FISICA: "Avaria Física / Quebra",
  EXTRAVIO: "Extravio",
  RECOLHIMENTO_SANITARIO: "Recolhimento Sanitário",
  OUTRO: "Outro",
};

/**
 * [ES-09 / RF009 / RF011 / RF028 / ADR-032]: Modal acessível para lançamento de ajuste rápido (+) ou (-) em um lote.
 * Aplica validações de compatibilidade de motivo, saldo máximo em saídas e mínimo de 20 caracteres para o motivo "Outro".
 */
export const ModalAjusteEstoque: React.FC<ModalAjusteEstoqueProps> = ({
  aberto,
  lote,
  medicamento,
  onFechar,
  onSucesso,
  onConfirmarAjuste,
}) => {
  let queryClient: ReturnType<typeof useQueryClient> | null = null;
  try {
    queryClient = useQueryClient();
  } catch {
    // Resiliência para testes unitários sem QueryClientProvider
  }

  const dialogRef = useRef<HTMLDivElement>(null);

  const [tipoOperacao, setTipoOperacao] =
    useState<TipoOperacaoAjuste>("SAIDA");
  const [quantidadeStr, setQuantidadeStr] = useState<string>("1");
  const [motivo, setMotivo] = useState<MotivoAjuste>("AVARIA_FISICA");
  const [justificativa, setJustificativa] = useState<string>("");
  const [submetendo, setSubmetendo] = useState<boolean>(false);
  const [erroApi, setErroApi] = useState<string | null>(null);

  // Reseta estado ao abrir modal para um novo lote
  useEffect(() => {
    if (aberto && lote) {
      setTipoOperacao("SAIDA");
      setQuantidadeStr("1");
      setMotivo("AVARIA_FISICA");
      setJustificativa("");
      setSubmetendo(false);
      setErroApi(null);
    }
  }, [aberto, lote]);

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
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

  if (!aberto || !lote) {
    return null;
  }

  const motivosPermitidos: readonly MotivoAjuste[] =
    tipoOperacao === "ENTRADA"
      ? MOTIVOS_AJUSTE_ENTRADA
      : MOTIVOS_AJUSTE_SAIDA;

  const handleTrocarOperacao = (novoTipo: TipoOperacaoAjuste) => {
    setTipoOperacao(novoTipo);
    setErroApi(null);
    if (!motivoCompativelComTipo(novoTipo, motivo)) {
      setMotivo(
        novoTipo === "ENTRADA" ? "CORRECAO_INVENTARIO" : "AVARIA_FISICA",
      );
    }
  };

  const quantidadeNum = Number(quantidadeStr);
  const quantidadeValida =
    Number.isInteger(quantidadeNum) && quantidadeNum >= 1;

  const saldoComporta =
    tipoOperacao === "ENTRADA" ||
    (quantidadeValida && saldoSuficiente(lote.saldoAtual, quantidadeNum));

  const novoSaldoPrevisto = quantidadeValida
    ? tipoOperacao === "ENTRADA"
      ? lote.saldoAtual + quantidadeNum
      : lote.saldoAtual - quantidadeNum
    : lote.saldoAtual;

  const textoJustificativa = justificativa.trim();
  const minCaracteres =
    motivo === "OUTRO"
      ? JUSTIFICATIVA_AJUSTE_MIN_OUTRO
      : JUSTIFICATIVA_AJUSTE_MIN;

  const erroJustificativaShared = validarJustificativaAjuste(
    motivo,
    justificativa,
  );
  const mensagemAvisoJustificativa =
    motivo === "OUTRO" && textoJustificativa.length < JUSTIFICATIVA_AJUSTE_MIN_OUTRO
      ? "O motivo 'Outro' exige justificativa detalhada com no mínimo 20 caracteres"
      : erroJustificativaShared;

  const justificativaValida = erroJustificativaShared === null;
  const motivoValido = motivoCompativelComTipo(tipoOperacao, motivo);

  const podeConfirmar =
    quantidadeValida &&
    saldoComporta &&
    motivoValido &&
    justificativaValida &&
    !submetendo;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeConfirmar) return;

    setSubmetendo(true);
    setErroApi(null);

    const payload: RegistrarAjusteLoteInputDto = {
      tipoOperacao,
      quantidade: quantidadeNum,
      motivo,
      justificativa: textoJustificativa,
    };

    try {
      const resultado = onConfirmarAjuste
        ? await onConfirmarAjuste(lote.id, payload)
        : await estoqueService.registrarAjuste(lote.id, payload);

      if (queryClient) {
        queryClient.invalidateQueries({ queryKey: ["estoque", "metricas"] });
        queryClient.invalidateQueries({ queryKey: ["estoque", "saldos"] });
        queryClient.invalidateQueries({
          queryKey: ["estoque", "rastreabilidade", lote.id],
        });
      }

      const sinal = tipoOperacao === "ENTRADA" ? "+" : "-";
      const msg = `Ajuste (${sinal}${quantidadeNum}) registrado com sucesso no lote ${lote.numeroLote}. Novo saldo: ${resultado.saldoAtualizado}.`;
      onSucesso?.(resultado, msg);
      onFechar();
    } catch (err: unknown) {
      const mensagemErro =
        err instanceof Error
          ? err.message
          : "Não foi possível registrar o ajuste de estoque.";
      setErroApi(mensagemErro);
    } finally {
      setSubmetendo(false);
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
        aria-labelledby="modal-ajuste-estoque-titulo"
        data-testid="modal-ajuste-estoque"
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-800"
              aria-hidden="true"
            >
              <span className="material-symbols-outlined text-xl">tune</span>
            </span>
            <div>
              <h2
                id="modal-ajuste-estoque-titulo"
                className="text-base font-bold text-slate-900"
              >
                Ajuste Rápido de Estoque (+/-)
              </h2>
              <p className="text-xs text-slate-600">
                Movimentação auditada com justificativa sanitária obrigatória
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Fechar modal de ajuste"
            data-testid="btn-fechar-modal-ajuste"
            onClick={onFechar}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Resumo do Lote e Medicamento */}
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <strong className="text-sm text-slate-900">
                {medicamento?.nome ?? "Medicamento"}
              </strong>
              {medicamento && (
                <span className="ml-1 text-slate-600">
                  ({medicamento.concentracao} • {medicamento.formaFarmaceutica})
                </span>
              )}
              <div className="mt-1 text-slate-600">
                Lote:{" "}
                <strong className="font-mono text-slate-900">
                  {lote.numeroLote}
                </strong>{" "}
                • Fabricante: <strong>{lote.fabricanteNome}</strong>
              </div>
            </div>

            <div className="text-right">
              <span className="block text-[11px] font-semibold text-slate-600 uppercase">
                Saldo Atual
              </span>
              <span
                data-testid="modal-ajuste-saldo-atual"
                className="text-base font-bold text-blue-900"
              >
                {lote.saldoAtual}{" "}
                <small className="font-normal">
                  {medicamento?.unidadeMedida ?? "unid."}
                </small>
              </span>
            </div>
          </div>
        </div>

        {/* Formulário de Ajuste */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
          {/* 1. Alternância de Operação: Entrada (+) ou Saída (-) */}
          <div>
            <span className="mb-1.5 block text-xs font-bold text-slate-700">
              Tipo de Operação
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="btn-operacao-entrada"
                aria-pressed={tipoOperacao === "ENTRADA"}
                onClick={() => handleTrocarOperacao("ENTRADA")}
                className={`flex items-center justify-center gap-1.5 rounded-lg border py-2.5 px-3 text-xs font-bold transition-all ${
                  tipoOperacao === "ENTRADA"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span
                  className="material-symbols-outlined text-base"
                  aria-hidden="true"
                >
                  add_circle
                </span>
                <span>Entrada (+)</span>
              </button>

              <button
                type="button"
                data-testid="btn-operacao-saida"
                aria-pressed={tipoOperacao === "SAIDA"}
                onClick={() => handleTrocarOperacao("SAIDA")}
                className={`flex items-center justify-center gap-1.5 rounded-lg border py-2.5 px-3 text-xs font-bold transition-all ${
                  tipoOperacao === "SAIDA"
                    ? "border-rose-600 bg-rose-50 text-rose-900 ring-2 ring-rose-500/20"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span
                  className="material-symbols-outlined text-base"
                  aria-hidden="true"
                >
                  remove_circle
                </span>
                <span>Saída (-)</span>
              </button>
            </div>
          </div>

          {/* 2. Quantidade e Motivo Sanitário */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ajuste-quantidade-input"
                className="mb-1 block text-xs font-bold text-slate-700"
              >
                Quantidade <span className="text-rose-700">*</span>
              </label>
              <input
                id="ajuste-quantidade-input"
                type="number"
                min={1}
                max={
                  tipoOperacao === "SAIDA"
                    ? Math.max(1, lote.saldoAtual)
                    : undefined
                }
                step={1}
                data-testid="input-quantidade-ajuste"
                value={quantidadeStr}
                onChange={(e) => {
                  setQuantidadeStr(e.target.value);
                  setErroApi(null);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 focus:outline-none"
              />
              {!saldoComporta && (
                <p
                  role="alert"
                  data-testid="erro-saldo-insuficiente-ajuste"
                  className="mt-1 text-xs font-semibold text-rose-700"
                >
                  A saída não pode exceder o saldo atual do lote (
                  {lote.saldoAtual}).
                </p>
              )}
              {quantidadeValida && saldoComporta && (
                <p className="mt-1 text-[11px] text-slate-600">
                  Saldo resultante:{" "}
                  <strong className="text-slate-900">
                    {novoSaldoPrevisto}
                  </strong>
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="ajuste-motivo-select"
                className="mb-1 block text-xs font-bold text-slate-700"
              >
                Motivo Sanitário <span className="text-rose-700">*</span>
              </label>
              <select
                id="ajuste-motivo-select"
                data-testid="select-motivo-ajuste"
                value={motivo}
                onChange={(e) => {
                  setMotivo(e.target.value as MotivoAjuste);
                  setErroApi(null);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 focus:outline-none"
              >
                {motivosPermitidos.map((codMotivo) => (
                  <option key={codMotivo} value={codMotivo}>
                    {ROTULOS_MOTIVOS_AJUSTE[codMotivo]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Justificativa por Extenso */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label
                htmlFor="ajuste-justificativa-textarea"
                className="text-xs font-bold text-slate-700"
              >
                Justificativa Obrigatória{" "}
                <span className="text-rose-700">*</span>
              </label>
              <span className="text-[11px] text-slate-600">
                {textoJustificativa.length}/{JUSTIFICATIVA_AJUSTE_MAX} (mín.{" "}
                {minCaracteres})
              </span>
            </div>
            <textarea
              id="ajuste-justificativa-textarea"
              rows={3}
              maxLength={JUSTIFICATIVA_AJUSTE_MAX}
              data-testid="textarea-justificativa-ajuste"
              value={justificativa}
              onChange={(e) => {
                setJustificativa(e.target.value);
                setErroApi(null);
              }}
              placeholder={
                motivo === "OUTRO"
                  ? "Descreva detalhadamente a ocorrência atípica (mínimo de 20 caracteres)..."
                  : "Descreva o motivo técnico/sanitário do ajuste (mínimo de 10 caracteres)..."
              }
              className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 focus:outline-none"
            />
            {mensagemAvisoJustificativa && (
              <p
                role="alert"
                data-testid="aviso-justificativa-ajuste"
                className="mt-1 text-xs font-medium text-amber-800"
              >
                {mensagemAvisoJustificativa}
              </p>
            )}
          </div>

          {/* Erro de API se houver */}
          {erroApi && (
            <div
              role="alert"
              data-testid="erro-api-ajuste"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800"
            >
              {erroApi}
            </div>
          )}

          {/* Rodapé com Ações */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              data-testid="btn-cancelar-ajuste"
              onClick={onFechar}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              data-testid="btn-confirmar-ajuste"
              disabled={!podeConfirmar}
              aria-busy={submetendo}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-800 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span
                className="material-symbols-outlined text-sm"
                aria-hidden="true"
              >
                check_circle
              </span>
              <span>
                {submetendo ? "Processando..." : "Confirmar Ajuste"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
