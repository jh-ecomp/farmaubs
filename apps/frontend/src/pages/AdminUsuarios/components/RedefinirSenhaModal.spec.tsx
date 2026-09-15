import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../test/test-utils";
import { RedefinirSenhaModal } from "./RedefinirSenhaModal";
import { authService } from "../../../services/api";

vi.mock("../../../services/api", () => ({
  authService: {
    redefinirSenhaProvisoria: vi.fn(),
  },
}));

describe("RedefinirSenhaModal — Ação do Administrador (RF001 / RF003)", () => {
  const mockAuthService = vi.mocked(authService);

  const mockUsuario = {
    id: "usr-carlos-123",
    municipioId: "mun-1",
    municipioNome: "Parnaíba",
    nomeCompleto: "Carlos Silva",
    email: "carlos.silva@farmaubs.dev",
    perfilCodigo: "FARMACEUTICO",
    unidades: [],
    ativo: true,
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não deve renderizar quando isOpen for false", () => {
    renderWithProviders(
      <RedefinirSenhaModal
        isOpen={false}
        usuario={mockUsuario}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("deve renderizar os dados do usuário e permitir gerar senha segura automaticamente", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <RedefinirSenhaModal
        isOpen={true}
        usuario={mockUsuario}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Carlos Silva/i)).toBeInTheDocument();

    const inputSenha = screen.getByPlaceholderText(
      /Clique em Gerar Senha ou digite aqui.../i,
    ) as HTMLInputElement;
    expect(inputSenha.value).toBe("");

    // Clica no botão para gerar senha segura
    const btnGerar = screen.getByRole("button", {
      name: /Gerar Senha Segura/i,
    });
    await user.click(btnGerar);

    expect(inputSenha.value.length).toBeGreaterThanOrEqual(8);
  });

  it("deve emitir a senha provisória, exibir estado de sucesso e permitir copiar", async () => {
    const user = userEvent.setup();
    const onCloseMock = vi.fn();
    const onSuccessMock = vi.fn();

    // Mock da API de clipboard
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextMock,
      },
      configurable: true,
      writable: true,
    });

    mockAuthService.redefinirSenhaProvisoria.mockResolvedValueOnce({
      usuarioId: "usr-carlos-123",
      senhaProvisoria: "SenhaSegura@2026",
      mensagem: "Senha provisória gerada",
    });

    renderWithProviders(
      <RedefinirSenhaModal
        isOpen={true}
        usuario={mockUsuario}
        onClose={onCloseMock}
        onSuccess={onSuccessMock}
      />,
    );

    const btnConfirmar = screen.getByRole("button", {
      name: /Confirmar Emissão/i,
    });
    await user.click(btnConfirmar);

    await waitFor(() => {
      expect(mockAuthService.redefinirSenhaProvisoria).toHaveBeenCalledTimes(1);
    });

    // Deve exibir o estado de sucesso
    expect(
      screen.getByText(/A senha provisória foi gerada com sucesso/i),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("SenhaSegura@2026")).toBeInTheDocument();
    expect(
      screen.getByText(/No próximo acesso, ele será obrigado a cadastrar/i),
    ).toBeInTheDocument();

    // Clicar em copiar
    const btnCopiar = screen.getByRole("button", { name: /Copiar Senha/i });
    await user.click(btnCopiar);

    expect(writeTextMock).toHaveBeenCalledWith("SenhaSegura@2026");
    expect(screen.getByText("Copiado!")).toBeInTheDocument();

    // Clicar em Concluir
    const btnConcluir = screen.getByRole("button", { name: /Concluir/i });
    await user.click(btnConcluir);
    expect(onCloseMock).toHaveBeenCalled();
  });
});
