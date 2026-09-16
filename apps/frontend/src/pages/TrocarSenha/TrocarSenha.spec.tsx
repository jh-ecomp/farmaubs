import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import { renderWithProviders } from "../../test/test-utils";
import TrocarSenha from "./index";
import { authService, AuthError } from "../../services/api";

vi.mock("../../services/api", async () => {
  const actual =
    await vi.importActual<typeof import("../../services/api")>(
      "../../services/api",
    );
  return {
    ...actual,
    authService: {
      ...actual.authService,
      trocarSenha: vi.fn(),
    },
  };
});

describe("TrocarSenha — Fluxo de Troca Obrigatória no Frontend (Camada D / RF003)", () => {
  const mockAuthService = vi.mocked(authService);

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();

    localStorage.setItem("@FarmaUBS:token", "fake-token-123");
    localStorage.setItem(
      "@FarmaUBS:usuario",
      JSON.stringify({
        id: "usr-carlos-123",
        nome: "Carlos Silva",
        email: "carlos.silva@farmaubs.dev",
        perfil: ["FARMACEUTICO"],
        municipio_id: 1,
        unidade_id: 1,
        deveTrocarSenha: true,
      }),
    );
  });

  it("Cenário 1: deve renderizar os elementos da tela e o aviso explicativo", () => {
    renderWithProviders(<TrocarSenha />, {
      initialEntries: ["/trocar-senha"],
    });

    expect(
      screen.getByRole("heading", { name: /Primeiro Acesso ao FarmaUBS/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Defina sua nova senha pessoal para continuar/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Nova Senha Pessoal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirmar Nova Senha/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Confirmar Nova Senha/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Cancelar e Sair/i }),
    ).toBeInTheDocument();
  });

  it("Cenário 2: Validação de força de senha no formulário com senha fraca", async () => {
    const user = userEvent.setup();

    renderWithProviders(<TrocarSenha />, {
      initialEntries: ["/trocar-senha"],
    });

    const inputNovaSenha = screen.getByLabelText(/Nova Senha Pessoal/i);
    const btnConfirmar = screen.getByRole("button", {
      name: /Confirmar Nova Senha/i,
    });

    // Digita senha fraca "12345"
    await user.type(inputNovaSenha, "12345");

    await waitFor(() => {
      expect(
        screen.getByText(/A senha deve ter no mínimo 8 caracteres/i),
      ).toBeInTheDocument();
    });

    expect(btnConfirmar).toBeDisabled();
    expect(screen.getByText(/Senha Fraca/i)).toBeInTheDocument();
  });

  it("Cenário 3: Confirmação de senha divergente exibe erro e não submete", async () => {
    const user = userEvent.setup();

    renderWithProviders(<TrocarSenha />, {
      initialEntries: ["/trocar-senha"],
    });

    const inputNovaSenha = screen.getByLabelText(/Nova Senha Pessoal/i);
    const inputConfirmacao = screen.getByLabelText(/Confirmar Nova Senha/i);

    await user.type(inputNovaSenha, "NovaSenha@2026");
    await user.type(inputConfirmacao, "OutraSenha@2026");

    await waitFor(() => {
      expect(screen.getByText(/As senhas não coincidem/i)).toBeInTheDocument();
    });

    const btnConfirmar = screen.getByRole("button", {
      name: /Confirmar Nova Senha/i,
    });
    expect(btnConfirmar).toBeDisabled();
    expect(mockAuthService.trocarSenha).not.toHaveBeenCalled();
  });

  it("Cenário 4: Troca de senha realizada com sucesso e redirecionamento", async () => {
    const user = userEvent.setup();

    mockAuthService.trocarSenha.mockResolvedValueOnce({
      mensagem: "Senha alterada com sucesso",
    });

    renderWithProviders(
      <Routes>
        <Route path="/trocar-senha" element={<TrocarSenha />} />
        <Route path="/dashboard" element={<div>Painel Dashboard</div>} />
      </Routes>,
      {
        initialEntries: ["/trocar-senha"],
      },
    );

    const inputNovaSenha = screen.getByLabelText(/Nova Senha Pessoal/i);
    const inputConfirmacao = screen.getByLabelText(/Confirmar Nova Senha/i);
    const btnConfirmar = screen.getByRole("button", {
      name: /Confirmar Nova Senha/i,
    });

    await user.type(inputNovaSenha, "NovaSenhaForte@2026");
    await user.type(inputConfirmacao, "NovaSenhaForte@2026");

    await waitFor(() => {
      expect(btnConfirmar).not.toBeDisabled();
    });

    await user.click(btnConfirmar);

    await waitFor(() => {
      expect(mockAuthService.trocarSenha).toHaveBeenCalledWith({
        novaSenha: "NovaSenhaForte@2026",
        confirmacaoSenha: "NovaSenhaForte@2026",
      });
    });

    expect(
      screen.getByText(/Senha redefinida com sucesso!/i),
    ).toBeInTheDocument();

    // Verifica se o estado local do usuário foi atualizado removendo a flag
    await waitFor(() => {
      const savedUser = JSON.parse(
        localStorage.getItem("@FarmaUBS:usuario") || "{}",
      );
      expect(savedUser.deveTrocarSenha).toBe(false);
    });
  });

  it("Cenário 5: Usuário clica em cancelar e efetua logout com redirecionamento para login", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <Routes>
        <Route path="/trocar-senha" element={<TrocarSenha />} />
        <Route path="/login" element={<div>Página de Login</div>} />
      </Routes>,
      {
        initialEntries: ["/trocar-senha"],
      },
    );

    const btnCancelar = screen.getByRole("button", {
      name: /Cancelar e Sair/i,
    });
    await user.click(btnCancelar);

    await waitFor(() => {
      expect(screen.getByText("Página de Login")).toBeInTheDocument();
    });

    expect(localStorage.getItem("@FarmaUBS:token")).toBeNull();
  });

  it("Cenário 6: Erro da API ao tentar reutilizar a senha provisória", async () => {
    const user = userEvent.setup();

    mockAuthService.trocarSenha.mockRejectedValueOnce(
      new AuthError(
        "A nova senha não pode ser idêntica à senha provisória.",
        "VALIDATION_ERROR",
      ),
    );

    renderWithProviders(<TrocarSenha />, {
      initialEntries: ["/trocar-senha"],
    });

    const inputNovaSenha = screen.getByLabelText(/Nova Senha Pessoal/i);
    const inputConfirmacao = screen.getByLabelText(/Confirmar Nova Senha/i);
    const btnConfirmar = screen.getByRole("button", {
      name: /Confirmar Nova Senha/i,
    });

    await user.type(inputNovaSenha, "SenhaProvisoria@2026");
    await user.type(inputConfirmacao, "SenhaProvisoria@2026");

    await waitFor(() => {
      expect(btnConfirmar).not.toBeDisabled();
    });

    await user.click(btnConfirmar);

    await waitFor(() => {
      expect(
        screen.getByText(
          /A nova senha não pode ser idêntica à senha provisória/i,
        ),
      ).toBeInTheDocument();
    });

    // Campos não devem ser apagados destrutivamente
    expect(inputNovaSenha).toHaveValue("SenhaProvisoria@2026");
  });

  it("deve permitir alternar a visibilidade da nova senha e confirmação", async () => {
    const user = userEvent.setup();

    renderWithProviders(<TrocarSenha />, {
      initialEntries: ["/trocar-senha"],
    });

    const inputNovaSenha = screen.getByLabelText(/Nova Senha Pessoal/i);
    const btnAlternar = screen.getByRole("button", {
      name: /Visualizar nova senha/i,
    });

    expect(inputNovaSenha).toHaveAttribute("type", "password");

    await user.click(btnAlternar);
    expect(inputNovaSenha).toHaveAttribute("type", "text");

    await user.click(btnAlternar);
    expect(inputNovaSenha).toHaveAttribute("type", "password");
  });
});
