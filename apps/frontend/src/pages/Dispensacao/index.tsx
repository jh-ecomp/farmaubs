import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  normalizarDataParaIso,
  type MedicamentoBuscaDto,
} from "@farmaubs/shared";
import {
  DispensacaoProvider,
  useDispensacao,
} from "../../contexts/DispensacaoContext";
import { dispensacaoService } from "../../services/dispensacao.service";
import { IdentificacaoPacienteForm } from "../../components/dispensacao/IdentificacaoPacienteForm";
import { BuscaMedicamentoInput } from "../../components/dispensacao/BuscaMedicamentoInput";
import { SeletorLoteFefo } from "../../components/dispensacao/SeletorLoteFefo";
import { CarrinhoReceita } from "../../components/dispensacao/CarrinhoReceita";
import { CardsMetricasDispensacao } from "../../components/dispensacao/CardsMetricasDispensacao";
import { ModalConfirmacaoDispensacao } from "../../components/dispensacao/ModalConfirmacaoDispensacao";
import { HistoricoDispensacoes } from "./HistoricoDispensacoes";

type AbaModuloDispensacao = "ATENDIMENTO" | "HISTORICO";

function ConteudoTelaDispensacao() {
  let queryClient: ReturnType<typeof useQueryClient> | null = null;
  try {
    queryClient = useQueryClient();
  } catch {
    // Permite execução resiliente em testes isolados sem QueryClientProvider
  }

  const {
    paciente,
    itens,
    receitaEmissaoEm,
    contemAntimicrobiano,
    podeFinalizarAtendimento,
    definirPaciente,
    adicionarItem,
    atualizarQuantidadeItem,
    atualizarPosologiaItem,
    removerItem,
    definirReceitaEmissaoEm,
    limparAtendimento,
  } = useDispensacao();

  const [abaAtiva, setAbaAtiva] = useState<AbaModuloDispensacao>("ATENDIMENTO");
  const [medicamentoEmSelecao, setMedicamentoEmSelecao] =
    useState<MedicamentoBuscaDto | null>(null);
  const [modalConfirmacaoAberto, setModalConfirmacaoAberto] = useState(false);
  const [processandoBaixa, setProcessandoBaixa] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);

  const [metricasDia, setMetricasDia] = useState({
    totalAtendimentosHoje: 0,
    totalUnidadesHoje: 0,
    totalPacientesHoje: 0,
  });

  const [notificacao, setNotificacao] = useState<{
    tipo: "sucesso" | "erro";
    mensagem: string;
  } | null>(null);

  const handleConfirmarBaixaEstoque = async () => {
    if (!paciente || itens.length === 0) return;

    setProcessandoBaixa(true);
    setNotificacao(null);

    try {
      const receitaIso = contemAntimicrobiano
        ? normalizarDataParaIso(receitaEmissaoEm) || receitaEmissaoEm
        : undefined;

      const resultado = await dispensacaoService.efetivarDispensacao({
        paciente,
        receitaEmissaoEm: receitaIso,
        itens: itens.map((item) => ({
          medicamentoId: item.medicamento.id,
          loteId: item.lote.id,
          quantidadeDispensada: item.quantidadeDispensada,
          posologia: item.posologia || undefined,
        })),
      });

      const unidadesDispensadas = itens.reduce(
        (acc, i) => acc + i.quantidadeDispensada,
        0,
      );

      setMetricasDia((prev) => ({
        totalAtendimentosHoje: prev.totalAtendimentosHoje + 1,
        totalUnidadesHoje: prev.totalUnidadesHoje + unidadesDispensadas,
        totalPacientesHoje: prev.totalPacientesHoje + 1,
      }));

      if (queryClient) {
        void queryClient.invalidateQueries({ queryKey: ["estoque-saldos"] });
        void queryClient.invalidateQueries({ queryKey: ["ultimas-dispensas"] });
      }

      setModalConfirmacaoAberto(false);
      setMedicamentoEmSelecao(null);
      limparAtendimento();
      setResetSignal((s) => s + 1);

      setNotificacao({
        tipo: "sucesso",
        mensagem: `✅ Atendimento #${resultado.numeroAtendimento} finalizado com sucesso!`,
      });
    } catch (err) {
      setModalConfirmacaoAberto(false);
      setNotificacao({
        tipo: "erro",
        mensagem:
          err instanceof Error
            ? err.message
            : "Erro ao processar a baixa de estoque. Tente novamente.",
      });
    } finally {
      setProcessandoBaixa(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="pagina-dispensacao">
      {/* Cabeçalho Operacional Superior */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Dispensação de Medicamentos
          </h1>
          <p className="text-xs text-slate-500">
            Registre a entrega de medicamentos ao paciente e acompanhe os
            atendimentos da unidade
          </p>
        </div>

        {/* Abas de alternância entre Bancada de Atendimento e Histórico */}
        <div
          role="tablist"
          aria-label="Seções do módulo de dispensação"
          className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={abaAtiva === "ATENDIMENTO"}
            onClick={() => setAbaAtiva("ATENDIMENTO")}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${
              abaAtiva === "ATENDIMENTO"
                ? "bg-white text-blue-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Novo Atendimento
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={abaAtiva === "HISTORICO"}
            onClick={() => setAbaAtiva("HISTORICO")}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${
              abaAtiva === "HISTORICO"
                ? "bg-white text-blue-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Histórico de Atendimentos
          </button>
        </div>
      </div>

      {/* Cartões de métricas rápidas do dia */}
      <CardsMetricasDispensacao
        totalAtendimentosHoje={metricasDia.totalAtendimentosHoje}
        totalUnidadesHoje={metricasDia.totalUnidadesHoje}
        totalPacientesHoje={metricasDia.totalPacientesHoje}
      />

      {/* Toast de feedback instantâneo (Sucesso ou Erro de concorrência/rede) */}
      {notificacao && (
        <div
          role="alert"
          data-testid="toast-dispensacao"
          className={`rounded-xl border p-4 text-xs font-semibold flex items-center justify-between ${
            notificacao.tipo === "sucesso"
              ? "border-emerald-300 bg-emerald-50 text-emerald-950"
              : "border-red-300 bg-red-50 text-red-900"
          }`}
        >
          <span>{notificacao.mensagem}</span>
          <button
            type="button"
            onClick={() => setNotificacao(null)}
            className="text-xs underline ml-4"
          >
            Fechar
          </button>
        </div>
      )}

      {abaAtiva === "HISTORICO" ? (
        <HistoricoDispensacoes />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Coluna da Esquerda: Identificação do Paciente + Busca Textual e Seletor FEFO */}
          <div className="lg:col-span-7 space-y-5">
            <IdentificacaoPacienteForm
              exibirBotaoAvancar={false}
              resetSignal={resetSignal}
              onPacienteValidoChange={definirPaciente}
            />

            <section
              aria-label="Seleção de Medicamentos"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4"
            >
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-semibold text-slate-900">
                  2. Adicionar Medicamentos
                </h2>
                <p className="text-xs text-slate-500">
                  Busque pelo nome do medicamento ou princípio ativo para
                  incluir no atendimento
                </p>
              </div>

              <BuscaMedicamentoInput
                onSelecionarMedicamento={(med) => setMedicamentoEmSelecao(med)}
              />

              {medicamentoEmSelecao && (
                <SeletorLoteFefo
                  medicamento={medicamentoEmSelecao}
                  onAdicionarAoCarrinho={({
                    medicamento,
                    lote,
                    quantidade,
                    posologia,
                  }) => {
                    adicionarItem({
                      medicamento,
                      lote,
                      quantidade,
                      posologia,
                    });
                    setMedicamentoEmSelecao(null);
                  }}
                  onCancelarSelecao={() => setMedicamentoEmSelecao(null)}
                />
              )}
            </section>
          </div>

          {/* Coluna da Direita: Carrinho da Receita e Confirmação */}
          <div className="lg:col-span-5">
            <CarrinhoReceita
              itens={itens}
              receitaEmissaoEm={receitaEmissaoEm}
              onChangeReceitaEmissaoEm={definirReceitaEmissaoEm}
              onAlterarQuantidade={atualizarQuantidadeItem}
              onAlterarPosologia={atualizarPosologiaItem}
              onRemoverItem={removerItem}
              finalizarHabilitado={podeFinalizarAtendimento}
              onFinalizarAtendimento={() => setModalConfirmacaoAberto(true)}
            />
          </div>
        </div>
      )}

      {/* Modal Acessível de Confirmação e Baixa */}
      <ModalConfirmacaoDispensacao
        aberto={modalConfirmacaoAberto}
        paciente={paciente}
        itens={itens}
        receitaEmissaoEm={contemAntimicrobiano ? receitaEmissaoEm : undefined}
        processando={processandoBaixa}
        onConfirmarBaixa={handleConfirmarBaixaEstoque}
        onCancelar={() => setModalConfirmacaoAberto(false)}
      />
    </div>
  );
}

/**
 * [RF010 / NF001 / ADR-011]: Página principal do módulo de Dispensação de Medicamentos.
 */
export function Dispensacao() {
  return (
    <DispensacaoProvider>
      <ConteudoTelaDispensacao />
    </DispensacaoProvider>
  );
}

export default Dispensacao;
