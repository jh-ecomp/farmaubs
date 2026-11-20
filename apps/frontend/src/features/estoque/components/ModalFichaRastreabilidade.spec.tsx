import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type {
  LoteEstoqueDto,
  MedicamentoSaldoItemDto,
  RastreabilidadeLoteDto,
} from "@farmaubs/shared";
import { ModalFichaRastreabilidade } from "./ModalFichaRastreabilidade";

const LOTE_MOCK: LoteEstoqueDto = {
  id: "lote-1",
  numeroLote: "LT-LOS-01",
  fabricanteId: "fab-1",
  fabricanteNome: "Farmanguinhos",
  dataValidade: "2026-11-30",
  saldoAtual: 48,
  statusValidade: "MES_CORRENTE",
};

const MED_MOCK: MedicamentoSaldoItemDto = {
  produtoId: "med-1",
  nome: "Losartana Potássica 50mg",
  principioAtivo: "Losartana Potássica",
  formaFarmaceutica: "Comprimido",
  concentracao: "50mg",
  unidadeMedida: "comp",
  categoria: "ANTI-HIPERTENSIVO",
  saldoTotal: 48,
  statusEstoque: "REGULAR",
  lotes: [LOTE_MOCK],
};

const RASTREABILIDADE_MOCK: RastreabilidadeLoteDto = {
  lote: {
    id: "lote-1",
    numeroLote: "LT-LOS-01",
    dataValidade: "2026-11-30",
    dataCadastro: "2026-09-01T10:00:00.000Z",
    saldoAtual: 48,
    saldoInicial: 50,
    fabricanteNome: "Farmanguinhos",
  },
  medicamento: {
    id: "med-1",
    nome: "Losartana Potássica 50mg",
    principioAtivo: "Losartana Potássica",
    apresentacao: "50mg Comprimido",
  },
  movimentacoes: [
    {
      id: "mov-2",
      dataHora: "2026-11-20T11:00:00.000Z",
      tipoMovimentacao: "AJUSTE_SAIDA",
      operacao: "-",
      quantidade: 2,
      saldoResultante: 48,
      motivo: "AVARIA_FISICA",
      justificativa: "Blister danificado na prateleira",
      usuarioResponsavel: { id: "u-1", nome: "Dra. Maria das Graças" },
    },
    {
      id: "mov-1",
      dataHora: "2026-09-01T10:00:00.000Z",
      tipoMovimentacao: "ENTRADA_RECEBIMENTO",
      operacao: "+",
      quantidade: 50,
      saldoResultante: 50,
      documentoReferencia: "CAF-2026-0901",
      usuarioResponsavel: { id: "u-1", nome: "Dra. Maria das Graças" },
    },
  ],
};

describe("ModalFichaRastreabilidade — Linha do Tempo do Lote (ES-09 / ES-04 / RF028)", () => {
  it("Cenário: Renderiza metadados do lote e linha do tempo cronológica de movimentações", () => {
    const onFechar = vi.fn();

    render(
      <ModalFichaRastreabilidade
        aberto={true}
        lote={LOTE_MOCK}
        medicamento={MED_MOCK}
        dadosIniciais={RASTREABILIDADE_MOCK}
        onFechar={onFechar}
      />,
    );

    expect(
      screen.getByTestId("rastreabilidade-numero-lote"),
    ).toHaveTextContent("LT-LOS-01");
    expect(
      screen.getByText(/Blister danificado na prateleira/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/CAF-2026-0901/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("btn-concluir-rastreabilidade"));
    expect(onFechar).toHaveBeenCalledTimes(1);
  });
});
