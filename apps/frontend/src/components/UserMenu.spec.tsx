import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import { PerfilCodigo } from "@farmaubs/shared";
import { renderWithProviders } from "../test/test-utils";
import { UserMenu } from "./UserMenu";

describe("UserMenu — Exibição de Perfil e Fluxo de Logout Seguro (RF004 / AC-21 / WCAG 2.1 AA)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  const setupUserSession = (perfilCodigo: PerfilCodigo) => {
    localStorage.setItem("@FarmaUBS:token", "fake-session-jwt");
    localStorage.setItem(
      "@FarmaUBS:usuario",
      JSON.stringify({
        id: "usr-dr-carlos",
        nome: "Dr. Carlos Silva",
        nomeCompleto: "Dr. Carlos Silva",
        email: "carlos.silva@ubs.gov.br",
        perfil: [perfilCodigo],
        perfilCodigo: perfilCodigo,
        deveTrocarSenha: false,
      }),
    );
    localStorage.setItem(
      "@FarmaUBS:expiresAt",
      new Date(Date.now() + 3600_000).toISOString(),
    );
  };

  it("deve renderizar o nome do usuário, e-mail e badge do perfil de acesso", () => {
    setupUserSession(PerfilCodigo.FARMACEUTICO_RESPONSAVEL);

    renderWithProviders(<UserMenu />);

    expect(screen.getByText("Dr. Carlos Silva")).toBeInTheDocument();
    expect(screen.getByText("carlos.silva@ubs.gov.br")).toBeInTheDocument();
    expect(screen.getByText("Farmacêutico Responsável")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sair/i })).toBeInTheDocument();
  });

  it("deve acionar o logout, limpar a sessão e navegar para /login com substituição de histórico ao clicar em Sair", async () => {
    const user = userEvent.setup();
    setupUserSession(PerfilCodigo.ADMINISTRADOR);

    renderWithProviders(
      <Routes>
        <Route path="/login" element={<div>Tela de Login Pública</div>} />
        <Route path="/dashboard" element={<UserMenu />} />
      </Routes>,
      { initialEntries: ["/dashboard"] },
    );

    const botaoSair = screen.getByRole("button", { name: /sair/i });
    await user.click(botaoSair);

    // Deve redirecionar para /login
    expect(screen.getByText("Tela de Login Pública")).toBeInTheDocument();

    // Deve ter limpado os tokens do localStorage
    expect(localStorage.getItem("@FarmaUBS:token")).toBeNull();
    expect(localStorage.getItem("@FarmaUBS:usuario")).toBeNull();
  });

  it("deve permitir acionar o logout via navegação por teclado (Enter)", async () => {
    const user = userEvent.setup();
    setupUserSession(PerfilCodigo.GERENTE);

    renderWithProviders(
      <Routes>
        <Route path="/login" element={<div>Tela de Login Pública</div>} />
        <Route path="/dashboard" element={<UserMenu />} />
      </Routes>,
      { initialEntries: ["/dashboard"] },
    );

    const botaoSair = screen.getByRole("button", { name: /sair/i });
    botaoSair.focus();
    expect(botaoSair).toHaveFocus();

    await user.keyboard("{Enter}");

    expect(screen.getByText("Tela de Login Pública")).toBeInTheDocument();
  });
});
