import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { LoteEstoqueDto, MedicamentoSaldoItemDto } from "@farmaubs/shared";
import { ModalAjusteEstoque } from "./ModalAjusteEstoque";

const LOTE_MOCK: LoteEstoqueDto = {
  id: "01950000-0000-7000-8000-000000000201",
  numeroLote: "LT-01",
  fabricanteId: "fab-1",
  fabricanteNome: "EMS",
  dataValidade: "2027-05-10",
  saldoAtual: 20,
  statusValidade: "REGULAR",
};

const MED_MOCK: MedicamentoSaldoItemDto = {
  produtoId: "med-1",
  nome: "Dipirona Sódica 500mg",
  principioAtivo: "Dipirona Sódica",
  formaFarmaceutica: "Comprimido",
  concentracao: "500mg",
  unidadeMedida: "comp",
  categoria: "ANALGESICO",
  saldoTotal: 20,
  statusEstoque: "REGULAR",
  lotes: [LOTE_MOCK],
};

describe("ModalAjusteEstoque — Ajuste Rápido (+/-) Justificado (ES-09 / RF009 / RF011 / RF028)", () => {
  it("Cenário: Confirmação de ajuste de saída por avaria com justificativa válida", async () => {
    const onFechar = vi.fn();
    const onSucesso = vi.fn();
    const onConfirmarAjuste = vi.fn().mockResolvedValue({
      movimentacaoId: "mov-1",
      loteId: LOTE_MOCK.id,
      tipoOperacao: "SAIDA",
      quantidadeAjustada: 2,
      saldoAnterior: 20,
      saldoAtualizado: 18,
      motivo: "AVARIA_FISICA",
      justificativa: "Frasco quebrou durante manuseio na bancada",
      realizadoPor: { id: "u-1", nome: "Dr. Carlos" },
      dataHora: "2026-11-20T12:00:00.000Z",
    });

    render(
      <ModalAjusteEstoque
        aberto={true}
        lote={LOTE_MOCK}
        medicamento={MED_MOCK}
        onFechar={onFechar}
        onSucesso={onSucesso}
        onConfirmarAjuste={onConfirmarAjuste}
      />,
    );

    fireEvent.click(screen.getByTestId("btn-operacao-saida"));
    fireEvent.change(screen.getByTestId("input-quantidade-ajuste"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByTestId("select-motivo-ajuste"), {
      target: { value: "AVARIA_FISICA" },
    });
    fireEvent.change(screen.getByTestId("textarea-justificativa-ajuste"), {
      target: { value: "Frasco quebrou durante manuseio na bancada" },
    });

    const btnConfirmar = screen.getByTestId("btn-confirmar-ajuste");
    expect(btnConfirmar).not.toBeDisabled();

    fireEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(onConfirmarAjuste).toHaveBeenCalledWith(LOTE_MOCK.id, {
        tipoOperacao: "SAIDA",
        quantidade: 2,
        motivo: "AVARIA_FISICA",
        justificativa: "Frasco quebrou durante manuseio na bancada",
      });
    });

    expect(onSucesso).toHaveBeenCalled();
    expect(onFechar).toHaveBeenCalled();
  });

  it("Cenário: Bloqueio do botão de confirmação quando a justificativa para motivo 'Outro' tem menos de 20 caracteres", () => {
    render(
      <ModalAjusteEstoque
        aberto={true}
        lote={LOTE_MOCK}
        medicamento={MED_MOCK}
        onFechar={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId("select-motivo-ajuste"), {
      target: { value: "OUTRO" },
    });
    fireEvent.change(screen.getByTestId("textarea-justificativa-ajuste"), {
      target: { value: "ajuste" },
    });

    const btnConfirmar = screen.getByTestId("btn-confirmar-ajuste");
    expect(btnConfirmar).toBeDisabled();
    expect(screen.getByTestId("aviso-justificativa-ajuste")).toHaveTextContent(
      "O motivo 'Outro' exige justificativa detalhada com no mínimo 20 caracteres",
    );
  });

  it("Cenário: Bloqueio de saída maior que o saldo atual do lote", () => {
    render(
      <ModalAjusteEstoque
        aberto={true}
        lote={LOTE_MOCK}
        medicamento={MED_MOCK}
        onFechar={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId("input-quantidade-ajuste"), {
      target: { value: "25" },
    });
    fireEvent.change(screen.getByTestId("textarea-justificativa-ajuste"), {
      target: { value: "Tentativa de saída acima do saldo" },
    });

    expect(
      screen.getByTestId("erro-saldo-insuficiente-ajuste"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("btn-confirmar-ajuste")).toBeDisabled();
  });
});
