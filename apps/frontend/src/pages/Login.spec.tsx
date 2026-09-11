import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Login from "./Login";
import { renderWithProviders } from "../test/test-utils";
import { authService, AuthError } from "../services/api";
import type { LoginResponse } from "../types/auth";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../services/api", async () => {
  const actual =
    await vi.importActual<typeof import("../services/api")>("../services/api");
  return {
    ...actual,
    authService: {
      login: vi.fn(),
      renovarSessao: vi.fn(),
    },
  };
});

describe("Login Component — Camada D (ADR-030 / #167)", () => {
  const mockAuthService = vi.mocked(authService);

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  describe("1. Renderização Inicial e Elementos Acessíveis", () => {
    it("deve renderizar o título, campos de entrada, ícones e botão de acesso", () => {
      renderWithProviders(<Login />);

      expect(
        screen.getByRole("heading", { name: /acesso ao sistema/i, level: 1 }),
      ).toBeInTheDocument();

      const inputEmail = screen.getByLabelText(/e-mail institucional/i);
      expect(inputEmail).toBeInTheDocument();
      expect(inputEmail).toHaveAttribute("type", "email");
      expect(inputEmail).toHaveAttribute("aria-required", "true");

      const inputSenha = screen.getByLabelText(/^senha/i);
      expect(inputSenha).toBeInTheDocument();
      expect(inputSenha).toHaveAttribute("type", "password");
      expect(inputSenha).toHaveAttribute("aria-required", "true");

      const btnSubmit = screen.getByRole("button", {
        name: /entrar no farmaubs/i,
      });
      expect(btnSubmit).toBeInTheDocument();
      expect(btnSubmit).not.toBeDisabled();
    });

    it("deve renderizar o botão 'Esqueceu sua senha?' e o suporte da CAF", () => {
      renderWithProviders(<Login />);

      const btnForgot = screen.getByRole("button", {
        name: /esqueceu sua senha\?/i,
      });
      expect(btnForgot).toBeInTheDocument();

      expect(
        screen.getByText(/solicite cadastro junto à coordenação caf/i),
      ).toBeInTheDocument();
    });
  });

  describe("2. Validação Client-side (Zod / React Hook Form)", () => {
    it("deve exibir mensagens de erro obrigatório ao submeter campos vazios e não chamar a API", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Login />);

      const btnSubmit = screen.getByRole("button", {
        name: /entrar no farmaubs/i,
      });
      await user.click(btnSubmit);

      await waitFor(() => {
        expect(screen.getByText("O e-mail é obrigatório.")).toBeInTheDocument();
        expect(screen.getByText("A senha é obrigatória.")).toBeInTheDocument();
      });

      expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it("deve validar formato de e-mail inválido", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Login />);

      const inputEmail = screen.getByLabelText(/e-mail institucional/i);
      const inputSenha = screen.getByLabelText(/^senha/i);
      const btnSubmit = screen.getByRole("button", {
        name: /entrar no farmaubs/i,
      });

      await user.type(inputEmail, "email-invalido");
      await user.type(inputSenha, "SenhaSegura123");
      await user.click(btnSubmit);

      await waitFor(() => {
        expect(
          screen.getByText("Formato de e-mail inválido."),
        ).toBeInTheDocument();
      });

      expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it("deve exigir que a senha tenha no mínimo 8 caracteres", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Login />);

      const inputEmail = screen.getByLabelText(/e-mail institucional/i);
      const inputSenha = screen.getByLabelText(/^senha/i);
      const btnSubmit = screen.getByRole("button", {
        name: /entrar no farmaubs/i,
      });

      await user.type(inputEmail, "farmaceutico@saude.gov.br");
      await user.type(inputSenha, "12345");
      await user.click(btnSubmit);

      await waitFor(() => {
        expect(
          screen.getByText("A senha deve ter no mínimo 8 caracteres."),
        ).toBeInTheDocument();
      });

      expect(mockAuthService.login).not.toHaveBeenCalled();
    });
  });

  describe("3. Estado de Carregamento (Loading State)", () => {
    it("deve exibir 'Entrando...', desabilitar o botão e aplicar aria-busy='true' durante a submissão", async () => {
      const user = userEvent.setup();

      // Cria uma promise pendente que simula latência de rede
      let resolver: (val: LoginResponse) => void;
      mockAuthService.login.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolver = resolve;
          }),
      );

      renderWithProviders(<Login />);

      const inputEmail = screen.getByLabelText(/e-mail institucional/i);
      const inputSenha = screen.getByLabelText(/^senha/i);
      const btnSubmit = screen.getByRole("button", {
        name: /entrar no farmaubs/i,
      });

      await user.type(inputEmail, "farmaceutico@saude.gov.br");
      await user.type(inputSenha, "SenhaForte123@");
      await user.click(btnSubmit);

      // Botão deve entrar no estado de carregamento
      expect(
        screen.getByRole("button", { name: /entrando\.\.\./i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /entrando\.\.\./i }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: /entrando\.\.\./i }),
      ).toHaveAttribute("aria-busy", "true");

      // Finaliza a requisição
      resolver!({
        token: "fake-token",
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        ttlSeconds: 3600,
        warningSeconds: 300,
        usuarioId: "123",
        redirectUrl: "/em-desenvolvimento",
        usuario: {
          nome: "Farmacêutico",
          email: "farmaceutico@saude.gov.br",
          perfil: ["FARMACEUTICO"],
          municipio_id: 1,
          unidade_id: 1,
        },
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/em-desenvolvimento");
      });
    });
  });

  describe("4. Tratamento de Erros da API", () => {
    it("deve exibir mensagem de credenciais inválidas (401) em alerta acessível", async () => {
      const user = userEvent.setup();
      mockAuthService.login.mockRejectedValueOnce(
        new AuthError("E-mail ou senha incorretos.", "INVALID_CREDENTIALS"),
      );

      renderWithProviders(<Login />);

      await user.type(
        screen.getByLabelText(/e-mail institucional/i),
        "farmaceutico@saude.gov.br",
      );
      await user.type(screen.getByLabelText(/^senha/i), "SenhaIncorreta123");
      await user.click(
        screen.getByRole("button", { name: /entrar no farmaubs/i }),
      );

      const alerta = await screen.findByRole("alert");
      expect(alerta).toHaveTextContent("E-mail ou senha incorretos.");
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("deve exibir mensagem de conta temporariamente bloqueada (429)", async () => {
      const user = userEvent.setup();
      mockAuthService.login.mockRejectedValueOnce(
        new AuthError(
          "Conta bloqueada. Tente novamente em 15 minuto(s).",
          "ACCOUNT_LOCKED",
          { minutosRestantes: 15 },
        ),
      );

      renderWithProviders(<Login />);

      await user.type(
        screen.getByLabelText(/e-mail institucional/i),
        "farmaceutico@saude.gov.br",
      );
      await user.type(screen.getByLabelText(/^senha/i), "SenhaIncorreta123");
      await user.click(
        screen.getByRole("button", { name: /entrar no farmaubs/i }),
      );

      const alerta = await screen.findByRole("alert");
      expect(alerta).toHaveTextContent(
        "Conta bloqueada. Tente novamente em 15 minuto(s).",
      );
    });

    it("deve exibir erro de indisponibilidade de rede ou conexão", async () => {
      const user = userEvent.setup();
      mockAuthService.login.mockRejectedValueOnce(
        new AuthError(
          "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
          "NETWORK_ERROR",
        ),
      );

      renderWithProviders(<Login />);

      await user.type(
        screen.getByLabelText(/e-mail institucional/i),
        "farmaceutico@saude.gov.br",
      );
      await user.type(screen.getByLabelText(/^senha/i), "SenhaValida123@");
      await user.click(
        screen.getByRole("button", { name: /entrar no farmaubs/i }),
      );

      const alerta = await screen.findByRole("alert");
      expect(alerta).toHaveTextContent(
        "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
      );
    });
  });

  describe("5. Sucesso e Chamada da Mutação", () => {
    it("deve chamar authService.login com email normalizado e senha, e redirecionar para /em-desenvolvimento", async () => {
      const user = userEvent.setup();
      mockAuthService.login.mockResolvedValueOnce({
        token: "token-sessao-123",
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        ttlSeconds: 3600,
        warningSeconds: 300,
        usuarioId: "uuid-user-1",
        redirectUrl: "/em-desenvolvimento",
        usuario: {
          nome: "Maria Farmacêutica",
          email: "maria@saude.parnaiba.pi.gov.br",
          perfil: ["FARMACEUTICO"],
          municipio_id: 1,
          unidade_id: 1,
        },
      });

      renderWithProviders(<Login />);

      // Testa normalização: espaços extras e maiúsculas
      await user.type(
        screen.getByLabelText(/e-mail institucional/i),
        "  MARIA@saude.parnaiba.pi.gov.br  ",
      );
      await user.type(screen.getByLabelText(/^senha/i), "SegredoForte123@");
      await user.click(
        screen.getByRole("button", { name: /entrar no farmaubs/i }),
      );

      await waitFor(() => {
        expect(mockAuthService.login).toHaveBeenCalledWith({
          email: "maria@saude.parnaiba.pi.gov.br",
          senha: "SegredoForte123@",
        });
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/em-desenvolvimento");
      });
    });
  });

  describe("6. Funcionalidades Auxiliares de Interface", () => {
    it("deve alternar a visibilidade da senha entre 'password' e 'text' ao clicar no botão do olho", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Login />);

      const inputSenha = screen.getByLabelText(/^senha/i);
      const btnToggle = screen.getByRole("button", { name: /ver senha/i });

      expect(inputSenha).toHaveAttribute("type", "password");

      // Clica para exibir
      await user.click(btnToggle);
      expect(inputSenha).toHaveAttribute("type", "text");
      expect(
        screen.getByRole("button", { name: /ocultar senha/i }),
      ).toBeInTheDocument();

      // Clica para ocultar novamente
      await user.click(screen.getByRole("button", { name: /ocultar senha/i }));
      expect(inputSenha).toHaveAttribute("type", "password");
    });

    it("deve abrir o modal acessível 'FarmaUBS diz:' ao clicar em 'Esqueceu sua senha?'", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Login />);

      const btnForgot = screen.getByRole("button", {
        name: /esqueceu sua senha\?/i,
      });
      await user.click(btnForgot);

      expect(
        screen.getByRole("heading", { name: /farmaubs diz:/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/contate a coordenação caf/i),
      ).toBeInTheDocument();

      const btnEntendi = screen.getByRole("button", { name: /entendi/i });
      await user.click(btnEntendi);

      expect(
        screen.queryByRole("heading", { name: /farmaubs diz:/i }),
      ).not.toBeInTheDocument();
    });
  });
});
