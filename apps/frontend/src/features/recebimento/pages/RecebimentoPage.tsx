import React, { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  CabecalhoRecebimentoDto,
  ItemRecebimentoFormDto,
} from "@farmaubs/shared";
import { CabecalhoRecebimentoForm } from "../components/CabecalhoRecebimentoForm";
import { ItemRecebimentoForm } from "../components/ItemRecebimentoForm";
import { ModalConfirmacaoRecebimento } from "../components/ModalConfirmacaoRecebimento";
import { HistoricoRecebimentosPainel } from "../components/HistoricoRecebimentosPainel";
import { recebimentoService } from "../../../services/recebimento.service";
import {
  Truck,
  History,
  PlusCircle,
  Trash2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Package,
} from "lucide-react";

export interface RecebimentoPageProps {
  cabecalhoInicial?: Partial<CabecalhoRecebimentoDto>;
  itensIniciais?: ItemRecebimentoFormDto[];
  abaInicial?: "NOVA_ENTRADA" | "HISTORICO";
}

/**
 * Página principal do módulo de Recebimento de Medicamentos e Abastecimento de Estoque da UBS.
 * Orquestra o cabeçalho da guia, a adição de itens/lotes, a confirmação transacional e o histórico.
 */
export const RecebimentoPage: React.FC<RecebimentoPageProps> = ({
  cabecalhoInicial,
  itensIniciais = [],
  abaInicial = "NOVA_ENTRADA",
}) => {
  const queryClient = useQueryClient();

  const [abaAtiva, setAbaAtiva] = useState<"NOVA_ENTRADA" | "HISTORICO">(
    abaInicial,
  );

  const [cabecalho, setCabecalho] = useState<CabecalhoRecebimentoDto>({
    numeroDocumento: cabecalhoInicial?.numeroDocumento ?? "",
    tipoDocumento: cabecalhoInicial?.tipoDocumento ?? "GUIA_CAF",
    fornecedorOrigem:
      cabecalhoInicial?.fornecedorOrigem ?? "CAF Central - SMS Parnaíba",
    dataRecebimento:
      cabecalhoInicial?.dataRecebimento ??
      new Date().toISOString().slice(0, 16),
    observacoes: cabecalhoInicial?.observacoes,
  });

  const [cabecalhoValido, setCabecalhoValido] = useState<boolean>(
    Boolean(
      cabecalhoInicial?.numeroDocumento &&
        cabecalhoInicial.numeroDocumento.trim().length >= 2,
    ),
  );
  const [resetSignal, setResetSignal] = useState(0);

  const [itensGuia, setItensGuia] =
    useState<ItemRecebimentoFormDto[]>(itensIniciais);
  const [modalConfirmacaoAberto, setModalConfirmacaoAberto] = useState(false);
  const [submetendo, setSubmetendo] = useState(false);
  const [toastSucesso, setToastSucesso] = useState<string | null>(null);
  const [erroSubmissao, setErroSubmissao] = useState<string | null>(null);

  const handleCabecalhoChange = useCallback(
    (dados: CabecalhoRecebimentoDto, valido: boolean) => {
      setCabecalho(dados);
      setCabecalhoValido(valido);
    },
    [],
  );

  const handleAdicionarItem = useCallback((novoItem: ItemRecebimentoFormDto) => {
    setItensGuia((prev) => [...prev, novoItem]);
    setErroSubmissao(null);
    setToastSucesso(null);
  }, []);

  const handleRemoverItem = useCallback((idProvisorio: string) => {
    setItensGuia((prev) =>
      prev.filter((item) => item.idProvisorio !== idProvisorio),
    );
  }, []);

  // Totalizadores em tempo real
  const totalMedicamentosDistintos = new Set(
    itensGuia.map((i) => i.produtoId),
  ).size;
  const totalUnidadesFisicas = itensGuia.reduce(
    (acc, item) => acc + item.quantidadeRecebida,
    0,
  );

  const podeConfirmarEntrada =
    cabecalhoValido && itensGuia.length > 0 && !submetendo;

  const handleEfetivarEntrada = async () => {
    if (!podeConfirmarEntrada) return;

    setSubmetendo(true);
    setErroSubmissao(null);

    try {
      await recebimentoService.efetivarEntrada({
        numeroDocumento: cabecalho.numeroDocumento.trim(),
        tipoDocumento: cabecalho.tipoDocumento,
        fornecedorOrigem: cabecalho.fornecedorOrigem,
        dataRecebimento: cabecalho.dataRecebimento,
        observacoes: cabecalho.observacoes || null,
        itens: itensGuia.map((item) => ({
          produtoId: item.produtoId,
          fabricanteId: item.fabricanteId,
          numeroLote: item.numeroLote,
          dataValidade: item.dataValidade,
          quantidadeRecebida: item.quantidadeRecebida,
        })),
      });

      // Invalida os caches de estoque e histórico para sincronização imediata
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["estoque-atual"] }),
        queryClient.invalidateQueries({ queryKey: ["ultimos-recebimentos"] }),
      ]);

      setModalConfirmacaoAberto(false);
      setItensGuia([]);
      setResetSignal((s) => s + 1);
      setToastSucesso(
        "Entrada registrada! O estoque da UBS foi abastecido com sucesso.",
      );
      setAbaAtiva("HISTORICO");
    } catch (err) {
      setModalConfirmacaoAberto(false);
      const mensagem =
        err instanceof Error && err.message && err.message !== "Network error"
          ? err.message
          : "Falha ao registrar entrada. Verifique sua conexão e tente novamente.";
      setErroSubmissao(mensagem);
    } finally {
      setSubmetendo(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Cabeçalho da Página */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-700 text-white shadow-xs">
            <Truck className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Recebimento de Medicamentos e Abastecimento
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              Registre guias da CAF, notas fiscais e confira os lotes recebidos pela farmácia da UBS
            </p>
          </div>
        </div>

        {/* Abas de Navegação */}
        <div
          role="tablist"
          aria-label="Seções de recebimento"
          className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200"
        >
          <button
            type="button"
            role="tab"
            aria-selected={abaAtiva === "NOVA_ENTRADA"}
            onClick={() => setAbaAtiva("NOVA_ENTRADA")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              abaAtiva === "NOVA_ENTRADA"
                ? "bg-white text-teal-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <PlusCircle className="w-4 h-4" aria-hidden="true" />
            <span>Nova Entrada de Medicamentos</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={abaAtiva === "HISTORICO"}
            onClick={() => setAbaAtiva("HISTORICO")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              abaAtiva === "HISTORICO"
                ? "bg-white text-teal-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <History className="w-4 h-4" aria-hidden="true" />
            <span>Últimos Recebimentos</span>
          </button>
        </div>
      </header>

      {/* Toast / Alerta de Sucesso */}
      {toastSucesso && (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-900 shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2
              className="w-5 h-5 text-emerald-600 shrink-0"
              aria-hidden="true"
            />
            <span>{toastSucesso}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastSucesso(null)}
            className="text-xs font-semibold text-emerald-800 hover:underline ml-4"
          >
            Dispensar aviso
          </button>
        </div>
      )}

      {/* Alerta de Erro de Rede / Servidor */}
      {erroSubmissao && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-800 shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle
              className="w-5 h-5 text-red-600 shrink-0"
              aria-hidden="true"
            />
            <span>{erroSubmissao}</span>
          </div>
          <button
            type="button"
            onClick={() => setErroSubmissao(null)}
            className="text-xs font-semibold text-red-800 hover:underline ml-4"
          >
            Fechar
          </button>
        </div>
      )}

      {abaAtiva === "NOVA_ENTRADA" ? (
        <div className="space-y-6">
          {/* Passo 1: Cabeçalho da Guia */}
          <CabecalhoRecebimentoForm
            valoresIniciais={cabecalhoInicial}
            onChange={handleCabecalhoChange}
            resetSignal={resetSignal}
          />

          {/* Passo 2: Formulário de Adição de Item */}
          <ItemRecebimentoForm onAdicionarItem={handleAdicionarItem} />

          {/* Passo 3: Tabela Provisória de Itens Adicionados e Confirmação */}
          <section
            aria-labelledby="titulo-itens-provisorios-guia"
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-teal-50 text-teal-700">
                  <Package className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h2
                    id="titulo-itens-provisorios-guia"
                    className="text-base font-semibold text-slate-900"
                  >
                    Itens Conferidos na Guia
                  </h2>
                  <p className="text-xs text-slate-500">
                    Revise os lotes abaixo antes de confirmar o abastecimento no estoque da UBS.
                  </p>
                </div>
              </div>

              {/* Totalizadores em Tempo Real */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800">
                  {totalMedicamentosDistintos} medicamentos distintos
                </span>
                <span className="inline-flex items-center rounded-lg bg-teal-50 border border-teal-200 px-3 py-1.5 text-xs font-semibold text-teal-800">
                  {totalUnidadesFisicas} unidades físicas a ingressar
                </span>
              </div>
            </div>

            {itensGuia.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-500">
                Nenhum lote incluído nesta guia ainda. Utilize o formulário acima para adicionar os medicamentos recebidos.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-3.5 py-2.5 font-semibold">
                        Medicamento
                      </th>
                      <th className="px-3.5 py-2.5 font-semibold">
                        Fabricante
                      </th>
                      <th className="px-3.5 py-2.5 font-semibold">Lote</th>
                      <th className="px-3.5 py-2.5 font-semibold">Validade</th>
                      <th className="px-3.5 py-2.5 font-semibold text-right">
                        Quantidade
                      </th>
                      <th className="px-3.5 py-2.5 font-semibold text-right">
                        Ação
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {itensGuia.map((item) => (
                      <tr key={item.idProvisorio} className="hover:bg-slate-50">
                        <td className="px-3.5 py-3 font-medium text-slate-900">
                          {item.produtoNome} {item.concentracao}
                          <span className="block text-[11px] text-slate-500">
                            {item.formaFarmaceutica}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 text-slate-700">
                          {item.fabricanteNome}
                        </td>
                        <td className="px-3.5 py-3 font-mono font-semibold text-slate-800">
                          {item.numeroLote}
                        </td>
                        <td className="px-3.5 py-3">
                          <span className="text-slate-800">
                            {item.dataValidade.split("-").reverse().join("/")}
                          </span>
                          {item.validadeCurta && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                              <AlertTriangle className="w-3 h-3" />
                              Validade curta
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-3 text-right font-semibold text-slate-900">
                          {item.quantidadeRecebida} un.
                        </td>
                        <td className="px-3.5 py-3 text-right">
                          <button
                            type="button"
                            aria-label={`Remover item ${item.produtoNome}`}
                            onClick={() => handleRemoverItem(item.idProvisorio)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remover</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                disabled={!podeConfirmarEntrada}
                onClick={() => setModalConfirmacaoAberto(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                <span>Confirmar Entrada no Estoque</span>
              </button>
            </div>
          </section>
        </div>
      ) : (
        <HistoricoRecebimentosPainel />
      )}

      {/* Modal de Revisão e Confirmação Final */}
      <ModalConfirmacaoRecebimento
        aberto={modalConfirmacaoAberto}
        cabecalho={cabecalho}
        itens={itensGuia}
        submetendo={submetendo}
        onFechar={() => setModalConfirmacaoAberto(false)}
        onConfirmar={handleEfetivarEntrada}
      />
    </div>
  );
};
