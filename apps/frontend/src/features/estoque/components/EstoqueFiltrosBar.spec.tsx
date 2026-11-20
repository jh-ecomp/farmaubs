import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { EstoqueFiltrosBar } from "./EstoqueFiltrosBar";

describe("EstoqueFiltrosBar — Barra de Filtros Avançados e Validade no Mês Corrente (ES-08 / RF005 / RF022)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Cenário: Seleção do filtro 'Vencendo no Mês Vigente' dispara onChange e exibe chip ativo", () => {
    const onChange = vi.fn();
    const onLimpar = vi.fn();

    const { rerender } = render(
      <EstoqueFiltrosBar
        valores={{ filtroValidade: "TODOS", statusEstoque: "TODOS", pagina: 2 }}
        onChange={onChange}
        onLimpar={onLimpar}
      />,
    );

    const selectValidade = screen.getByTestId("select-filtro-validade");
    fireEvent.change(selectValidade, { target: { value: "MES_CORRENTE" } });

    expect(onChange).toHaveBeenCalledWith({
      filtroValidade: "MES_CORRENTE",
      pagina: 1,
    });

    rerender(
      <EstoqueFiltrosBar
        valores={{
          filtroValidade: "MES_CORRENTE",
          statusEstoque: "TODOS",
          pagina: 1,
        }}
        onChange={onChange}
        onLimpar={onLimpar}
      />,
    );

    expect(screen.getByTestId("chip-filtro-validade")).toHaveTextContent(
      /Vencendo no Mês Vigente/i,
    );
  });

  it("Cenário: Digitação no campo de busca aplica debounce de 300ms e reseta para página 1", () => {
    const onChange = vi.fn();
    const onLimpar = vi.fn();

    render(
      <EstoqueFiltrosBar
        valores={{ filtroValidade: "TODOS", statusEstoque: "TODOS", pagina: 3 }}
        onChange={onChange}
        onLimpar={onLimpar}
      />,
    );

    const inputBusca = screen.getByTestId("input-busca-estoque");
    fireEvent.change(inputBusca, { target: { value: "Amox" } });

    // Antes de 300ms não deve disparar
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onChange).not.toHaveBeenCalled();

    // Após completar 300ms deve disparar
    act(() => {
      vi.advanceTimersByTime(110);
    });
    expect(onChange).toHaveBeenCalledWith({
      termo: "Amox",
      pagina: 1,
    });
  });

  it("Cenário: Clique no botão 'Limpar Filtros' reseta estado", () => {
    const onChange = vi.fn();
    const onLimpar = vi.fn();

    render(
      <EstoqueFiltrosBar
        valores={{
          termo: "Losartana",
          filtroValidade: "MES_CORRENTE",
          statusEstoque: "BAIXO_ESTOQUE",
          pagina: 1,
        }}
        onChange={onChange}
        onLimpar={onLimpar}
      />,
    );

    const btnLimpar = screen.getByTestId("btn-limpar-filtros-estoque");
    fireEvent.click(btnLimpar);

    expect(onLimpar).toHaveBeenCalledTimes(1);
  });
});
