import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { EstoqueMetricasResponseDto } from "@farmaubs/shared";
import { EstoqueCardsMetricas } from "./EstoqueCardsMetricas";

const METRICAS_MOCK: EstoqueMetricasResponseDto = {
  totalMedicamentosAtivos: 24,
  totalUnidadesFisicas: 3450,
  itensRiscoRuptura: 3,
  lotesValidadeMesAtual: 6,
  lotesValidadeCurta90d: 9,
  lotesVencidos: 1,
  calculadoEm: "2026-11-20T12:00:00.000Z",
};

describe("EstoqueCardsMetricas — Cartões Superiores de Indicadores de Estoque (ES-06 / RF018 / RF022 / RF023)", () => {
  it("Cenário: Renderiza skeleton loaders durante o carregamento", () => {
    render(<EstoqueCardsMetricas carregando={true} metricas={null} />);

    expect(screen.getByTestId("estoque-metricas-skeleton")).toBeInTheDocument();
    expect(
      screen.queryByTestId("card-total-medicamentos"),
    ).not.toBeInTheDocument();
  });

  it("Cenário: Renderização com dados e destaque do card laranja de validade", () => {
    render(
      <EstoqueCardsMetricas carregando={false} metricas={METRICAS_MOCK} />,
    );

    expect(
      screen.queryByTestId("estoque-metricas-skeleton"),
    ).not.toBeInTheDocument();

    expect(screen.getByTestId("valor-total-medicamentos")).toHaveTextContent(
      "24",
    );
    expect(screen.getByTestId("valor-total-unidades")).toHaveTextContent(
      "3.450",
    );
    expect(screen.getByTestId("valor-risco-ruptura")).toHaveTextContent("3");
    expect(screen.getByTestId("valor-validade-mes")).toHaveTextContent("6");

    const cardValidade = screen.getByTestId("card-validade-mes");
    expect(cardValidade.className).toMatch(/amber/);
  });

  it("Cenário: Clique no card de risco de ruptura aciona filtro na tabela e indicador ativo", () => {
    const onFiltrarPorCard = vi.fn();
    render(
      <EstoqueCardsMetricas
        carregando={false}
        metricas={METRICAS_MOCK}
        onFiltrarPorCard={onFiltrarPorCard}
      />,
    );

    const cardRuptura = screen.getByTestId("card-risco-ruptura");
    fireEvent.click(cardRuptura);

    expect(onFiltrarPorCard).toHaveBeenCalledWith({
      statusEstoque: "BAIXO_ESTOQUE",
    });
    expect(cardRuptura).toHaveAttribute("data-active", "true");
    expect(
      screen.getByTestId("indicador-card-ruptura-ativo"),
    ).toBeInTheDocument();
  });

  it("Cenário: Clique no card laranja de validade no mês aciona filtro MES_CORRENTE", () => {
    const onFiltrarPorCard = vi.fn();
    render(
      <EstoqueCardsMetricas
        carregando={false}
        metricas={METRICAS_MOCK}
        onFiltrarPorCard={onFiltrarPorCard}
      />,
    );

    const cardValidade = screen.getByTestId("card-validade-mes");
    fireEvent.click(cardValidade);

    expect(onFiltrarPorCard).toHaveBeenCalledWith({
      filtroValidade: "MES_CORRENTE",
    });
    expect(cardValidade).toHaveAttribute("data-active", "true");
  });

  it("Cenário: Exibe badge 'Estoque Saudável' quando não há itens em risco de ruptura", () => {
    render(
      <EstoqueCardsMetricas
        carregando={false}
        metricas={{ ...METRICAS_MOCK, itensRiscoRuptura: 0 }}
      />,
    );

    expect(screen.getByText("Estoque Saudável")).toBeInTheDocument();
  });
});
