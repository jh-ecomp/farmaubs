import {
  calcularTotaisCarrinho,
  formatarDataIsoParaBr,
  normalizarDataParaIso,
  validarReceitaAntimicrobiano,
} from "@farmaubs/shared";
import type { ItemCarrinhoDispensacao } from "../../contexts/DispensacaoContext";
import { ValidacaoReceitaAntimicrobiano } from "./ValidacaoReceitaAntimicrobiano";

export interface CarrinhoReceitaProps {
  itens: ItemCarrinhoDispensacao[];
  receitaEmissaoEm: string;
  onChangeReceitaEmissaoEm: (data: string) => void;
  onAlterarQuantidade: (
    medicamentoId: string,
    loteId: string,
    quantidade: number,
  ) => void;
  onAlterarPosologia: (
    medicamentoId: string,
    loteId: string,
    posologia: string,
  ) => void;
  onRemoverItem: (medicamentoId: string, loteId: string) => void;
  onFinalizarAtendimento?: () => void;
  finalizarHabilitado?: boolean;
  dataReferencia?: Date;
}

/**
 * [RF010 / NF001 / ADR-032]: Lista de atendimento (carrinho da receita) com suporte a múltiplos medicamentos,
 * ajuste rápido de quantidades, campo de posologia por item, validação de antimicrobianos e totalizadores.
 */
export function CarrinhoReceita({
  itens,
  receitaEmissaoEm,
  onChangeReceitaEmissaoEm,
  onAlterarQuantidade,
  onAlterarPosologia,
  onRemoverItem,
  onFinalizarAtendimento,
  finalizarHabilitado,
  dataReferencia,
}: CarrinhoReceitaProps) {
  const contemAntimicrobiano = itens.some(
    (i) => i.medicamento.antimicrobiano || i.medicamento.requerDataReceita,
  );

  const isoReceita =
    normalizarDataParaIso(receitaEmissaoEm) || receitaEmissaoEm;
  const validacaoReceita = validarReceitaAntimicrobiano(
    isoReceita,
    contemAntimicrobiano,
    dataReferencia ?? new Date(),
  );

  const totais = calcularTotaisCarrinho(itens);

  const podeProsseguir =
    typeof finalizarHabilitado === "boolean"
      ? finalizarHabilitado && validacaoReceita.valida && itens.length > 0
      : itens.length > 0 && validacaoReceita.valida;

  return (
    <section
      aria-label="Carrinho da Receita Médica"
      data-testid="carrinho-receita"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 flex flex-col justify-between"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Medicamentos do Atendimento
            </h2>
            <p className="text-xs text-slate-500">
              Confira os itens, quantidades e orientações de uso antes de
              concluir
            </p>
          </div>
          <span
            data-testid="badge-total-itens"
            className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800"
          >
            {totais.totalItens} {totais.totalItens === 1 ? "item" : "itens"}
          </span>
        </div>

        {itens.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center">
            <p className="text-sm font-medium text-slate-600">
              Nenhum medicamento adicionado à receita.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Use o campo de busca ao lado para procurar e incluir os
              medicamentos prescritos.
            </p>
          </div>
        ) : (
          <div className="space-y-3" role="list" aria-label="Itens no carrinho">
            {itens.map((item) => {
              const chave = `${item.medicamento.id}-${item.lote.id}`;
              const nomeExibicao = `${item.medicamento.principioAtivo}${
                item.medicamento.apresentacao
                  ? ` - ${item.medicamento.apresentacao}`
                  : ""
              }`;

              return (
                <div
                  key={chave}
                  role="listitem"
                  data-testid={`linha-carrinho-${item.medicamento.id}`}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">
                          {nomeExibicao}
                        </span>
                        {item.medicamento.antimicrobiano && (
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800 border border-blue-200">
                            Antimicrobiano
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Lote: <strong>{item.lote.numeroLote}</strong> | Validade:{" "}
                        <strong>
                          {formatarDataIsoParaBr(item.lote.dataValidade)}
                        </strong>{" "}
                        | Saldo máx.: {item.lote.saldoDisponivel} un.
                      </p>
                    </div>

                    <button
                      type="button"
                      aria-label={`Remover ${nomeExibicao} do carrinho`}
                      onClick={() =>
                        onRemoverItem(item.medicamento.id, item.lote.id)
                      }
                      className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      Remover
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                    {/* Controle de quantidade */}
                    <div>
                      <label
                        htmlFor={`qtd-item-${chave}`}
                        className="block text-[11px] font-semibold text-slate-700 mb-1"
                      >
                        Quantidade
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Diminuir quantidade de ${nomeExibicao}`}
                          onClick={() =>
                            onAlterarQuantidade(
                              item.medicamento.id,
                              item.lote.id,
                              Math.max(1, item.quantidadeDispensada - 1),
                            )
                          }
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                        >
                          -
                        </button>
                        <input
                          id={`qtd-item-${chave}`}
                          type="number"
                          min={1}
                          max={item.lote.saldoDisponivel}
                          value={item.quantidadeDispensada}
                          onChange={(e) =>
                            onAlterarQuantidade(
                              item.medicamento.id,
                              item.lote.id,
                              parseInt(e.target.value, 10) || 1,
                            )
                          }
                          className="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-center text-xs font-semibold text-slate-900"
                        />
                        <button
                          type="button"
                          aria-label={`Aumentar quantidade de ${nomeExibicao}`}
                          onClick={() =>
                            onAlterarQuantidade(
                              item.medicamento.id,
                              item.lote.id,
                              Math.min(
                                item.lote.saldoDisponivel,
                                item.quantidadeDispensada + 1,
                              ),
                            )
                          }
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Posologia */}
                    <div className="sm:col-span-2">
                      <label
                        htmlFor={`posologia-item-${chave}`}
                        className="block text-[11px] font-semibold text-slate-700 mb-1"
                      >
                        Posologia Recomendada
                      </label>
                      <input
                        id={`posologia-item-${chave}`}
                        type="text"
                        placeholder="Ex.: 1 comprimido de 12 em 12 horas por 7 dias"
                        value={item.posologia}
                        onChange={(e) =>
                          onAlterarPosologia(
                            item.medicamento.id,
                            item.lote.id,
                            e.target.value,
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Validação obrigatória de receita de antimicrobianos (RDC 20/2011 - 10 dias) */}
        <ValidacaoReceitaAntimicrobiano
          visivel={contemAntimicrobiano}
          dataEmissao={receitaEmissaoEm}
          onChangeDataEmissao={onChangeReceitaEmissaoEm}
          dataReferencia={dataReferencia}
          validacaoExterna={validacaoReceita}
        />
      </div>

      {/* Sumário Inferior e Ação de Finalização */}
      <div className="border-t border-slate-200 pt-4 mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs text-slate-700">
          <div>
            Itens distintos:{" "}
            <strong
              data-testid="totalizador-itens"
              className="text-sm font-bold text-slate-900"
            >
              {totais.totalItens}
            </strong>
          </div>
          <div>
            Total de unidades:{" "}
            <strong
              data-testid="totalizador-unidades"
              className="text-sm font-bold text-blue-800"
            >
              {totais.totalUnidades}
            </strong>
          </div>
        </div>

        {onFinalizarAtendimento && (
          <button
            type="button"
            disabled={!podeProsseguir}
            onClick={onFinalizarAtendimento}
            className="rounded-lg bg-blue-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Finalizar Atendimento
          </button>
        )}
      </div>
    </section>
  );
}

export default CarrinhoReceita;
