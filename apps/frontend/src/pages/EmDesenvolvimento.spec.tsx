import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EmDesenvolvimento from "./EmDesenvolvimento";
import { renderWithProviders } from "../test/test-utils";

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

describe("EmDesenvolvimento Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("deve renderizar a mensagem padrão de desenvolvimento", () => {
    renderWithProviders(<EmDesenvolvimento />);

    expect(
      screen.getByRole("heading", {
        name: /funcionalidade em desenvolvimento/i,
      }),
    ).toBeInTheDocument();

    // Sem usuário logado, botão de logout não deve estar visível
    expect(
      screen.queryByRole("button", { name: /sair do sistema/i }),
    ).not.toBeInTheDocument();
  });

  it("deve renderizar o botão 'Sair do Sistema' quando usuário estiver autenticado e permitir logout", async () => {
    const user = userEvent.setup();

    localStorage.setItem("@FarmaUBS:token", "fake-token");
    localStorage.setItem(
      "@FarmaUBS:expiresAt",
      new Date(Date.now() + 3600_000).toISOString(),
    );
    localStorage.setItem(
      "@FarmaUBS:usuario",
      JSON.stringify({
        id: "usr-1",
        nome: "Farmacêutico",
        email: "farmaceutico@ubs.gov.br",
        perfil: ["FARMACEUTICO_RESPONSAVEL"],
        municipio_id: 1,
        unidade_id: 1,
      }),
    );

    renderWithProviders(<EmDesenvolvimento />);

    const btnLogout = screen.getByRole("button", { name: /sair do sistema/i });
    expect(btnLogout).toBeInTheDocument();

    await user.click(btnLogout);

    // Deve limpar o token e redirecionar para /login
    expect(localStorage.getItem("@FarmaUBS:token")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });
});
