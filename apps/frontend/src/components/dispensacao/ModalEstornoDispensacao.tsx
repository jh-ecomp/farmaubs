import { useState, useEffect, type FormEvent } from "react";
import type { DispensacaoItemListaDto } from "@farmaubs/shared";

export interface ModalEstornoDispensacaoProps {
  atendimento: DispensacaoItemListaDto | null;
  processando?: boolean;
  onConfirmarEstorno: (dispensacaoId: string, motivoEstorno: string) => void;
  onFechar: () => void;
}

/**
 * [RF028 / ADR-032]: Modal acessível de confirmação de estorno de atendimento com validação obrigatória
 * de justificativa (mínimo de 10 caracteres) e fechamento via tecla Escape.
 */
export function ModalEstornoDispensacao({
  atendimento,
  processando = false,
  onConfirmarEstorno,
  onFechar,
}: ModalEstornoDispensacaoProps) {
  const [motivo, setMotivo] = useState("");
  const [erroMotivo, setErroMotivo] = useState<string | null>(null);

  useEffect(() => {
    setMotivo("");
    setErroMotivo(null);
  }, [atendimento?.id]);

  useEffect(() => {
    if (!atendimento) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !processando) {
        onFechar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [atendimento, processando, onFechar]);

  if (!atendimento) {
    return null;
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const limpo = motivo.trim();
    if (limpo.length < 10) {
      setErroMotivo(
        "O motivo do estorno deve possuir no mínimo 10 caracteres.",
      );
      return;
    }
    setErroMotivo(null);
    onConfirmarEstorno(atendimento.id, limpo);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-estorno"
      data-testid="modal-estorno-dispensacao"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <h2
              id="titulo-modal-estorno"
              className="text-base font-bold text-slate-900"
            >
              Estornar Atendimento #{atendimento.numeroAtendimento}
            </h2>
            <p className="text-xs text-slate-500">
              As quantidades entregues voltarão automaticamente para o estoque
              da unidade
            </p>
          </div>
          <button
            type="button"
            disabled={processando}
            onClick={onFechar}
            aria-label="Fechar modal de estorno"
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            ✕
          </button>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 space-y-1">
          <p>
            <strong>Paciente:</strong> {atendimento.pacienteNome} (CPF:{" "}
            {atendimento.pacienteCpf})
          </p>
          <p>
            <strong>Itens que retornarão ao estoque:</strong>{" "}
            {atendimento.medicamentosResumo}
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="motivo-estorno-textarea"
              className="block text-xs font-semibold text-slate-800 mb-1"
            >
              Justificativa / Motivo do Estorno{" "}
              <span className="text-red-600">*</span>
            </label>
            <textarea
              id="motivo-estorno-textarea"
              rows={3}
              autoFocus
              placeholder="Descreva o motivo do estorno (mínimo de 10 caracteres)..."
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                if (erroMotivo) setErroMotivo(null);
              }}
              aria-invalid={Boolean(erroMotivo)}
              aria-describedby={
                erroMotivo ? "erro-motivo-estorno-msg" : undefined
              }
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600"
            />
            {erroMotivo && (
              <p
                id="erro-motivo-estorno-msg"
                role="alert"
                className="mt-1 text-xs font-semibold text-red-600"
              >
                {erroMotivo}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={processando}
              onClick={onFechar}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={processando}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {processando ? "Estornando..." : "Confirmar Estorno"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ModalEstornoDispensacao;
