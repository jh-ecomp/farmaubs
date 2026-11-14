import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Dispensacao } from "./index";
import { pacienteService } from "../../services/paciente.service";
import { catalogoDispensacaoService } from "../../services/catalogo-dispensacao.service";
import { dispensacaoService } from "../../services/dispensacao.service";

vi.mock("../../services/paciente.service", () => ({
  pacienteService: {
    buscarPacientes: vi.fn(),
    consultarHistorico: vi.fn(),
    cadastrarPaciente: vi.fn(),
  },
}));

vi.mock("../../services/catalogo-dispensacao.service", () => ({
  catalogoDispensacaoService: {
    buscarMedicamentos: vi.fn(),
    obterLotesFefo: vi.fn(),
  },
}));

vi.mock("../../services/dispensacao.service", () => ({
  dispensacaoService: {
    efetivarDispensacao: vi.fn(),
    listarDispensacoes: vi.fn(),
    exportarDispensacoesXlsx: vi.fn(),
    estornarDispensacao: vi.fn(),
  },
}));

describe("Funcionalidade: Fluxo Completo da Tela Principal de Dispensação (Camada D - DI-09)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(pacienteService.buscarPacientes).mockResolvedValue([]);
    vi.mocked(catalogoDispensacaoService.buscarMedicamentos).mockResolvedValue([
      {
        id: "med-losartana",
        principioAtivo: "Losartana Potássica",
        apresentacao: "50mg Comprimido",
        categoria: "BASICO",
        antimicrobiano: false,
        saldoTotalUbs: 120,
      },
    ]);
    vi.mocked(catalogoDispensacaoService.obterLotesFefo).mockResolvedValue({
      medicamento: {
        id: "med-losartana",
        principioAtivo: "Losartana Potássica",
        apresentacao: "50mg Comprimido",
        categoria: "BASICO",
        antimicrobiano: false,
        saldoTotalUbs: 120,
      },
      loteSugerido: {
        id: "lote-los-1",
        numeroLote: "LOT-2026-X",
        dataValidade: "2026-11-15",
        saldoDisponivel: 120,
        sugeridoFefo: true,
        diasParaVencimento: 40,
        alertaValidadeCurta: false,
        vencido: false,
      },
      lotesDisponiveis: [
        {
          id: "lote-los-1",
          numeroLote: "LOT-2026-X",
          dataValidade: "2026-11-15",
          saldoDisponivel: 120,
          sugeridoFefo: true,
          diasParaVencimento: 40,
          alertaValidadeCurta: false,
          vencido: false,
        },
      ],
    });
  });

  it("Cenários: Habilitação do botão de finalizar, confirmação no modal e limpeza da tela após gravação (201 Created)", async () => {
    const user = userEvent.setup();

    vi.mocked(dispensacaoService.efetivarDispensacao).mockResolvedValue({
      id: "disp-999",
      numeroAtendimento: "ATD-2026-0999",
      dataAtendimento: "2026-11-01T15:00:00Z",
      status: "concluida",
      paciente: {
        id: "pac-1",
        nomeCompleto: "Ana Paula Mendes",
        cpf: "12345678909",
        cns: "700001122334455",
      },
      dispensador: {
        id: "usr-farma",
        nomeCompleto: "Farmacêutico UBS",
      },
      itens: [
        {
          itemId: "item-1",
          medicamentoId: "med-losartana",
          medicamentoNome: "Losartana Potássica - 50mg Comprimido",
          loteId: "lote-los-1",
          numeroLote: "LOT-2026-X",
          quantidadeDispensada: 30,
          saldoRestanteLote: 90,
        },
      ],
    });

    render(<Dispensacao />);

    const botaoFinalizar = screen.getByRole("button", {
      name: /Finalizar Atendimento/i,
    });
    expect(botaoFinalizar).toBeDisabled();

    // 1. Preenche os 4 dados obrigatórios do paciente
    await user.type(screen.getByLabelText(/CPF/i), "12345678909");
    await user.type(
      screen.getByLabelText(/Cartão Nacional de Saúde/i),
      "700001122334455",
    );
    await user.type(screen.getByLabelText(/Nome Completo/i), "Ana Paula Mendes");
    await user.type(screen.getByLabelText(/Data de Nascimento/i), "10041985");

    // 2. Busca e adiciona 1 medicamento válido com lote FEFO ao carrinho
    const inputBuscaMed = screen.getByRole("combobox");
    await user.type(inputBuscaMed, "losartana");

    const opcaoMed = await screen.findByRole("option", {
      name: /Losartana Potássica - 50mg Comprimido/i,
    });
    await user.click(opcaoMed);

    // Aguarda carregamento do seletor FEFO e clica em "+30" ou adiciona
    const botaoAdicionarAoCarrinho = await screen.findByRole("button", {
      name: /Adicionar ao Atendimento/i,
    });
    await user.click(botaoAdicionarAoCarrinho);

    // O botão "Finalizar Atendimento" deve se tornar clicável
    await waitFor(() => {
      expect(botaoFinalizar).not.toBeDisabled();
    });

    // 3. Clica em "Finalizar Atendimento" -> abre modal de confirmação
    await user.click(botaoFinalizar);

    const modal = await screen.findByTestId("modal-confirmacao-dispensacao");
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveTextContent(/Ana Paula Mendes/i);
    expect(modal).toHaveTextContent(/LOT-2026-X/i);

    // 4. Clica em "Confirmar Baixa de Estoque"
    const botaoConfirmarBaixa = screen.getByRole("button", {
      name: /Confirmar Baixa de Estoque/i,
    });
    await user.click(botaoConfirmarBaixa);

    await waitFor(() => {
      expect(dispensacaoService.efetivarDispensacao).toHaveBeenCalledTimes(1);
    });

    // 5. Exibe mensagem de sucesso e reseta os campos do paciente e o carrinho
    const toast = await screen.findByTestId("toast-dispensacao");
    expect(toast).toHaveTextContent(
      /Atendimento #ATD-2026-0999 finalizado com sucesso!/i,
    );

    expect(
      (screen.getByLabelText(/Nome Completo/i) as HTMLInputElement).value,
    ).toBe("");
    expect(
      screen.getByText(/Nenhum medicamento adicionado à receita/i),
    ).toBeInTheDocument();
  });

  it("Cenário: Carrega os indicadores do dia a partir do histórico de dispensações ao montar a tela", async () => {
    const hojeIso = new Date().toISOString();
    vi.mocked(dispensacaoService.listarDispensacoes).mockResolvedValue({
      itens: [
        {
          id: "disp-1",
          numeroAtendimento: "ATD-2026-0001",
          dataAtendimento: hojeIso,
          status: "concluida",
          pacienteNome: "Maria Silva",
          pacienteCpf: "11122233344",
          pacienteCns: "700000000000001",
          dispensadorNome: "Farmacêutico UBS",
          totalItens: 2,
          medicamentosResumo: "Losartana Potássica (60), Hidroclorotiazida (30)",
        },
        {
          id: "disp-2",
          numeroAtendimento: "ATD-2026-0002",
          dataAtendimento: hojeIso,
          status: "concluida",
          pacienteNome: "João Souza",
          pacienteCpf: "55566677788",
          pacienteCns: "700000000000002",
          dispensadorNome: "Farmacêutico UBS",
          totalItens: 1,
          medicamentosResumo: "Dipirona Sódica (10)",
        },
      ],
      totalItens: 2,
      pagina: 1,
      limite: 200,
      totalPaginas: 1,
      dataInicioEfetiva: hojeIso.slice(0, 10),
      dataFimEfetiva: hojeIso.slice(0, 10),
    });

    render(<Dispensacao />);

    await waitFor(() => {
      expect(screen.getByTestId("metrica-atendimentos-hoje")).toHaveTextContent(
        "2",
      );
      expect(screen.getByTestId("metrica-unidades-hoje")).toHaveTextContent(
        "100",
      );
      expect(screen.getByTestId("metrica-pacientes-hoje")).toHaveTextContent(
        "2",
      );
    });
  });
});
