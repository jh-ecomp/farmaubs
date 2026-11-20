import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { MedicamentoSaldoItemDto } from "@farmaubs/shared";
import { TabelaSaldosEstoque } from "./TabelaSaldosEstoque";

const MEDICAMENTOS_MOCK: MedicamentoSaldoItemDto[] = [
  {
    produtoId: "med-losartana",
    nome: "Losartana Potássica 50mg",
    principioAtivo: "Losartana Potássica",
    formaFarmaceutica: "Comprimido",
    concentracao: "50mg",
    unidadeMedida: "comp",
    categoria: "ANTI-HIPERTENSIVO",
    saldoTotal: 150,
    statusEstoque: "REGULAR",
    lotes: [
      {
        id: "lote-02",
        numeroLote: "LT-LOS-02",
        fabricanteId: "fab-2",
        fabricanteNome: "EMS",
        dataValidade: "2027-11-20",
        saldoAtual: 100,
        statusValidade: "REGULAR",
      },
      {
        id: "lote-01",
        numeroLote: "LT-LOS-01",
        fabricanteId: "fab-1",
        fabricanteNome: "Farmanguinhos",
        dataValidade: "2026-11-28",
        saldoAtual: 50,
        statusValidade: "MES_CORRENTE",
      },
    ],
  },
];

describe("TabelaSaldosEstoque — Tabela Principal de Saldos e Expansão de Lotes FEFO (ES-07 / RF005 / RF022)", () => {
  it("Cenário: Expansão de linha de medicamento, ordenação FEFO e exibição de badge laranja para lote do mês corrente", () => {
    const onAbrirAjuste = vi.fn();
    const onAbrirRastreabilidade = vi.fn();

    render(
      <TabelaSaldosEstoque
        medicamentos={MEDICAMENTOS_MOCK}
        carregando={false}
        onAbrirAjuste={onAbrirAjuste}
        onAbrirRastreabilidade={onAbrirRastreabilidade}
      />,
    );

    const btnExpandir = screen.getByTestId("btn-expandir-med-losartana");
    expect(btnExpandir).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(btnExpandir);

    expect(btnExpandir).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByTestId("subtabela-lotes-med-losartana"),
    ).toBeInTheDocument();

    const badgeLote01 = screen.getByTestId("badge-validade-LT-LOS-01");
    const badgeLote02 = screen.getByTestId("badge-validade-LT-LOS-02");

    expect(badgeLote01).toHaveAttribute("data-cor-badge", "laranja");
    expect(badgeLote02).toHaveAttribute("data-cor-badge", "verde");
  });

  it("Cenário: Acionamento dos botões de ajuste rápido e ficha de rastreabilidade na linha do lote", () => {
    const onAbrirAjuste = vi.fn();
    const onAbrirRastreabilidade = vi.fn();

    render(
      <TabelaSaldosEstoque
        medicamentos={MEDICAMENTOS_MOCK}
        carregando={false}
        onAbrirAjuste={onAbrirAjuste}
        onAbrirRastreabilidade={onAbrirRastreabilidade}
      />,
    );

    fireEvent.click(screen.getByTestId("btn-expandir-med-losartana"));

    fireEvent.click(screen.getByTestId("btn-ajuste-lote-LT-LOS-01"));
    expect(onAbrirAjuste).toHaveBeenCalledWith(
      expect.objectContaining({ numeroLote: "LT-LOS-01" }),
      expect.objectContaining({ produtoId: "med-losartana" }),
    );

    fireEvent.click(screen.getByTestId("btn-rastreabilidade-lote-LT-LOS-01"));
    expect(onAbrirRastreabilidade).toHaveBeenCalledWith(
      expect.objectContaining({ numeroLote: "LT-LOS-01" }),
      expect.objectContaining({ produtoId: "med-losartana" }),
    );
  });
});
