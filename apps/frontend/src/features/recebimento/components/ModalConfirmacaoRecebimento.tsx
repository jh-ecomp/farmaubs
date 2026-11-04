import React, { useEffect } from "react";
import type {
  CabecalhoRecebimentoDto,
  ItemRecebimentoFormDto,
} from "@farmaubs/shared";
import { CheckCircle2, X, Loader2, PackageCheck } from "lucide-react";

export interface ModalConfirmacaoRecebimentoProps {
  aberto: boolean;
  cabecalho: CabecalhoRecebimentoDto;
  itens: ItemRecebimentoFormDto[];
  submetendo: boolean;
  onFechar: () => void;
  onConfirmar: () => void;
}

/**
 * Modal de revisão final antes de efetivar a entrada de medicamentos no estoque da UBS.
 * Previne duplo clique durante a requisição HTTP.
 */
export const ModalConfirmacaoRecebimento: React.FC<
  ModalConfirmacaoRecebimentoProps
> = ({ aberto, cabecalho, itens, submetendo, onFechar, onConfirmar }) => {
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

  if (!aberto) return null;

  const totalUnidades = itens.reduce(
    (acc, item) => acc + item.quantidadeRecebida,
    0,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-confirmacao-recebimento"
    >
      <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-teal-50 text-teal-700">
              <PackageCheck className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3
                id="titulo-modal-confirmacao-recebimento"
                className="text-base font-bold text-slate-900"
              >
                Revisar e Confirmar Entrada no Estoque
              </h3>
              <p className="text-xs text-slate-500">
                Confira os dados da guia antes de abastecer o saldo físico da UBS.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onFechar}
            disabled={submetendo}
            aria-label="Fechar revisão"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 border border-slate-200 p-3.5 text-xs">
            <div>
              <span className="block text-slate-500">Nº Documento / Guia</span>
              <strong className="text-slate-900 text-sm">
                {cabecalho.numeroDocumento}
              </strong>
            </div>
            <div>
              <span className="block text-slate-500">Fornecedor / Origem</span>
              <strong className="text-slate-900">
                {cabecalho.fornecedorOrigem}
              </strong>
            </div>
            <div>
              <span className="block text-slate-500">Total de Lotes</span>
              <strong className="text-slate-900">
                {itens.length} medicamentos distintos
              </strong>
            </div>
            <div>
              <span className="block text-slate-500">Volume Físico Total</span>
              <strong className="text-teal-800 text-sm">
                {totalUnidades} unidades físicas a ingressar
              </strong>
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase">
                <tr>
                  <th className="px-3 py-2 font-semibold">Medicamento</th>
                  <th className="px-3 py-2 font-semibold">Lote</th>
                  <th className="px-3 py-2 font-semibold text-right">
                    Quantidade
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {itens.map((item) => (
                  <tr key={item.idProvisorio}>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {item.produtoNome} {item.concentracao}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-700">
                      {item.numeroLote}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-900">
                      {item.quantidadeRecebida} un.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onFechar}
              disabled={submetendo}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Voltar e Revisar
            </button>
            <button
              type="button"
              onClick={onConfirmar}
              disabled={submetendo}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submetendo ? (
                <>
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    aria-hidden="true"
                  />
                  <span>Processando entrada...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  <span>Confirmar e Abastecer Estoque</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
