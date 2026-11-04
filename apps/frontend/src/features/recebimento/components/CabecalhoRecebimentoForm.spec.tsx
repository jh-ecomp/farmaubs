import React, { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CabecalhoRecebimentoForm } from "./CabecalhoRecebimentoForm";
import type { CabecalhoRecebimentoDto } from "@farmaubs/shared";

const WrapperTesteCabecalho: React.FC<{
  onCaptureChange?: (dados: CabecalhoRecebimentoDto, valido: boolean) => void;
}> = ({ onCaptureChange }) => {
  const [valido, setValido] = useState(false);

  return (
    <div>
      <CabecalhoRecebimentoForm
        onValidityChange={setValido}
        onChange={(dados, isOk) => {
          setValido(isOk);
          onCaptureChange?.(dados, isOk);
        }}
      />
      <button type="button" disabled={!valido}>
        Confirmar Entrada no Estoque
      </button>
    </div>
  );
};

describe("RE-05: CabecalhoRecebimentoForm (BDD Camada D)", () => {
  it("Cenário 1: Preenchimento válido do cabeçalho com fornecedor padrão", async () => {
    const user = userEvent.setup();
    const onCapture = vi.fn();

    render(<WrapperTesteCabecalho onCaptureChange={onCapture} />);

    const selectFornecedor = screen.getByLabelText(
      /Fornecedor \/ Origem/i,
    ) as HTMLSelectElement;
    const selectTipoDoc = screen.getByLabelText(
      /Tipo de Documento/i,
    ) as HTMLSelectElement;
    const inputNumDoc = screen.getByLabelText(/Nº Nota Fiscal \/ Guia CAF/i);

    expect(selectFornecedor.value).toBe("CAF Central - SMS Parnaíba");
    expect(selectTipoDoc.value).toBe("GUIA_CAF");

    await user.type(inputNumDoc, "GUIA-CAF-2026/104");

    await waitFor(() => {
      expect(screen.getByTestId("status-cabecalho-guia")).toHaveTextContent(
        /Cabeçalho preenchido — pronto para incluir itens/i,
      );
      expect(
        screen.getByRole("button", { name: /Confirmar Entrada no Estoque/i }),
      ).not.toBeDisabled();
    });

    expect(onCapture).toHaveBeenLastCalledWith(
      expect.objectContaining({
        numeroDocumento: "GUIA-CAF-2026/104",
        tipoDocumento: "GUIA_CAF",
        fornecedorOrigem: "CAF Central - SMS Parnaíba",
      }),
      true,
    );
  });

  it("Cenário 2: Validação de obrigatoriedade do número do documento", async () => {
    const user = userEvent.setup();

    render(<WrapperTesteCabecalho />);

    const inputNumDoc = screen.getByLabelText(/Nº Nota Fiscal \/ Guia CAF/i);
    await user.type(inputNumDoc, "A");
    await user.clear(inputNumDoc);
    await user.tab();

    await waitFor(() => {
      expect(
        screen.getByText(
          "Informe o número do documento fiscal ou guia da CAF",
        ),
      ).toBeInTheDocument();
      expect(inputNumDoc.className).toContain("border-red-500");
    });

    expect(
      screen.getByRole("button", { name: /Confirmar Entrada no Estoque/i }),
    ).toBeDisabled();
  });

  it("Cenário 3: Seleção de outros fornecedores institucionais", async () => {
    const user = userEvent.setup();
    const onCapture = vi.fn();

    render(<WrapperTesteCabecalho onCaptureChange={onCapture} />);

    const inputNumDoc = screen.getByLabelText(/Nº Nota Fiscal \/ Guia CAF/i);
    const selectFornecedor = screen.getByLabelText(/Fornecedor \/ Origem/i);

    await user.type(inputNumDoc, "NF-SESAPI-2026/88");
    await user.selectOptions(
      selectFornecedor,
      "Secretaria Estadual de Saúde (SESAPI)",
    );

    await waitFor(() => {
      expect(inputNumDoc).toHaveValue("NF-SESAPI-2026/88");
      expect(onCapture).toHaveBeenLastCalledWith(
        expect.objectContaining({
          numeroDocumento: "NF-SESAPI-2026/88",
          fornecedorOrigem: "Secretaria Estadual de Saúde (SESAPI)",
        }),
        true,
      );
    });
  });
});
