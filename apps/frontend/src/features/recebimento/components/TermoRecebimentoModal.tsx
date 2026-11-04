import React, { useEffect, useState } from "react";
import type {
  DetalhesRecebimentoCompleto,
  ItemResumoHistoricoRecebimento,
} from "@farmaubs/shared";
import { recebimentoService } from "../../../services/recebimento.service";
import { Printer, X, FileCheck2, Loader2, AlertCircle } from "lucide-react";

export interface TermoRecebimentoModalProps {
  aberto: boolean;
  resumoEntrada: ItemResumoHistoricoRecebimento | null;
  detalhesIniciais?: DetalhesRecebimentoCompleto | null;
  onFechar: () => void;
}

/**
 * Formata uma data ISO ou YYYY-MM-DD para exibição amigável pt-BR.
 * @param valor - Data em string ou Date.
 * @param incluirHora - Se verdadeiro, inclui horário HH:mm.
 * @returns Data formatada em pt-BR.
 */
function formatarDataPtBr(
  valor: string | Date | undefined | null,
  incluirHora = false,
): string {
  if (!valor) return "—";
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [ano, mes, dia] = valor.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return String(valor);
  return incluirHora
    ? d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : d.toLocaleDateString("pt-BR");
}

/**
 * Modal de exibição e impressão do Termo de Recebimento de Carga SUS.
 */
export const TermoRecebimentoModal: React.FC<TermoRecebimentoModalProps> = ({
  aberto,
  resumoEntrada,
  detalhesIniciais,
  onFechar,
}) => {
  const [detalhes, setDetalhes] = useState<DetalhesRecebimentoCompleto | null>(
    detalhesIniciais ?? null,
  );
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) {
      setDetalhes(null);
      setErro(null);
      return;
    }

    if (detalhesIniciais) {
      setDetalhes(detalhesIniciais);
      return;
    }

    if (!resumoEntrada) return;

    let ativo = true;
    setCarregando(true);
    setErro(null);

    recebimentoService
      .obterDetalhesEntrada(resumoEntrada.id)
      .then((dados) => {
        if (ativo) {
          setDetalhes(dados);
        }
      })
      .catch((err) => {
        if (ativo) {
          setErro(
            err instanceof Error
              ? err.message
              : "Não foi possível carregar os itens deste comprovante.",
          );
        }
      })
      .finally(() => {
        if (ativo) {
          setCarregando(false);
        }
      });

    return () => {
      ativo = false;
    };
  }, [aberto, resumoEntrada, detalhesIniciais]);

  useEffect(() => {
    if (!aberto) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onFechar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [aberto, onFechar]);

  if (!aberto || (!resumoEntrada && !detalhesIniciais)) return null;

  const numeroDoc =
    detalhes?.numeroDocumento ?? resumoEntrada?.numeroDocumento ?? "—";
  const tipoDoc =
    detalhes?.tipoDocumento ?? resumoEntrada?.tipoDocumento ?? "GUIA_CAF";
  const fornecedor =
    detalhes?.fornecedorOrigem ?? resumoEntrada?.fornecedorOrigem ?? "—";
  const dataRec =
    detalhes?.dataRecebimento ?? resumoEntrada?.dataRecebimento ?? "";
  const recebedor =
    detalhes?.usuarioRecebedorNome ??
    resumoEntrada?.usuarioRecebedorNome ??
    "Farmacêutico Responsável";
  const status = detalhes?.status ?? resumoEntrada?.status ?? "CONCLUIDO";
  const totalItens = detalhes?.totalItens ?? resumoEntrada?.totalItens ?? 0;
  const totalUnidades =
    detalhes?.totalUnidades ?? resumoEntrada?.totalUnidades ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-termo-recebimento-sus"
    >
      <div className="w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl border border-slate-200 my-8">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-teal-50 text-teal-700">
              <FileCheck2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3
                id="titulo-termo-recebimento-sus"
                className="text-base font-bold text-slate-900"
              >
                Termo de Recebimento de Carga SUS
              </h3>
              <p className="text-xs text-slate-500">
                Comprovante oficial de conferência e abastecimento físico de lotes na UBS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar comprovante"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          id="termoRecebimentoPrintArea"
          className="space-y-5 rounded-xl border border-slate-200 p-5 bg-slate-50/40"
        >
          {/* Cabeçalho Institucional */}
          <div className="border-b border-slate-200 pb-4 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-teal-800">
              Sistema Único de Saúde — Secretaria Municipal de Saúde de Parnaíba
            </p>
            <h4 className="text-sm font-bold text-slate-900 mt-0.5">
              {detalhes?.ubsNome || "Farmácia da Unidade Básica de Saúde — Parnaíba/PI"}
            </h4>
            <p className="text-xs text-slate-600 mt-1">
              Termo de Conferência e Recebimento de Medicamentos — Nº {numeroDoc}
            </p>
          </div>

          {/* Metadados da Guia */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-white p-3.5 rounded-lg border border-slate-200">
            <div>
              <span className="block text-slate-500 font-medium">
                Nº Documento / Guia
              </span>
              <strong className="text-slate-900 text-sm">{numeroDoc}</strong>
              <span className="block text-[11px] text-slate-500">{tipoDoc}</span>
            </div>
            <div>
              <span className="block text-slate-500 font-medium">
                Fornecedor / Origem
              </span>
              <strong className="text-slate-900">{fornecedor}</strong>
            </div>
            <div>
              <span className="block text-slate-500 font-medium">
                Data/Hora do Recebimento
              </span>
              <strong className="text-slate-900">
                {formatarDataPtBr(dataRec, true)}
              </strong>
            </div>
            <div>
              <span className="block text-slate-500 font-medium">
                Situação da Guia
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold mt-0.5 ${
                  status === "ESTORNADO"
                    ? "bg-red-100 text-red-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {status === "ESTORNADO" ? "ESTORNADO" : "EFETIVADO"}
              </span>
            </div>
          </div>

          {carregando && (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
              <span>Carregando lotes conferidos...</span>
            </div>
          )}

          {erro && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* Tabela de Lotes Recebidos */}
          {detalhes && detalhes.itens && detalhes.itens.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Medicamento</th>
                    <th className="px-3 py-2 font-semibold">Fabricante</th>
                    <th className="px-3 py-2 font-semibold">Lote</th>
                    <th className="px-3 py-2 font-semibold">Validade</th>
                    <th className="px-3 py-2 font-semibold text-right">
                      Qtd. Recebida
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {detalhes.itens.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {item.produtoNome} {item.concentracao}
                        <span className="block text-[11px] text-slate-500">
                          {item.formaFarmaceutica}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {item.fabricanteNome}
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold text-slate-800">
                        {item.numeroLote}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {formatarDataPtBr(item.dataValidade)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-900">
                        {item.quantidadeRecebida} un.
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Resumo e Assinatura do Responsável Técnico */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pt-4 border-t border-slate-200 text-xs">
            <div className="space-y-1 text-slate-600">
              <p>
                Total de itens conferidos:{" "}
                <strong className="text-slate-900">{totalItens}</strong>
              </p>
              <p>
                Volume físico total abastecido:{" "}
                <strong className="text-slate-900">
                  {totalUnidades} unidades
                </strong>
              </p>
              <p>
                Conferido e recebido por:{" "}
                <strong className="text-slate-900">{recebedor}</strong>
              </p>
            </div>

            <div className="sm:w-64 text-center pt-6 border-t border-slate-400">
              <p className="font-semibold text-slate-800">{recebedor}</p>
              <p className="text-[11px] text-slate-500">
                Assinatura e Carimbo do Responsável Técnico
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
          >
            <Printer className="w-4 h-4" aria-hidden="true" />
            <span>Imprimir Comprovante</span>
          </button>
        </div>
      </div>
    </div>
  );
};
