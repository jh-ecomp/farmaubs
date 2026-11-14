import { useEffect } from "react";
import {
  formatarCNS,
  formatarCPF,
  formatarDataIsoParaBr,
  type PacienteDispensacaoRequest,
} from "@farmaubs/shared";
import type { ItemCarrinhoDispensacao } from "../../contexts/DispensacaoContext";

export interface ModalConfirmacaoDispensacaoProps {
  aberto: boolean;
  paciente: PacienteDispensacaoRequest | null;
  itens: ItemCarrinhoDispensacao[];
  receitaEmissaoEm?: string;
  processando?: boolean;
  onConfirmarBaixa: () => void;
  onCancelar: () => void;
}

/**
 * [RF010 / ADR-032]: Modal acessível de revisão e confirmação final da dispensação antes da baixa transacional de estoque,
 * com suporte a fechamento via Escape e botão primário com foco automático.
 */
export function ModalConfirmacaoDispensacao({
  aberto,
  paciente,
  itens,
  receitaEmissaoEm,
  processando = false,
  onConfirmarBaixa,
  onCancelar,
}: ModalConfirmacaoDispensacaoProps) {
  useEffect(() => {
    if (!aberto) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !processando) {
        onCancelar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [aberto, processando, onCancelar]);

  if (!aberto || !paciente) {
    return null;
  }

  const totalUnidades = itens.reduce(
    (acc, item) => acc + item.quantidadeDispensada,
    0,
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-confirmacao-dispensacao"
      data-testid="modal-confirmacao-dispensacao"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <h2
              id="titulo-modal-confirmacao-dispensacao"
              className="text-base font-bold text-slate-900"
            >
              Confirmar Dispensação e Baixa de Estoque
            </h2>
            <p className="text-xs text-slate-500">
              Verifique o paciente e os lotes selecionados antes de gravar a
              saída definitiva
            </p>
          </div>
          <button
            type="button"
            disabled={processando}
            onClick={onCancelar}
            aria-label="Fechar modal de confirmação"
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Resumo do Paciente */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-1">
          <p className="font-semibold text-slate-900 text-sm">
            {paciente.nomeCompleto}
          </p>
          <p className="text-slate-600">
            <strong>CPF:</strong> {formatarCPF(paciente.cpf)} |{" "}
            <strong>CNS:</strong> {formatarCNS(paciente.cns)} |{" "}
            <strong>Nascimento:</strong>{" "}
            {formatarDataIsoParaBr(paciente.dataNascimento)}
          </p>
          {receitaEmissaoEm && (
            <p className="text-blue-800 font-medium">
              <strong>Data de Emissão da Receita:</strong>{" "}
              {formatarDataIsoParaBr(receitaEmissaoEm)}
            </p>
          )}
        </div>

        {/* Lista dos Medicamentos, Lotes e Quantidades */}
        <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-200">
          {itens.map((item) => (
            <div
              key={`${item.medicamento.id}-${item.lote.id}`}
              className="p-3 text-xs flex items-center justify-between gap-2"
            >
              <div>
                <p className="font-semibold text-slate-900">
                  {item.medicamento.principioAtivo}{" "}
                  {item.medicamento.apresentacao
                    ? `- ${item.medicamento.apresentacao}`
                    : ""}
                </p>
                <p className="text-slate-500">
                  Lote: <strong>{item.lote.numeroLote}</strong> | Validade:{" "}
                  {formatarDataIsoParaBr(item.lote.dataValidade)}
                  {item.posologia ? ` | Posologia: ${item.posologia}` : ""}
                </p>
              </div>
              <span className="rounded-lg bg-blue-50 px-2.5 py-1 font-bold text-blue-900 shrink-0">
                {item.quantidadeDispensada} un.
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
          <span>
            Total de itens: <strong>{itens.length}</strong>
          </span>
          <span>
            Total de unidades a baixar: <strong>{totalUnidades} un.</strong>
          </span>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={processando}
            onClick={onCancelar}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            autoFocus
            disabled={processando}
            onClick={onConfirmarBaixa}
            className="rounded-lg bg-emerald-700 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {processando ? "Processando baixa..." : "Confirmar Baixa de Estoque"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModalConfirmacaoDispensacao;
