import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItemRecebimentoForm } from "./ItemRecebimentoForm";
import { recebimentoService } from "../../../services/recebimento.service";
import type { ProdutoCatalogoResponseDto } from "@farmaubs/shared";

vi.mock("../../../services/recebimento.service", () => ({
  recebimentoService: {
    buscarProdutosCatalogo: vi.fn(),
    listarFabricantes: vi.fn(),
    cadastrarFabricante: vi.fn(),
  },
}));

const PRODUTOS_MOCK: ProdutoCatalogoResponseDto[] = [
  {
    id: "prod-losartana-50",
    principioAtivo: "Losartana Potássica",
    denominacaoGenerica: "Losartana Potássica",
    dosagem: "50mg",
    concentracao: "50mg",
    formaFarmaceutica: "Comprimido",
    unidadeMedida: "COMP",
    categoria: "Anti-hipertensivos",
    controlado: false,
    antimicrobiano: false,
    ativo: true,
  },
];

const FABRICANTES_MOCK = [
  {
    id: "fab-medley",
    razaoSocial: "Sanofi Medley Farmacêutica Ltda",
    nomeFantasia: "Medley",
    cnpj: "10.588.595/0010-92",
    ativo: true,
  },
];

describe("RE-06: ItemRecebimentoForm (BDD Camada D)", () => {
  const DATA_REF = new Date("2026-05-01T12:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(recebimentoService.listarFabricantes).mockResolvedValue(
      FABRICANTES_MOCK,
    );
    vi.mocked(recebimentoService.buscarProdutosCatalogo).mockResolvedValue(
      PRODUTOS_MOCK,
    );
  });

  it("Cenário 1: Busca textual de medicamento com preenchimento de fabricante e lote válido", async () => {
    const user = userEvent.setup();
    const onAdicionarItem = vi.fn();

    render(
      <ItemRecebimentoForm
        onAdicionarItem={onAdicionarItem}
        dataReferencia={DATA_REF}
      />,
    );

    const inputMedicamento = screen.getByLabelText(/Medicamento/i);
    await user.type(inputMedicamento, "Losar");

    await waitFor(() => {
      expect(recebimentoService.buscarProdutosCatalogo).toHaveBeenCalledWith(
        "Losar",
      );
      expect(
        screen.getByRole("option", {
          name: /Losartana Potássica 50mg - Comprimido/i,
        }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("option", {
        name: /Losartana Potássica 50mg - Comprimido/i,
      }),
    );

    const selectFabricante = screen.getByLabelText(
      /Fabricante \/ Laboratório/i,
    );
    await user.selectOptions(selectFabricante, "fab-medley");

    const inputLote = screen.getByLabelText(/Código do Lote/i);
    await user.type(inputLote, "LOTE-2026A");

    const inputValidade = screen.getByLabelText(/Data de Validade/i);
    await user.type(inputValidade, "2027-08-15");

    const inputQuantidade = screen.getByLabelText(/Quantidade Recebida/i);
    await user.type(inputQuantidade, "500");

    const botaoAdicionar = screen.getByRole("button", {
      name: /Adicionar Item à Guia/i,
    });
    expect(botaoAdicionar).not.toBeDisabled();

    await user.click(botaoAdicionar);

    expect(onAdicionarItem).toHaveBeenCalledTimes(1);
    expect(onAdicionarItem).toHaveBeenCalledWith(
      expect.objectContaining({
        produtoId: "prod-losartana-50",
        produtoNome: "Losartana Potássica",
        fabricanteId: "fab-medley",
        fabricanteNome: "Medley",
        numeroLote: "LOTE-2026A",
        dataValidade: "2027-08-15",
        quantidadeRecebida: 500,
        validadeCurta: false,
      }),
    );

    // Campos limpos para próxima digitação
    expect(inputMedicamento).toHaveValue("");
    expect(inputLote).toHaveValue("");
    expect(inputQuantidade).toHaveValue(null);
  });

  it("Cenário 2: Cadastro rápido de novo fabricante durante o recebimento", async () => {
    const user = userEvent.setup();
    const novoFabricante = {
      id: "fab-prati",
      razaoSocial: "Prati-Donaduzzi & Cia Ltda",
      nomeFantasia: "Prati-Donaduzzi",
      cnpj: "73.856.593/0001-66",
      ativo: true,
    };
    vi.mocked(recebimentoService.cadastrarFabricante).mockResolvedValue(
      novoFabricante,
    );

    render(
      <ItemRecebimentoForm
        onAdicionarItem={vi.fn()}
        dataReferencia={DATA_REF}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /\+ Novo Fabricante/i }),
    );

    const dialog = screen.getByRole("dialog", {
      name: /Cadastrar Novo Fabricante/i,
    });
    expect(dialog).toBeInTheDocument();

    await user.type(
      screen.getByLabelText(/Nome Fantasia \/ Laboratório/i),
      "Prati-Donaduzzi",
    );
    await user.type(
      screen.getByLabelText(/Razão Social/i),
      "Prati-Donaduzzi & Cia Ltda",
    );

    await user.click(
      screen.getByRole("button", { name: /Salvar Fabricante/i }),
    );

    await waitFor(() => {
      expect(recebimentoService.cadastrarFabricante).toHaveBeenCalledWith({
        nomeFantasia: "Prati-Donaduzzi",
        razaoSocial: "Prati-Donaduzzi & Cia Ltda",
        cnpj: null,
      });
    });

    const selectFabricante = screen.getByLabelText(
      /Fabricante \/ Laboratório/i,
    ) as HTMLSelectElement;
    expect(selectFabricante.value).toBe("fab-prati");
  });

  it("Cenário 3: Bloqueio de lote com data de validade vencida", async () => {
    const user = userEvent.setup();
    const onAdicionarItem = vi.fn();

    render(
      <ItemRecebimentoForm
        onAdicionarItem={onAdicionarItem}
        dataReferencia={DATA_REF}
      />,
    );

    await user.type(screen.getByLabelText(/Medicamento/i), "Losar");
    await waitFor(() =>
      expect(
        screen.getByRole("option", {
          name: /Losartana Potássica 50mg - Comprimido/i,
        }),
      ).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("option", {
        name: /Losartana Potássica 50mg - Comprimido/i,
      }),
    );
    await user.selectOptions(
      screen.getByLabelText(/Fabricante \/ Laboratório/i),
      "fab-medley",
    );
    await user.type(screen.getByLabelText(/Código do Lote/i), "LOTE-VENCIDO");
    await user.type(screen.getByLabelText(/Data de Validade/i), "2025-01-15");
    await user.type(screen.getByLabelText(/Quantidade Recebida/i), "100");

    expect(
      screen.getByText("A data de validade deve ser futura"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Adicionar Item à Guia/i }),
    ).toBeDisabled();
    expect(onAdicionarItem).not.toHaveBeenCalled();
  });

  it("Cenário 4: Alerta amarelo para lote com validade curta (< 180 dias)", async () => {
    const user = userEvent.setup();
    const onAdicionarItem = vi.fn();

    render(
      <ItemRecebimentoForm
        onAdicionarItem={onAdicionarItem}
        dataReferencia={DATA_REF}
      />,
    );

    await user.type(screen.getByLabelText(/Medicamento/i), "Losar");
    await waitFor(() =>
      expect(
        screen.getByRole("option", {
          name: /Losartana Potássica 50mg - Comprimido/i,
        }),
      ).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("option", {
        name: /Losartana Potássica 50mg - Comprimido/i,
      }),
    );
    await user.selectOptions(
      screen.getByLabelText(/Fabricante \/ Laboratório/i),
      "fab-medley",
    );
    await user.type(screen.getByLabelText(/Código do Lote/i), "LOTE-CURTO");
    // 90 dias após 2026-05-01 => 2026-07-30 (< 180 dias)
    await user.type(screen.getByLabelText(/Data de Validade/i), "2026-07-30");
    await user.type(screen.getByLabelText(/Quantidade Recebida/i), "200");

    expect(
      screen.getByText("Atenção: lote com validade inferior a 6 meses"),
    ).toBeInTheDocument();

    const botaoAdicionar = screen.getByRole("button", {
      name: /Adicionar Item à Guia/i,
    });
    expect(botaoAdicionar).not.toBeDisabled();

    await user.click(botaoAdicionar);

    expect(onAdicionarItem).toHaveBeenCalledWith(
      expect.objectContaining({
        numeroLote: "LOTE-CURTO",
        validadeCurta: true,
      }),
    );
  });
});
