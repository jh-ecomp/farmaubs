import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BuscaMedicamentoInput } from "./BuscaMedicamentoInput";
import { catalogoDispensacaoService } from "../../services/catalogo-dispensacao.service";

vi.mock("../../services/catalogo-dispensacao.service", () => ({
  catalogoDispensacaoService: {
    buscarMedicamentos: vi.fn(),
    obterLotesFefo: vi.fn(),
  },
}));

describe("Funcionalidade: Busca Textual de Medicamento sem Código de Barras (Camada D - DI-07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Cenário: Busca textual de medicamento sem uso de código de barras e seleção com Enter", async () => {
    const user = userEvent.setup();
    const onSelecionarMock = vi.fn();

    const medicamentosMock = [
      {
        id: "med-paracetamol",
        principioAtivo: "Paracetamol",
        nomeComercial: "Tylenol",
        apresentacao: "Comprimido 500mg",
        categoria: "ANALGESICO",
        antimicrobiano: false,
        saldoTotalUbs: 240,
      },
    ];

    vi.mocked(catalogoDispensacaoService.buscarMedicamentos).mockResolvedValue(
      medicamentosMock,
    );

    render(
      <BuscaMedicamentoInput
        onSelecionarMedicamento={onSelecionarMock}
        debounceMs={50}
      />,
    );

    const inputBusca = screen.getByRole("combobox");
    await user.type(inputBusca, "paracetamol");

    // A lista suspensa deve sugerir os medicamentos correspondentes
    await waitFor(() => {
      expect(
        catalogoDispensacaoService.buscarMedicamentos,
      ).toHaveBeenCalledWith("paracetamol", undefined);
    });

    const opcao = await screen.findByRole("option", {
      name: /Paracetamol - Comprimido 500mg/i,
    });
    expect(opcao).toBeInTheDocument();

    // E o usuário pode selecionar o item pressionando a tecla Enter
    await user.keyboard("{Enter}");

    expect(onSelecionarMock).toHaveBeenCalledWith(medicamentosMock[0]);
  });
});
