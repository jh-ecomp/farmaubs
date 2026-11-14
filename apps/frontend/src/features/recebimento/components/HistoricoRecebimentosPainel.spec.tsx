import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HistoricoRecebimentosPainel } from "./HistoricoRecebimentosPainel";
import { recebimentoService } from "../../../services/recebimento.service";

vi.mock("../../../services/recebimento.service", () => ({
  recebimentoService: {
    listarHistorico: vi.fn(),
    obterDetalhesEntrada: vi.fn(),
    estornarEntrada: vi.fn(),
    exportarHistoricoXlsx: vi.fn(),
  },
}));

const HISTORICO_MOCK = {
  itens: [
    {
      id: "ent-104",
      numeroDocumento: "GUIA-CAF-2026/104",
      tipoDocumento: "GUIA_CAF",
      fornecedorOrigem: "CAF Central - SMS Parnaíba",
      dataRecebimento: "2026-05-02T14:30:00.000Z",
      usuarioRecebedorNome: "Dr. Carlos Mendes",
      totalItens: 2,
      totalUnidades: 700,
      status: "CONCLUIDO" as const,
      podeEstornar: true,
    },
  ],
  total: 1,
  pagina: 1,
  totalPaginas: 1,
};

const DETALHES_MOCK = {
  id: "ent-104",
  ubsId: "ubs-phb-01",
  ubsNome: "UBS Módulo I - Parnaíba",
  numeroDocumento: "GUIA-CAF-2026/104",
  tipoDocumento: "GUIA_CAF",
  fornecedorOrigem: "CAF Central - SMS Parnaíba",
  dataRecebimento: "2026-05-02T14:30:00.000Z",
  usuarioRecebedorId: "usr-01",
  usuarioRecebedorNome: "Dr. Carlos Mendes",
  status: "CONCLUIDO" as const,
  podeEstornar: true,
  totalItens: 2,
  totalUnidades: 700,
  itens: [
    {
      id: "item-1",
      produtoId: "prod-1",
      produtoNome: "Losartana Potássica",
      concentracao: "50mg",
      formaFarmaceutica: "Comprimido",
      fabricanteId: "fab-1",
      fabricanteNome: "Medley",
      loteId: "lote-1",
      numeroLote: "LOTE-2026A",
      dataValidade: "2027-08-15",
      quantidadeRecebida: 500,
      saldoAtualLote: 500,
    },
  ],
};

function renderComQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    ),
  };
}

describe("RE-08: HistoricoRecebimentosPainel (BDD Camada D)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(recebimentoService.listarHistorico).mockResolvedValue(
      HISTORICO_MOCK,
    );
    vi.mocked(recebimentoService.obterDetalhesEntrada).mockResolvedValue(
      DETALHES_MOCK,
    );
  });

  it("Cenário 1: Carregamento rápido da tabela com filtro padrão 'Ontem e Hoje' (D-1 e D0)", async () => {
    renderComQueryClient(<HistoricoRecebimentosPainel />);

    const botaoOntemHoje = screen.getByRole("button", {
      name: /Ontem e Hoje/i,
    });
    expect(botaoOntemHoje).toHaveAttribute("aria-pressed", "true");

    expect(screen.getByTestId("badge-periodo-ativo")).toHaveTextContent(
      /Exibindo recebimentos de: Ontem e Hoje/i,
    );

    await waitFor(() => {
      expect(screen.getByText("GUIA-CAF-2026/104")).toBeInTheDocument();
    });

    expect(recebimentoService.listarHistorico).toHaveBeenCalledWith(
      expect.objectContaining({
        dataInicio: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        dataFim: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    );
  });

  it("Cenário 2: Consulta de recebimentos de meses anteriores via filtro de período", async () => {
    const user = userEvent.setup();
    renderComQueryClient(<HistoricoRecebimentosPainel />);

    await waitFor(() =>
      expect(screen.getByText("GUIA-CAF-2026/104")).toBeInTheDocument(),
    );

    await user.click(
      screen.getByRole("button", { name: /Período Personalizado/i }),
    );

    const inputDe = screen.getByLabelText("De");
    const inputAte = screen.getByLabelText("Até");

    await user.clear(inputDe);
    await user.type(inputDe, "2026-04-01");
    await user.clear(inputAte);
    await user.type(inputAte, "2026-04-15");

    await user.click(screen.getByRole("button", { name: /Filtrar Período/i }));

    await waitFor(() => {
      expect(recebimentoService.listarHistorico).toHaveBeenCalledWith(
        expect.objectContaining({
          dataInicio: "2026-04-01",
          dataFim: "2026-04-15",
        }),
      );
      expect(screen.getByTestId("badge-periodo-ativo")).toHaveTextContent(
        "Exibindo recebimentos de: 01/04/2026 até 15/04/2026",
      );
    });
  });

  it("Cenário 3: Exportação dos recebimentos filtrados em planilha Excel (.xlsx)", async () => {
    const user = userEvent.setup();
    let resolverExportacao!: (val: {
      blob: Blob;
      nomeArquivo: string;
    }) => void;
    vi.mocked(recebimentoService.exportarHistoricoXlsx).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolverExportacao = resolve;
        }),
    );

    renderComQueryClient(<HistoricoRecebimentosPainel />);

    const botaoExportar = screen.getByRole("button", {
      name: /Exportar Excel \(\.xlsx\)/i,
    });
    await user.click(botaoExportar);

    expect(
      screen.getByRole("button", { name: /Gerando planilha\.\.\./i }),
    ).toBeDisabled();

    resolverExportacao({
      blob: new Blob(["conteudo"]),
      nomeArquivo: "recebimentos-ubs-parnaiba-2026-05-02.xlsx",
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Exportar Excel \(\.xlsx\)/i }),
      ).not.toBeDisabled();
    });

    expect(recebimentoService.exportarHistoricoXlsx).toHaveBeenCalledTimes(1);
  });

  it("Cenário 4: Visualização e impressão do Termo de Recebimento de Carga SUS", async () => {
    const user = userEvent.setup();
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});

    renderComQueryClient(<HistoricoRecebimentosPainel />);

    await waitFor(() =>
      expect(screen.getByText("GUIA-CAF-2026/104")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /Comprovante/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", {
          name: /Termo de Recebimento de Carga SUS/i,
        }),
      ).toBeInTheDocument();
      expect(
        document.getElementById("termoRecebimentoPrintArea"),
      ).toBeInTheDocument();
      expect(screen.getByText(/LOTE-2026A/i)).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /Imprimir Comprovante/i }),
    );
    expect(printSpy).toHaveBeenCalledTimes(1);

    printSpy.mockRestore();
  });

  it("Cenário 5: Estorno de guia de recebimento com justificativa obrigatória", async () => {
    const user = userEvent.setup();
    vi.mocked(recebimentoService.estornarEntrada).mockResolvedValue({
      id: "ent-104",
      numeroDocumento: "GUIA-CAF-2026/104",
      status: "ESTORNADO",
      dataEstorno: "2026-05-02T15:00:00.000Z",
      usuarioEstornoId: "usr-01",
      motivoEstorno: "Erro de digitação na quantidade física do lote",
      totalItensEstornados: 2,
      totalUnidadesEstornadas: 700,
    });

    const { queryClient } = renderComQueryClient(
      <HistoricoRecebimentosPainel />,
    );
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await waitFor(() =>
      expect(screen.getByText("GUIA-CAF-2026/104")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /Estornar/i }));

    const botaoConfirmar = screen.getByRole("button", {
      name: /Confirmar Estorno/i,
    });
    expect(botaoConfirmar).toBeDisabled();

    const textarea = screen.getByLabelText(/Justificativa do Estorno/i);
    await user.type(textarea, "curto");
    expect(botaoConfirmar).toBeDisabled();

    await user.clear(textarea);
    await user.type(
      textarea,
      "Erro de digitação na quantidade física do lote",
    );
    expect(botaoConfirmar).not.toBeDisabled();

    await user.click(botaoConfirmar);

    await waitFor(() => {
      expect(recebimentoService.estornarEntrada).toHaveBeenCalledWith(
        "ent-104",
        "Erro de digitação na quantidade física do lote",
      );
      expect(screen.getByText("ESTORNADO")).toBeInTheDocument();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["estoque-atual"],
    });
  });
});
