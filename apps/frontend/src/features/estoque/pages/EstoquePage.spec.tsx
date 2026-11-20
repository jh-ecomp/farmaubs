import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EstoquePage } from "./EstoquePage";
import { estoqueService } from "../../../services/estoque.service";

vi.mock("../../../services/estoque.service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../services/estoque.service")>();
  return {
    ...actual,
    estoqueService: {
      obterMetricas: vi.fn(),
      consultarSaldos: vi.fn(),
      registrarAjuste: vi.fn(),
      consultarRastreabilidadeLote: vi.fn(),
      exportarRelatorioXlsx: vi.fn(),
    },
  };
});

describe("EstoquePage — Página Integrada de Controle de Estoque (ES-06 a ES-10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(estoqueService.obterMetricas).mockResolvedValue({
      totalMedicamentosAtivos: 12,
      totalUnidadesFisicas: 1850,
      itensRiscoRuptura: 2,
      lotesValidadeMesAtual: 3,
      lotesValidadeCurta90d: 5,
      lotesVencidos: 0,
      calculadoEm: "2026-11-20T12:00:00.000Z",
    });

    vi.mocked(estoqueService.consultarSaldos).mockResolvedValue({
      itens: [
        {
          produtoId: "med-los-1",
          nome: "Losartana Potássica 50mg",
          principioAtivo: "Losartana Potássica",
          formaFarmaceutica: "Comprimido",
          concentracao: "50mg",
          unidadeMedida: "comp",
          categoria: "ANTI-HIPERTENSIVO",
          saldoTotal: 50,
          statusEstoque: "REGULAR",
          lotes: [
            {
              id: "01950000-0000-7000-8000-000000000201",
              numeroLote: "LT-LOS-01",
              fabricanteId: "fab-1",
              fabricanteNome: "Farmanguinhos",
              dataValidade: "2026-11-28",
              saldoAtual: 50,
              statusValidade: "MES_CORRENTE",
            },
          ],
        },
      ],
      total: 1,
      pagina: 1,
      itensPorPagina: 15,
      totalPaginas: 1,
    });
  });

  it("Cenário: Renderiza métricas, tabela de saldos, filtra por card laranja e abre modais operacionais", async () => {
    render(<EstoquePage />);

    await waitFor(() => {
      expect(screen.getByTestId("valor-total-medicamentos")).toHaveTextContent(
        "12",
      );
    });

    expect(screen.getByText("Losartana Potássica 50mg")).toBeInTheDocument();

    // Clica no card de validade no mês
    fireEvent.click(screen.getByTestId("card-validade-mes"));

    await waitFor(() => {
      expect(estoqueService.consultarSaldos).toHaveBeenCalledWith(
        expect.objectContaining({
          filtroValidade: "MES_CORRENTE",
        }),
      );
    });

    // Expande a linha do medicamento e abre modal de ajuste
    fireEvent.click(screen.getByTestId("btn-expandir-med-los-1"));
    expect(screen.getByTestId("badge-validade-LT-LOS-01")).toHaveAttribute(
      "data-cor-badge",
      "laranja",
    );

    fireEvent.click(screen.getByTestId("btn-ajuste-lote-LT-LOS-01"));
    expect(screen.getByTestId("modal-ajuste-estoque")).toBeInTheDocument();
  });
});
