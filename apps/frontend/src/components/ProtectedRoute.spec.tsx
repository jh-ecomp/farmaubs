import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { Routes, Route, useLocation } from "react-router-dom";
import { renderWithProviders } from "../test/test-utils";
import ProtectedRoute from "./ProtectedRoute";

// Helper component para capturar o state da navegação na tela de Login
function LoginCapture() {
  const location = useLocation();
  return (
    <div>
      <span>Tela de Login</span>
      <span data-testid="from-path">
        {(location.state as any)?.from?.pathname || "none"}
      </span>
    </div>
  );
}

describe("ProtectedRoute — Guarda de Autenticação e Anti-Desvio (RF002 / RF003 / NF009 / NF012)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("deve interceptar navegação de usuário não autenticado, redirecionar para /login e salvar location.state.from", () => {
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginCapture />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <div>Painel Principal</div>
            </ProtectedRoute>
          }
        />
      </Routes>,
      { initialEntries: ["/dashboard"] },
    );

    expect(screen.getByText("Tela de Login")).toBeInTheDocument();
    expect(screen.getByTestId("from-path")).toHaveTextContent("/dashboard");
    expect(screen.queryByText("Painel Principal")).not.toBeInTheDocument();
  });

  it("deve exibir splash acessível (role=status) e não renderizar conteúdo protegido durante status carregando", () => {
    // Configura token sem usuário em cache para forçar status inicial 'carregando'
    localStorage.setItem("@FarmaUBS:token", "pending-token");
    localStorage.setItem(
      "@FarmaUBS:expiresAt",
      new Date(Date.now() + 3600_000).toISOString(),
    );

    renderWithProviders(
      <Routes>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <div>Painel Principal</div>
            </ProtectedRoute>
          }
        />
      </Routes>,
      { initialEntries: ["/dashboard"] },
    );

    // O elemento de carregamento com role="status" deve estar visível
    const statusElement = screen.getByRole("status");
    expect(statusElement).toBeInTheDocument();
    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
    // O conteúdo da rota protegida não pode ser renderizado
    expect(screen.queryByText("Painel Principal")).not.toBeInTheDocument();
  });

  it("deve interceptar navegação e redirecionar para /trocar-senha-obrigatoria se usuario.deveTrocarSenha for true", () => {
    localStorage.setItem("@FarmaUBS:token", "fake-jwt-token");
    localStorage.setItem(
      "@FarmaUBS:usuario",
      JSON.stringify({
        id: "usr-1",
        nome: "Carlos Silva",
        email: "carlos@ubs.gov.br",
        perfil: ["FARMACEUTICO_RESIDENTE"],
        perfilCodigo: "FARMACEUTICO_RESIDENTE",
        municipio_id: 1,
        unidade_id: 1,
        deveTrocarSenha: true,
      }),
    );
    localStorage.setItem(
      "@FarmaUBS:expiresAt",
      new Date(Date.now() + 3600_000).toISOString(),
    );

    renderWithProviders(
      <Routes>
        <Route
          path="/estoque"
          element={
            <ProtectedRoute>
              <div>Controle de Estoque</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/trocar-senha-obrigatoria"
          element={<div>Tela de Troca Obrigatória de Senha</div>}
        />
      </Routes>,
      { initialEntries: ["/estoque"] },
    );

    expect(
      screen.getByText("Tela de Troca Obrigatória de Senha"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Controle de Estoque")).not.toBeInTheDocument();
  });

  it("deve redirecionar para /dashboard se usuário sem pendência de troca tentar acessar /trocar-senha-obrigatoria", () => {
    localStorage.setItem("@FarmaUBS:token", "fake-jwt-token");
    localStorage.setItem(
      "@FarmaUBS:usuario",
      JSON.stringify({
        id: "usr-2",
        nome: "Mariana Santos",
        email: "mariana@ubs.gov.br",
        perfil: ["FARMACEUTICO_RESPONSAVEL"],
        perfilCodigo: "FARMACEUTICO_RESPONSAVEL",
        municipio_id: 1,
        unidade_id: 1,
        deveTrocarSenha: false,
      }),
    );
    localStorage.setItem(
      "@FarmaUBS:expiresAt",
      new Date(Date.now() + 3600_000).toISOString(),
    );

    renderWithProviders(
      <Routes>
        <Route
          path="/trocar-senha-obrigatoria"
          element={
            <ProtectedRoute>
              <div>Tela de Troca Obrigatória de Senha</div>
            </ProtectedRoute>
          }
        />
        <Route path="/dashboard" element={<div>Painel Principal</div>} />
      </Routes>,
      { initialEntries: ["/trocar-senha-obrigatoria"] },
    );

    expect(screen.getByText("Painel Principal")).toBeInTheDocument();
    expect(
      screen.queryByText("Tela de Troca Obrigatória de Senha"),
    ).not.toBeInTheDocument();
  });

  it("deve permitir acesso normalmente à rota protegida quando o usuário estiver autenticado e sem pendência", () => {
    localStorage.setItem("@FarmaUBS:token", "fake-jwt-token");
    localStorage.setItem(
      "@FarmaUBS:usuario",
      JSON.stringify({
        id: "usr-3",
        nome: "Dra. Beatriz",
        email: "beatriz@ubs.gov.br",
        perfil: ["FARMACEUTICO_RESPONSAVEL"],
        perfilCodigo: "FARMACEUTICO_RESPONSAVEL",
        municipio_id: 1,
        unidade_id: 1,
        deveTrocarSenha: false,
      }),
    );
    localStorage.setItem(
      "@FarmaUBS:expiresAt",
      new Date(Date.now() + 3600_000).toISOString(),
    );

    renderWithProviders(
      <Routes>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <div>Painel Principal</div>
            </ProtectedRoute>
          }
        />
      </Routes>,
      { initialEntries: ["/dashboard"] },
    );

    expect(screen.getByText("Painel Principal")).toBeInTheDocument();
  });
});
