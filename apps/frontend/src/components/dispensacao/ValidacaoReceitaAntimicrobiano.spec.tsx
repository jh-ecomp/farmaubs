import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { CarrinhoReceita } from "./CarrinhoReceita";
import type { ItemCarrinhoDispensacao } from "../../contexts/DispensacaoContext";

const itemCefalexina: ItemCarrinhoDispensacao = {
  medicamento: {
    id: "med-cefalexina",
    principioAtivo: "Cefalexina 500mg",
    apresentacao: "Comprimido",
    categoria: "ANTIMICROBIANO",
    antimicrobiano: true,
    saldoTotalUbs: 60,
  },
  lote: {
    id: "lote-cef-1",
    numeroLote: "LOT-CEF-2026",
    dataValidade: "2027-04-15",
    saldoDisponivel: 60,
    sugeridoFefo: true,
    diasParaVencimento: 165,
    alertaValidadeCurta: false,
    vencido: false,
  },
  quantidadeDispensada: 28,
  posologia: "1 cp de 6/6h por 7 dias",
};

function ComponenteTesteAntimicrobiano() {
  const [dataReceita, setDataReceita] = useState("");
  const dataReferencia = new Date("2026-11-01T12:00:00Z");

  return (
    <CarrinhoReceita
      itens={[itemCefalexina]}
      receitaEmissaoEm={dataReceita}
      onChangeReceitaEmissaoEm={setDataReceita}
      onAlterarQuantidade={vi.fn()}
      onAlterarPosologia={vi.fn()}
      onRemoverItem={vi.fn()}
      onFinalizarAtendimento={vi.fn()}
      dataReferencia={dataReferencia}
    />
  );
}

describe("Funcionalidade: Validação de Receita de Antimicrobianos (Camada D - DI-08)", () => {
  it("Cenário: Bloqueio do atendimento para receita de antimicrobiano emitida há 11 dias", async () => {
    const user = userEvent.setup();

    render(<ComponenteTesteAntimicrobiano />);

    const inputData = screen.getByLabelText(
      /Data de Emissão da Receita Médica/i,
    );

    // Seleciona data de 11 dias atrás em relação a 2026-11-01 -> 2026-10-21
    await user.clear(inputData);
    await user.type(inputData, "2026-10-21");

    // Deve exibir mensagem de erro indicando receita expirada
    const alertaErro = await screen.findByTestId("erro-receita-expirada");
    expect(alertaErro).toBeInTheDocument();
    expect(alertaErro).toHaveTextContent(
      /Receita médica vencida há 11 dias/i,
    );

    // E o botão de prosseguir para finalização deve ficar desabilitado
    const botaoFinalizar = screen.getByRole("button", {
      name: /Finalizar Atendimento/i,
    });
    expect(botaoFinalizar).toBeDisabled();
  });
});
