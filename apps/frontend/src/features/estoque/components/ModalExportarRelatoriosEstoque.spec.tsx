import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ModalExportarRelatoriosEstoque } from "./ModalExportarRelatoriosEstoque";

describe("ModalExportarRelatoriosEstoque — Exportação de Relatórios em Planilha Excel (.xlsx) (ES-10 / RF020 / RF028)", () => {
  it("Cenário: Exportação bem-sucedida de relatório de perdas por vencimento", async () => {
    const onFechar = vi.fn();
    const onSucesso = vi.fn();
    const onExportar = vi.fn().mockResolvedValue({
      blob: new Blob(["conteudo-xlsx"], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      nomeArquivo: "relatorio_estoque_PERDAS_VENCIMENTO.xlsx",
    });

    render(
      <ModalExportarRelatoriosEstoque
        aberto={true}
        onFechar={onFechar}
        onSucesso={onSucesso}
        onExportar={onExportar}
      />,
    );

    fireEvent.change(screen.getByTestId("select-tipo-relatorio-estoque"), {
      target: { value: "PERDAS_VENCIMENTO" },
    });

    fireEvent.click(screen.getByTestId("btn-atalho-periodo-MES_ANTERIOR"));
    fireEvent.click(screen.getByTestId("btn-baixar-planilha-excel"));

    await waitFor(() => {
      expect(onExportar).toHaveBeenCalledWith(
        expect.objectContaining({
          tipoRelatorio: "PERDAS_VENCIMENTO",
        }),
      );
    });

    expect(onSucesso).toHaveBeenCalledWith(
      "Relatório de perdas exportado com sucesso",
    );
    expect(onFechar).toHaveBeenCalled();
  });

  it("Cenário: Validação de consistência de intervalo de datas personalizado", () => {
    render(
      <ModalExportarRelatoriosEstoque aberto={true} onFechar={vi.fn()} />,
    );

    fireEvent.click(screen.getByTestId("btn-atalho-periodo-PERSONALIZADO"));

    fireEvent.change(screen.getByTestId("input-relatorio-data-inicio"), {
      target: { value: "2026-09-30" },
    });
    fireEvent.change(screen.getByTestId("input-relatorio-data-fim"), {
      target: { value: "2026-09-01" },
    });

    expect(
      screen.getByTestId("erro-intervalo-datas-relatorio"),
    ).toHaveTextContent("A data final não pode ser anterior à data inicial");
    expect(screen.getByTestId("btn-baixar-planilha-excel")).toBeDisabled();
  });
});
