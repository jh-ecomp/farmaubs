import React, { useEffect, useRef, useState } from "react";
import type {
  LoteEstoqueDto,
  MedicamentoSaldoItemDto,
  MovimentacaoLoteItemDto,
  RastreabilidadeLoteDto,
  TipoMovimentacaoEstoque,
} from "@farmaubs/shared";
import { estoqueService } from "../../../services/estoque.service";

export interface ModalFichaRastreabilidadeProps {
  aberto: boolean;
  lote: LoteEstoqueDto | null;
  medicamento: MedicamentoSaldoItemDto | null;
  onFechar: () => void;
  dadosIniciais?: RastreabilidadeLoteDto | null;
}

const ROTULOS_TIPO_MOVIMENTACAO: Record<
  TipoMovimentacaoEstoque,
  { rotulo: string; classesBadge: string; icone: string }
> = {
  ENTRADA_RECEBIMENTO: {
    rotulo: "Entrada de Recebimento",
    classesBadge: "border border-emerald-200 bg-emerald-100 text-emerald-900",
    icone: "move_to_inbox",
  },
  SAIDA_DISPENSACAO: {
    rotulo: "Saída por Dispensação",
    classesBadge: "border border-blue-200 bg-blue-100 text-blue-900",
    icone: "medication",
  },
  AJUSTE_ENTRADA: {
    rotulo: "Ajuste Manual (+)",
    classesBadge: "border border-emerald-300 bg-emerald-50 text-emerald-900",
    icone: "add_circle",
  },
  AJUSTE_SAIDA: {
    rotulo: "Ajuste Manual (-)",
    classesBadge: "border border-rose-200 bg-rose-100 text-rose-900",
    icone: "remove_circle",
  },
  ESTORNO_ENTRADA: {
    rotulo: "Estorno de Recebimento",
    classesBadge: "border border-amber-300 bg-amber-100 text-amber-900",
    icone: "undo",
  },
  ESTORNO_DISPENSACAO: {
    rotulo: "Estorno de Dispensação",
    classesBadge: "border border-cyan-200 bg-cyan-100 text-cyan-900",
    icone: "restore",
  },
};

function formatarDataPtBr(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate || "");
  if (!match) return isoDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatarDataHoraPtBr(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * [ES-09 / ES-04 / RF028 / ADR-032]: Modal acessível de Ficha de Rastreabilidade e Linha do Tempo do Lote.
 * Apresenta o histórico cronológico completo de entradas, dispensas, ajustes e estornos do lote físico.
 */
export const ModalFichaRastreabilidade: React.FC<
  ModalFichaRastreabilidadeProps
> = ({ aberto, lote, medicamento, onFechar, dadosIniciais }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [dados, setDados] = useState<RastreabilidadeLoteDto | null>(
    dadosIniciais ?? null,
  );
  const [carregando, setCarregando] = useState<boolean>(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto || !lote) return;

    if (dadosIniciais) {
      setDados(dadosIniciais);
      setCarregando(false);
      setErro(null);
      return;
    }

    let cancelado = false;
    setCarregando(true);
    setErro(null);

    estoqueService
      .consultarRastreabilidadeLote(lote.id)
      .then((res) => {
        if (!cancelado) {
          setDados(res);
        }
      })
      .catch((err: unknown) => {
        if (!cancelado) {
          setErro(
            err instanceof Error
              ? err.message
              : "Não foi possível carregar a ficha de rastreabilidade.",
          );
        }
      })
      .finally(() => {
        if (!cancelado) {
          setCarregando(false);
        }
      });

    return () => {
      cancelado = true;
    };
  }, [aberto, lote, dadosIniciais]);

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
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

  const nomeMedicamento =
    dados?.medicamento.nome ?? medicamento?.nome ?? "Medicamento";
  const apresentacaoMedicamento =
    dados?.medicamento.apresentacao ??
    (medicamento
      ? `${medicamento.concentracao} • ${medicamento.formaFarmaceutica}`
      : "");
  const numeroLote = dados?.lote.numeroLote ?? lote.numeroLote;
  const fabricanteNome = dados?.lote.fabricanteNome ?? lote.fabricanteNome;
  const dataValidade = dados?.lote.dataValidade ?? lote.dataValidade;
  const saldoAtual = dados?.lote.saldoAtual ?? lote.saldoAtual;
  const saldoInicial = dados?.lote.saldoInicial ?? saldoAtual;
  const movimentacoes: MovimentacaoLoteItemDto[] = dados?.movimentacoes ?? [];

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
        aria-labelledby="modal-rastreabilidade-titulo"
        data-testid="modal-ficha-rastreabilidade"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-800"
              aria-hidden="true"
            >
              <span className="material-symbols-outlined text-xl">history</span>
            </span>
            <div>
              <h2
                id="modal-rastreabilidade-titulo"
                className="text-base font-bold text-slate-900"
              >
                Ficha de Rastreabilidade do Lote • SUS
              </h2>
              <p className="text-xs text-slate-600">
                Livro-razão imutável e linha do tempo de movimentações (RF028)
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Fechar ficha de rastreabilidade"
            data-testid="btn-fechar-modal-rastreabilidade"
            onClick={onFechar}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Cartão de Metadados do Lote */}
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs sm:grid-cols-4">
          <div className="col-span-2">
            <span className="block text-[11px] font-semibold text-slate-600 uppercase">
              Medicamento
            </span>
            <strong className="text-sm text-slate-900">
              {nomeMedicamento}
            </strong>
            {apresentacaoMedicamento && (
              <span className="block text-slate-600">
                {apresentacaoMedicamento}
              </span>
            )}
          </div>
          <div>
            <span className="block text-[11px] font-semibold text-slate-600 uppercase">
              Código do Lote
            </span>
            <strong
              data-testid="rastreabilidade-numero-lote"
              className="font-mono text-sm text-slate-900"
            >
              {numeroLote}
            </strong>
            <span className="block text-slate-600">{fabricanteNome}</span>
          </div>
          <div>
            <span className="block text-[11px] font-semibold text-slate-600 uppercase">
              Validade &amp; Saldo
            </span>
            <strong className="text-sm text-slate-900">
              {formatarDataPtBr(dataValidade)}
            </strong>
            <span
              data-testid="rastreabilidade-saldo-atual"
              className="block font-bold text-blue-900"
            >
              Saldo: {saldoAtual} (Inicial: {saldoInicial})
            </span>
          </div>
        </div>

        {/* Corpo / Linha do Tempo */}
        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          {carregando ? (
            <div
              role="status"
              aria-busy="true"
              data-testid="rastreabilidade-carregando"
              className="space-y-3 py-6"
            >
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-lg border border-slate-200 p-3"
                >
                  <div className="mb-2 h-4 w-1/3 rounded bg-slate-200" />
                  <div className="h-3 w-2/3 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : erro ? (
            <div
              role="alert"
              data-testid="rastreabilidade-erro"
              className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-center text-xs font-semibold text-rose-800"
            >
              {erro}
            </div>
          ) : movimentacoes.length === 0 ? (
            <div
              data-testid="rastreabilidade-vazia"
              className="py-8 text-center text-xs text-slate-600"
            >
              Nenhuma movimentação registrada para este lote até o momento.
            </div>
          ) : (
            <ol
              aria-label="Linha do tempo de movimentações do lote"
              data-testid="lista-movimentacoes-lote"
              className="relative ml-3 space-y-3 border-l-2 border-slate-200 pl-4"
            >
              {movimentacoes.map((mov) => {
                const cfg = ROTULOS_TIPO_MOVIMENTACAO[mov.tipoMovimentacao] ?? {
                  rotulo: mov.tipoMovimentacao,
                  classesBadge: "border border-slate-200 bg-slate-100 text-slate-800",
                  icone: "swap_vert",
                };
                const isPositivo = mov.operacao === "+";

                return (
                  <li
                    key={mov.id}
                    data-testid={`item-movimentacao-${mov.id}`}
                    className="relative rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-2xs"
                  >
                    <span
                      className={`absolute top-3.5 -left-[23px] flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white ${
                        isPositivo ? "bg-emerald-600" : "bg-rose-600"
                      }`}
                      aria-hidden="true"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${cfg.classesBadge}`}
                        >
                          <span
                            className="material-symbols-outlined text-xs"
                            aria-hidden="true"
                          >
                            {cfg.icone}
                          </span>
                          {cfg.rotulo}
                        </span>
                        <span className="text-slate-600">
                          {formatarDataHoraPtBr(mov.dataHora)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold ${
                            isPositivo ? "text-emerald-800" : "text-rose-800"
                          }`}
                        >
                          {mov.operacao}
                          {mov.quantidade}
                        </span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-800">
                          Saldo: {mov.saldoResultante}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-slate-600">
                      <span>
                        Responsável:{" "}
                        <strong className="text-slate-800">
                          {mov.usuarioResponsavel.nome}
                        </strong>
                      </span>
                      {mov.documentoReferencia && (
                        <span>
                          Doc:{" "}
                          <strong className="font-mono text-slate-800">
                            {mov.documentoReferencia}
                          </strong>
                        </span>
                      )}
                    </div>

                    {(mov.motivo || mov.justificativa) && (
                      <div className="mt-1.5 rounded bg-slate-50 p-2 text-slate-700">
                        {mov.motivo && (
                          <span className="mr-1 font-bold text-slate-900">
                            [{mov.motivo}]
                          </span>
                        )}
                        {mov.justificativa && <span>{mov.justificativa}</span>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Rodapé */}
        <div className="mt-4 flex justify-end border-t border-slate-200 pt-3">
          <button
            type="button"
            data-testid="btn-concluir-rastreabilidade"
            onClick={onFechar}
            className="rounded-lg bg-blue-800 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-900"
          >
            Fechar Ficha
          </button>
        </div>
      </div>
    </div>
  );
};
