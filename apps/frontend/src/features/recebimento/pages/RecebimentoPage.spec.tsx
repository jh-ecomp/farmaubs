import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RecebimentoPage } from "./RecebimentoPage";
import { recebimentoService } from "../../../services/recebimento.service";
import type {
  EntradaEstoqueEfetivadaResultado,
  ItemRecebimentoFormDto,
} from "@farmaubs/shared";

vi.mock("../../../services/recebimento.service", () => ({
  recebimentoService: {
    buscarProdutosCatalogo: vi.fn(),
    listarFabricantes: vi.fn(),
    cadastrarFabricante: vi.fn(),
    efetivarEntrada: vi.fn(),
    listarHistorico: vi.fn(),
    obterDetalhesEntrada: vi.fn(),
    estornarEntrada: vi.fn(),
    exportarHistoricoXlsx: vi.fn(),
  },
}));

const ITENS_INICIAIS_MOCK: ItemRecebimentoFormDto[] = [
  {
    idProvisorio: "item-1",
    produtoId: "prod-1",
    produtoNome: "Losartana Potássica",
    concentracao: "50mg",
    formaFarmaceutica: "Comprimido",
    fabricanteId: "fab-1",
    fabricanteNome: "Medley",
    numeroLote: "LOTE-2026A",
    dataValidade: "2027-08-15",
    quantidadeRecebida: 500,
    validadeCurta: false,
  },
  {
    idProvisorio: "item-2",
    produtoId: "prod-2",
    produtoNome: "Amoxicilina",
    concentracao: "500mg",
    formaFarmaceutica: "Cápsula",
    fabricanteId: "fab-1",
    fabricanteNome: "Medley",
    numeroLote: "LOTE-2026B",
    dataValidade: "2027-09-10",
    quantidadeRecebida: 700,
    validadeCurta: false,
  },
  {
    idProvisorio: "item-3",
    produtoId: "prod-3",
    produtoNome: "Dipirona Sódica",
    concentracao: "500mg",
    formaFarmaceutica: "Comprimido",
    fabricanteId: "fab-2",
    fabricanteNome: "EMS",
    numeroLote: "LOTE-2026C",
    dataValidade: "2027-10-01",
    quantidadeRecebida: 300,
    validadeCurta: false,
  },
];

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

describe("RE-07: RecebimentoPage (BDD Camada D)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(recebimentoService.listarFabricantes).mockResolvedValue([]);
    vi.mocked(recebimentoService.listarHistorico).mockResolvedValue({
      itens: [],
      total: 0,
      pagina: 1,
      totalPaginas: 1,
    });
  });

  it("Cenário 1: Revisão e remoção de item da lista provisória antes da confirmação", async () => {
    const user = userEvent.setup();

    renderComQueryClient(
      <RecebimentoPage
        cabecalhoInicial={{
          numeroDocumento: "GUIA-CAF-2026/104",
          tipoDocumento: "GUIA_CAF",
          fornecedorOrigem: "CAF Central - SMS Parnaíba",
        }}
        itensIniciais={ITENS_INICIAIS_MOCK}
      />,
    );

    expect(screen.getByText("3 medicamentos distintos")).toBeInTheDocument();
    expect(
      screen.getByText("1500 unidades físicas a ingressar"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Remover item Dipirona Sódica/i }),
    );

    expect(screen.getByText("2 medicamentos distintos")).toBeInTheDocument();
    expect(
      screen.getByText("1200 unidades físicas a ingressar"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Dipirona Sódica/i)).not.toBeInTheDocument();
  });

  it("Cenário 2: Confirmação da entrada e sincronização imediata do estoque", async () => {
    const user = userEvent.setup();
    vi.mocked(recebimentoService.efetivarEntrada).mockResolvedValue({
      id: "ent-104",
      numeroDocumento: "GUIA-CAF-2026/104",
      tipoDocumento: "GUIA_CAF",
      fornecedorOrigem: "CAF Central - SMS Parnaíba",
      dataRecebimento: "2026-05-02T14:30:00.000Z",
      usuarioRecebedorId: "usr-01",
      itens: [],
      avisos: [],
    });

    const { queryClient } = renderComQueryClient(
      <RecebimentoPage
        cabecalhoInicial={{
          numeroDocumento: "GUIA-CAF-2026/104",
          tipoDocumento: "GUIA_CAF",
          fornecedorOrigem: "CAF Central - SMS Parnaíba",
        }}
        itensIniciais={ITENS_INICIAIS_MOCK.slice(0, 2)}
      />,
    );
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await user.click(
      screen.getByRole("button", { name: /Confirmar Entrada no Estoque/i }),
    );

    expect(
      screen.getByRole("dialog", {
        name: /Revisar e Confirmar Entrada no Estoque/i,
      }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Confirmar e Abastecer Estoque/i }),
    );

    await waitFor(() => {
      expect(recebimentoService.efetivarEntrada).toHaveBeenCalledWith(
        expect.objectContaining({
          numeroDocumento: "GUIA-CAF-2026/104",
          tipoDocumento: "GUIA_CAF",
          fornecedorOrigem: "CAF Central - SMS Parnaíba",
        }),
      );
      expect(
        screen.getByText(
          "Entrada registrada! O estoque da UBS foi abastecido com sucesso.",
        ),
      ).toBeInTheDocument();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["estoque-atual"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["ultimos-recebimentos"],
    });
  });

  it("Cenário 3: Prevenção de duplo clique durante o envio", async () => {
    const user = userEvent.setup();
    let resolverEntrada!: (val: EntradaEstoqueEfetivadaResultado) => void;
    vi.mocked(recebimentoService.efetivarEntrada).mockImplementation(
      () =>
        new Promise<EntradaEstoqueEfetivadaResultado>((resolve) => {
          resolverEntrada = resolve;
        }),
    );

    renderComQueryClient(
      <RecebimentoPage
        cabecalhoInicial={{
          numeroDocumento: "GUIA-CAF-2026/104",
          tipoDocumento: "GUIA_CAF",
          fornecedorOrigem: "CAF Central - SMS Parnaíba",
        }}
        itensIniciais={ITENS_INICIAIS_MOCK.slice(0, 1)}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Confirmar Entrada no Estoque/i }),
    );

    const botaoSubmeter = screen.getByRole("button", {
      name: /Confirmar e Abastecer Estoque/i,
    });
    await user.click(botaoSubmeter);

    const botaoProcessando = screen.getByRole("button", {
      name: /Processando entrada\.\.\./i,
    });
    expect(botaoProcessando).toBeDisabled();

    resolverEntrada({
      id: "ent-104",
      numeroDocumento: "GUIA-CAF-2026/104",
      tipoDocumento: "GUIA_CAF",
      fornecedorOrigem: "CAF Central - SMS Parnaíba",
      dataRecebimento: "2026-05-02T14:30:00.000Z",
      usuarioRecebedorId: "usr-01",
      itens: [],
      avisos: [],
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          "Entrada registrada! O estoque da UBS foi abastecido com sucesso.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("Cenário 4: Preservação dos dados digitados em caso de falha de rede", async () => {
    const user = userEvent.setup();
    vi.mocked(recebimentoService.efetivarEntrada).mockRejectedValue(
      new Error("Network error"),
    );

    renderComQueryClient(
      <RecebimentoPage
        cabecalhoInicial={{
          numeroDocumento: "GUIA-CAF-2026/104",
          tipoDocumento: "GUIA_CAF",
          fornecedorOrigem: "CAF Central - SMS Parnaíba",
        }}
        itensIniciais={ITENS_INICIAIS_MOCK}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Confirmar Entrada no Estoque/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /Confirmar e Abastecer Estoque/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "Falha ao registrar entrada. Verifique sua conexão e tente novamente.",
        ),
      ).toBeInTheDocument();
    });

    // Todos os 3 itens permanecem intactos na tabela provisória
    expect(screen.getByText("3 medicamentos distintos")).toBeInTheDocument();
    expect(
      screen.getByText("1500 unidades físicas a ingressar"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Losartana Potássica/i)).toBeInTheDocument();
    expect(screen.getByText(/Amoxicilina/i)).toBeInTheDocument();
    expect(screen.getByText(/Dipirona Sódica/i)).toBeInTheDocument();
  });

  it("Cenário 5: Exibição da mensagem de erro de negócio retornada pela API", async () => {
    const user = userEvent.setup();
    vi.mocked(recebimentoService.efetivarEntrada).mockRejectedValue(
      new Error("Lote LOTE-2026A encontra-se vencido e não pode ser recebido."),
    );

    renderComQueryClient(
      <RecebimentoPage
        cabecalhoInicial={{
          numeroDocumento: "GUIA-CAF-2026/104",
          tipoDocumento: "GUIA_CAF",
          fornecedorOrigem: "CAF Central - SMS Parnaíba",
        }}
        itensIniciais={ITENS_INICIAIS_MOCK.slice(0, 1)}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Confirmar Entrada no Estoque/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /Confirmar e Abastecer Estoque/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "Lote LOTE-2026A encontra-se vencido e não pode ser recebido.",
        ),
      ).toBeInTheDocument();
    });
  });
});
