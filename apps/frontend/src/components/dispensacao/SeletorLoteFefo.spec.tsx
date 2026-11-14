import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { SeletorLoteFefo } from "./SeletorLoteFefo";
import type { LoteDisponivelDto, MedicamentoBuscaDto } from "@farmaubs/shared";

const medicamentoMock: MedicamentoBuscaDto = {
  id: "med-digoxina",
  principioAtivo: "Digoxina",
  nomeComercial: "Lanoxin",
  apresentacao: "Comprimido 0,25mg",
  categoria: "CARDIOVASCULAR",
  antimicrobiano: false,
  indiceTerapeuticoEstreito: true,
  saldoTotalUbs: 150,
};

const lotesMock: LoteDisponivelDto[] = [
  {
    id: "lote-1-fefo",
    numeroLote: "LOT-2026-A",
    dataValidade: "2026-11-15",
    saldoDisponivel: 20,
    sugeridoFefo: true,
    diasParaVencimento: 14,
    alertaValidadeCurta: true,
    vencido: false,
  },
  {
    id: "lote-2-posterior",
    numeroLote: "LOT-2027-B",
    dataValidade: "2027-06-30",
    saldoDisponivel: 130,
    sugeridoFefo: false,
    diasParaVencimento: 240,
    alertaValidadeCurta: false,
    vencido: false,
  },
];

describe("Funcionalidade: Seleção de Lote FEFO e Limitação de Saldo (Camada D - DI-07)", () => {
  it("Cenário: Pré-seleção automática do lote com vencimento mais próximo (FEFO) e alerta de índice terapêutico", async () => {
    const user = userEvent.setup();
    const onAdicionarMock = vi.fn();

    render(
      <SeletorLoteFefo
        medicamento={medicamentoMock}
        lotesIniciais={lotesMock}
        onAdicionarAoCarrinho={onAdicionarMock}
      />,
    );

    // O lote com a data de validade mais próxima deve vir marcado como sugerido
    expect(screen.getByTestId("badge-sugerido-fefo")).toHaveTextContent(
      /Lote recomendado \(vence primeiro\)/i,
    );
    expect(screen.getByText(/LOT-2026-A/i)).toBeInTheDocument();
    expect(screen.getByTestId("badge-validade-curta")).toHaveTextContent(
      /Vence em 14 dias/i,
    );
    expect(
      screen.getByTestId("alerta-indice-terapeutico"),
    ).toBeInTheDocument();

    // E o botão de adicionar deve utilizar esse lote por padrão
    const botaoAdicionar = screen.getByRole("button", {
      name: /Adicionar ao Atendimento/i,
    });
    await user.click(botaoAdicionar);

    expect(onAdicionarMock).toHaveBeenCalledWith(
      expect.objectContaining({
        medicamento: medicamentoMock,
        lote: lotesMock[0],
        quantidade: 1,
      }),
    );
  });

  it("Cenário: Limitação da quantidade digitada ao saldo físico do lote", async () => {
    const user = userEvent.setup();
    const onAdicionarMock = vi.fn();

    render(
      <SeletorLoteFefo
        medicamento={medicamentoMock}
        lotesIniciais={lotesMock}
        onAdicionarAoCarrinho={onAdicionarMock}
      />,
    );

    const inputQuantidade = screen.getByLabelText(
      /Quantidade a Dispensar/i,
    );
    await user.clear(inputQuantidade);
    await user.type(inputQuantidade, "25");

    // Deve exibir alerta de saldo insuficiente
    expect(
      screen.getByTestId("alerta-saldo-insuficiente"),
    ).toHaveTextContent(/Saldo insuficiente no lote selecionado/i);

    // E o botão de adicionar item ao atendimento deve ficar desabilitado
    const botaoAdicionar = screen.getByRole("button", {
      name: /Adicionar ao Atendimento/i,
    });
    expect(botaoAdicionar).toBeDisabled();
  });
});
