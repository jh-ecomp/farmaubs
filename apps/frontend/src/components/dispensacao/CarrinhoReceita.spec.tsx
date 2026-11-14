import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { CarrinhoReceita } from "./CarrinhoReceita";
import {
  DispensacaoProvider,
  useDispensacao,
} from "../../contexts/DispensacaoContext";

function WrapperTesteCarrinho() {
  const {
    itens,
    receitaEmissaoEm,
    definirReceitaEmissaoEm,
    adicionarItem,
    atualizarQuantidadeItem,
    atualizarPosologiaItem,
    removerItem,
  } = useDispensacao();

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          adicionarItem({
            medicamento: {
              id: "med-losartana",
              principioAtivo: "Losartana 50mg",
              apresentacao: "Comprimido",
              categoria: "ANTI-HIPERTENSIVO",
              antimicrobiano: false,
              saldoTotalUbs: 100,
            },
            lote: {
              id: "lote-los",
              numeroLote: "LOT-LOS-1",
              dataValidade: "2027-05-01",
              saldoDisponivel: 100,
              sugeridoFefo: true,
              diasParaVencimento: 180,
              alertaValidadeCurta: false,
              vencido: false,
            },
            quantidade: 30,
          })
        }
      >
        Add Losartana 30
      </button>
      <button
        type="button"
        onClick={() =>
          adicionarItem({
            medicamento: {
              id: "med-hidro",
              principioAtivo: "Hidroclorotiazida 25mg",
              apresentacao: "Comprimido",
              categoria: "DIURETICO",
              antimicrobiano: false,
              saldoTotalUbs: 100,
            },
            lote: {
              id: "lote-hidro",
              numeroLote: "LOT-HID-1",
              dataValidade: "2027-08-01",
              saldoDisponivel: 100,
              sugeridoFefo: true,
              diasParaVencimento: 270,
              alertaValidadeCurta: false,
              vencido: false,
            },
            quantidade: 20,
          })
        }
      >
        Add Hidroclorotiazida 20
      </button>
      <button
        type="button"
        onClick={() =>
          adicionarItem({
            medicamento: {
              id: "med-amox",
              principioAtivo: "Amoxicilina 500mg",
              apresentacao: "Cápsula",
              categoria: "ANTIMICROBIANO",
              antimicrobiano: true,
              saldoTotalUbs: 80,
            },
            lote: {
              id: "lote-amox",
              numeroLote: "LOT-AMX-1",
              dataValidade: "2027-03-10",
              saldoDisponivel: 80,
              sugeridoFefo: true,
              diasParaVencimento: 120,
              alertaValidadeCurta: false,
              vencido: false,
            },
            quantidade: 21,
          })
        }
      >
        Add Amoxicilina
      </button>

      <CarrinhoReceita
        itens={itens}
        receitaEmissaoEm={receitaEmissaoEm}
        onChangeReceitaEmissaoEm={definirReceitaEmissaoEm}
        onAlterarQuantidade={atualizarQuantidadeItem}
        onAlterarPosologia={atualizarPosologiaItem}
        onRemoverItem={removerItem}
        onFinalizarAtendimento={vi.fn()}
      />
    </div>
  );
}

describe("Funcionalidade: Carrinho da Receita (Camada D - DI-08)", () => {
  it("Cenário: Adição de múltiplos medicamentos ao carrinho de atendimento", async () => {
    const user = userEvent.setup();

    render(
      <DispensacaoProvider>
        <WrapperTesteCarrinho />
      </DispensacaoProvider>,
    );

    await user.click(screen.getByRole("button", { name: /Add Losartana 30/i }));
    await user.click(
      screen.getByRole("button", { name: /Add Hidroclorotiazida 20/i }),
    );

    // O carrinho deve exibir exatamente 2 linhas de medicamentos
    const linhas = screen.getAllByRole("listitem");
    expect(linhas).toHaveLength(2);

    // E o totalizador de unidades deve exibir 50
    expect(screen.getByTestId("totalizador-itens")).toHaveTextContent("2");
    expect(screen.getByTestId("totalizador-unidades")).toHaveTextContent("50");
  });

  it("Cenário: Exigência da data de receita ao adicionar medicamento antimicrobiano", async () => {
    const user = userEvent.setup();

    render(
      <DispensacaoProvider>
        <WrapperTesteCarrinho />
      </DispensacaoProvider>,
    );

    await user.click(screen.getByRole("button", { name: /Add Losartana 30/i }));
    expect(
      screen.queryByTestId("validacao-receita-antimicrobiano"),
    ).not.toBeInTheDocument();

    // Quando adicionar o item "Amoxicilina 500mg"
    await user.click(screen.getByRole("button", { name: /Add Amoxicilina/i }));

    // O campo "Data de Emissão da Receita" deve se tornar obrigatório e exibir orientação
    expect(
      screen.getByTestId("validacao-receita-antimicrobiano"),
    ).toBeInTheDocument();
    const inputDataReceita = screen.getByLabelText(
      /Data de Emissão da Receita Médica/i,
    );
    expect(inputDataReceita).toBeRequired();
    expect(
      screen.getByText(/Validade legal da receita: 10 dias corridos/i),
    ).toBeInTheDocument();
  });
});
