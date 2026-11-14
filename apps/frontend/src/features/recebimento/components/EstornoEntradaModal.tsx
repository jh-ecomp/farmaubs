import React, { useEffect, useState } from "react";
import type {
  ItemResumoHistoricoRecebimento,
  ResultadoEstornoRecebimento,
} from "@farmaubs/shared";
import { recebimentoService } from "../../../services/recebimento.service";
import { RotateCcw, X, AlertTriangle, Loader2 } from "lucide-react";

export interface EstornoEntradaModalProps {
  aberto: boolean;
  entrada: ItemResumoHistoricoRecebimento | null;
  onFechar: () => void;
  onSucessoEstorno: (resultado: ResultadoEstornoRecebimento) => void;
}

/**
 * Modal de confirmação de estorno de guia de recebimento com justificativa obrigatória.
 */
export const EstornoEntradaModal: React.FC<EstornoEntradaModalProps> = ({
  aberto,
  entrada,
  onFechar,
  onSucessoEstorno,
}) => {
  const [motivo, setMotivo] = useState("");
  const [submetendo, setSubmetendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) {
      setMotivo("");
      setErro(null);
      setSubmetendo(false);
    }
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submetendo) {
        onFechar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [aberto, submetendo, onFechar]);

  if (!aberto || !entrada) return null;

  const justificativaValida = motivo.trim().length >= 10;

  const handleConfirmarEstorno = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justificativaValida || submetendo) return;

    setSubmetendo(true);
    setErro(null);

    try {
      const resultado = await recebimentoService.estornarEntrada(
        entrada.id,
        motivo.trim(),
      );
      onSucessoEstorno(resultado);
    } catch (err) {
      setErro(
        err instanceof Error
          ? err.message
          : "Não foi possível estornar este recebimento.",
      );
    } finally {
      setSubmetendo(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-estorno-recebimento"
    >
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-red-50 text-red-700">
              <RotateCcw className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3
                id="titulo-modal-estorno-recebimento"
                className="text-base font-bold text-slate-900"
              >
                Estornar Guia de Recebimento
              </h3>
              <p className="text-xs text-slate-500">
                Documento: <strong>{entrada.numeroDocumento}</strong> ({entrada.fornecedorOrigem})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onFechar}
            disabled={submetendo}
            aria-label="Fechar modal de estorno"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleConfirmarEstorno} className="space-y-4">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
            <p className="font-semibold mb-0.5">
              Atenção: operação de reversão de saldo no estoque
            </p>
            <p>
              O estorno deduzirá do estoque da UBS os{" "}
              <strong>{entrada.totalItens} itens</strong> ({entrada.totalUnidades}{" "}
              unidades) lançados nesta guia. Caso algum lote já tenha sido
              dispensado a pacientes, o estorno será bloqueado.
            </p>
          </div>

          {erro && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-xs font-medium text-red-700"
            >
              <AlertTriangle
                className="w-4 h-4 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{erro}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="motivoEstornoRecebimento"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Justificativa do Estorno <span className="text-red-600">*</span>
            </label>
            <textarea
              id="motivoEstornoRecebimento"
              rows={3}
              autoFocus
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo do estorno (mínimo de 10 caracteres, ex: Erro de digitação na quantidade física do lote)..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600"
            />
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>Informe pelo menos 10 caracteres para registrar na auditoria.</span>
              <span>{motivo.trim().length}/10 mín.</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onFechar}
              disabled={submetendo}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!justificativaValida || submetendo}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submetendo && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Confirmar Estorno</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
