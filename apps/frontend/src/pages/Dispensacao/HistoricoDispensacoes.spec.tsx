import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HistoricoDispensacoes } from "./HistoricoDispensacoes";
import { dispensacaoService } from "../../services/dispensacao.service";

vi.mock("../../services/dispensacao.service", () => ({
  dispensacaoService: {
    listarDispensacoes: vi.fn(),
    exportarDispensacoesXlsx: vi.fn(),
    estornarDispensacao: vi.fn(),
    efetivarDispensacao: vi.fn(),
  },
}));

const listagemPadraoMock = {
  itens: [
    {
      id: "disp-101",
      numeroAtendimento: "ATD-2026-0101",
      dataAtendimento: "2026-10-01T10:30:00Z",
      status: "concluida" as const,
      pacienteNome: "Francisca Oliveira",
      pacienteCpf: "12345678909",
      pacienteCns: "700001122334455",
      dispensadorNome: "Dr. Carlos Farmacêutico",
      totalItens: 1,
      medicamentosResumo: "Losartana 50mg (30)",
    },
  ],
  totalItens: 1,
  pagina: 1,
  limite: 20,
  totalPaginas: 1,
  dataInicioEfetiva: "2026-09-30",
  dataFimEfetiva: "2026-10-01",
};

describe("Funcionalidade: Painel de Histórico de Dispensações e Exportação XLSX (Camada D - DI-10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dispensacaoService.listarDispensacoes).mockResolvedValue(
      listagemPadraoMock,
    );
  });

  it("Cenário: Carga inicial da tabela com filtro padrão de ontem e hoje", async () => {
    const dataRef = new Date("2026-10-01T12:00:00Z");

    render(<HistoricoDispensacoes dataReferencia={dataRef} />);

    // O seletor de período deve estar ativo no atalho "Ontem e Hoje"
    const botaoOntemHoje = screen.getByRole("button", {
      name: /^Ontem e Hoje$/i,
    });
    expect(botaoOntemHoje).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("badge-periodo-vigente")).toHaveTextContent(
      "Ontem e Hoje: 30/09/2026 a 01/10/2026",
    );

    // E a tabela deve exibir as dispensações ocorridas nesse intervalo
    expect(await screen.findByText(/Francisca Oliveira/i)).toBeInTheDocument();
    expect(screen.getByText(/Losartana 50mg \(30\)/i)).toBeInTheDocument();
  });

  it("Cenário: Exportação da consulta filtrada em formato XLSX", async () => {
    const user = userEvent.setup();
    const dataRef = new Date("2026-10-01T12:00:00Z");

    vi.mocked(dispensacaoService.exportarDispensacoesXlsx).mockResolvedValue({
      blob: new Blob(["conteudo-xlsx"], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      nomeArquivo: "dispensacoes-2026-09-30-a-2026-10-01.xlsx",
    });

    render(<HistoricoDispensacoes dataReferencia={dataRef} />);

    await screen.findByText(/Francisca Oliveira/i);

    const inputMedicamento = screen.getByLabelText(/Medicamento/i);
    await user.type(inputMedicamento, "Losartana");

    const botaoExportar = screen.getByTestId("botao-exportar-xlsx");
    await user.click(botaoExportar);

    await waitFor(() => {
      expect(
        dispensacaoService.exportarDispensacoesXlsx,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          dataInicio: "2026-09-30",
          dataFim: "2026-10-01",
          medicamentoTermo: "Losartana",
        }),
      );
    });
  });

  it("Cenário: Acionamento de estorno com justificativa obrigatória", async () => {
    const user = userEvent.setup();
    const dataRef = new Date("2026-10-01T12:00:00Z");

    vi.mocked(dispensacaoService.estornarDispensacao).mockResolvedValue({
      id: "disp-101",
      status: "estornada",
      estornadoEm: "2026-10-01T14:00:00Z",
      motivoEstorno: "Digitado item incorreto por engano",
      itensDevolvidos: [
        {
          loteId: "lote-1",
          numeroLote: "LOT-2026",
          quantidadeRestituida: 30,
          novoSaldoLote: 150,
        },
      ],
    });

    render(<HistoricoDispensacoes dataReferencia={dataRef} />);

    const botaoEstornar = await screen.findByRole("button", {
      name: /^Estornar$/i,
    });
    await user.click(botaoEstornar);

    // Modal aberto
    expect(
      screen.getByTestId("modal-estorno-dispensacao"),
    ).toBeInTheDocument();

    const campoMotivo = screen.getByLabelText(
      /Justificativa \/ Motivo do Estorno/i,
    );
    await user.type(campoMotivo, "Digitado item incorreto por engano");

    const botaoConfirmar = screen.getByRole("button", {
      name: /Confirmar Estorno/i,
    });
    await user.click(botaoConfirmar);

    await waitFor(() => {
      expect(dispensacaoService.estornarDispensacao).toHaveBeenCalledWith(
        "disp-101",
        expect.objectContaining({
          motivoEstorno: "Digitado item incorreto por engano",
        }),
      );
    });

    // E o status da linha na tabela deve mudar para "Estornada"
    await waitFor(() => {
      expect(
        screen.getByTestId("status-atendimento-disp-101"),
      ).toHaveTextContent("Estornada");
    });
  });
});
