import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { IdentificacaoPacienteForm } from "./IdentificacaoPacienteForm";
import { pacienteService } from "../../services/paciente.service";

vi.mock("../../services/paciente.service", () => ({
  pacienteService: {
    buscarPacientes: vi.fn(),
    consultarHistorico: vi.fn(),
    cadastrarPaciente: vi.fn(),
  },
}));

describe("Funcionalidade: Formulário de Identificação do Paciente na UI (Camada D - DI-06)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Cenário: Bloqueio de avanço quando campos obrigatórios estão incompletos", async () => {
    const user = userEvent.setup();
    const onConfirmarMock = vi.fn();

    render(
      <IdentificacaoPacienteForm onConfirmarPaciente={onConfirmarMock} />,
    );

    // Preenche apenas o nome do paciente na tela
    const inputNome = screen.getByLabelText(/Nome Completo/i);
    await user.type(inputNome, "Maria da Silva");

    // Tenta avançar clicando no botão de submissão
    const botaoAvancar = screen.getByRole("button", {
      name: /Confirmar Identificação/i,
    });
    await user.click(botaoAvancar);

    // Deve exibir mensagens de erro para CNS, CPF e Data de Nascimento
    expect(
      screen.getByText(/O Cartão Nacional de Saúde \(CNS\) é obrigatório/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/O CPF do paciente é obrigatório/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A data de nascimento é obrigatória/i),
    ).toBeInTheDocument();

    // E o formulário deve impedir a submissão
    expect(onConfirmarMock).not.toHaveBeenCalled();
  });

  it("Cenário: Autocompletação de paciente ao digitar CPF cadastrado", async () => {
    const user = userEvent.setup();

    const pacienteExistente = {
      id: "pac-123",
      municipioId: "mun-parnaiba",
      cns: "700001122334455",
      cpf: "12345678909",
      nomeCompleto: "João Batista Souza",
      dataNascimento: "1984-05-15",
      ativo: true,
      criadoEm: "2026-01-10T10:00:00Z",
    };

    vi.mocked(pacienteService.buscarPacientes).mockResolvedValueOnce([
      pacienteExistente,
    ]);
    vi.mocked(pacienteService.consultarHistorico).mockResolvedValueOnce({
      paciente: pacienteExistente,
      itensConsumo: [
        {
          dispensacaoId: "disp-001",
          dataDispensacao: "2026-09-01",
          medicamentoId: "med-dipirona",
          medicamentoNome: "Dipirona 500mg",
          quantidadeDispensada: 10,
          posologia: "1 comprimido a cada 6h",
          diasDesdeUltimaRetirada: 35,
          possivelUsoIrracional: false,
        },
      ],
    });

    render(<IdentificacaoPacienteForm />);

    const inputCpf = screen.getByLabelText(/CPF/i);
    await user.type(inputCpf, "12345678909");

    await waitFor(() => {
      expect(pacienteService.buscarPacientes).toHaveBeenCalledWith(
        "12345678909",
      );
    });

    // Os campos "Nome Completo" e "Data de Nascimento" devem ser preenchidos automaticamente
    const inputNome = screen.getByLabelText(/Nome Completo/i) as HTMLInputElement;
    const inputData = screen.getByLabelText(
      /Data de Nascimento/i,
    ) as HTMLInputElement;

    await waitFor(() => {
      expect(inputNome.value).toBe("João Batista Souza");
      expect(inputData.value).toBe("15/05/1984");
    });

    // E o histórico de consumo do paciente deve ser renderizado
    expect(
      await screen.findByTestId("historico-consumo-card"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Dipirona 500mg/i)).toBeInTheDocument();
  });

  it("Cenário: Alerta visual de medicamento de uso contínuo retirado recentemente", async () => {
    render(
      <IdentificacaoPacienteForm
        historicoInicial={[
          {
            dispensacaoId: "disp-recente",
            dataDispensacao: "2026-10-20",
            medicamentoId: "med-losartana",
            medicamentoNome: "Losartana 50mg",
            quantidadeDispensada: 30,
            posologia: "1 cp ao dia",
            diasDesdeUltimaRetirada: 10,
            possivelUsoIrracional: true,
          },
        ]}
      />,
    );

    const alerta = await screen.findByTestId("alerta-retirada-recente");
    expect(alerta).toBeInTheDocument();
    expect(alerta).toHaveTextContent(/Losartana 50mg/i);
    expect(alerta).toHaveTextContent(/há 10 dias/i);
    expect(alerta).toHaveTextContent(
      /Ciclo padrão de 30 dias ainda em andamento/i,
    );
  });
});
