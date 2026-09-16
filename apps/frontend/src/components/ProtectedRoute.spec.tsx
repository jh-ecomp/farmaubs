import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import { renderWithProviders } from "../test/test-utils";
import ProtectedRoute from "./ProtectedRoute";

describe("ProtectedRoute — Guarda Anti-Desvio (RF003 / NF012)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("deve redirecionar para /login quando o usuário não estiver autenticado", () => {
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<div>Tela de Login</div>} />
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
    expect(screen.queryByText("Painel Principal")).not.toBeInTheDocument();
  });

  it("deve interceptar navegação para /dashboard e redirecionar para /trocar-senha se deveTrocarSenha for true", () => {
    // Configura usuário autenticado com pendência de troca obrigatória
    localStorage.setItem("@FarmaUBS:token", "fake-jwt-token");
    localStorage.setItem(
      "@FarmaUBS:usuario",
      JSON.stringify({
        id: "usr-1",
        nome: "Carlos Silva",
        email: "carlos@ubs.gov.br",
        perfil: ["FARMACEUTICO"],
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
          path="/dashboard"
          element={
            <ProtectedRoute>
              <div>Painel Principal</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/trocar-senha"
          element={<div>Tela de Troca Obrigatória de Senha</div>}
        />
      </Routes>,
      { initialEntries: ["/dashboard"] },
    );

    expect(
      screen.getByText("Tela de Troca Obrigatória de Senha"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Painel Principal")).not.toBeInTheDocument();
  });

  it("deve redirecionar para /dashboard se usuário sem pendência tentar acessar /trocar-senha", () => {
    // Configura usuário autenticado SEM pendência de troca
    localStorage.setItem("@FarmaUBS:token", "fake-jwt-token");
    localStorage.setItem(
      "@FarmaUBS:usuario",
      JSON.stringify({
        id: "usr-2",
        nome: "Mariana Santos",
        email: "mariana@ubs.gov.br",
        perfil: ["FARMACEUTICO"],
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
          path="/trocar-senha"
          element={
            <ProtectedRoute>
              <div>Tela de Troca Obrigatória de Senha</div>
            </ProtectedRoute>
          }
        />
        <Route path="/dashboard" element={<div>Painel Principal</div>} />
      </Routes>,
      { initialEntries: ["/trocar-senha"] },
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
