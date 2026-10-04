import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import { PerfilCodigo } from "@farmaubs/shared";
import { renderWithProviders } from "../test/test-utils";
import { RoleRoute } from "./RoleRoute";
import { AccessDenied } from "../pages/AccessDenied";

describe("RoleRoute — Guarda RBAC por Perfil (RF025 / NF009 / ADR-006)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("deve redirecionar para /login se o usuário não estiver autenticado", () => {
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<div>Tela de Login</div>} />
        <Route
          path="/admin/usuarios"
          element={
            <RoleRoute allowedRoles={[PerfilCodigo.ADMINISTRADOR]}>
              <div>Gestão de Usuários</div>
            </RoleRoute>
          }
        />
      </Routes>,
      { initialEntries: ["/admin/usuarios"] },
    );

    expect(screen.getByText("Tela de Login")).toBeInTheDocument();
    expect(screen.queryByText("Gestão de Usuários")).not.toBeInTheDocument();
  });

  it("deve interceptar Farmacêutico tentando acessar rota restrita de Administrador e redirecionar para /403", () => {
    localStorage.setItem("@FarmaUBS:token", "fake-token");
    localStorage.setItem(
      "@FarmaUBS:usuario",
      JSON.stringify({
        id: "farm-1",
        nome: "Mariana Farmacêutica",
        email: "mariana@ubs.gov.br",
        perfil: [PerfilCodigo.FARMACEUTICO_RESPONSAVEL],
        perfilCodigo: PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
        deveTrocarSenha: false,
      }),
    );
    localStorage.setItem(
      "@FarmaUBS:expiresAt",
      new Date(Date.now() + 3600_000).toISOString(),
    );

    renderWithProviders(
      <Routes>
        <Route path="/403" element={<AccessDenied />} />
        <Route
          path="/usuarios"
          element={
            <RoleRoute allowedRoles={[PerfilCodigo.ADMINISTRADOR]}>
              <div>Gestão de Usuários</div>
            </RoleRoute>
          }
        />
      </Routes>,
      { initialEntries: ["/usuarios"] },
    );

    // O componente AccessDenied deve ser exibido com alerta acessível
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText(/seu perfil não possui permissão para acessar este recurso/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Gestão de Usuários")).not.toBeInTheDocument();
  });

  it("deve permitir acesso para o perfil ADMINISTRADOR em rota com allowedRoles=[ADMINISTRADOR]", () => {
    localStorage.setItem("@FarmaUBS:token", "fake-token");
    localStorage.setItem(
      "@FarmaUBS:usuario",
      JSON.stringify({
        id: "admin-1",
        nome: "Carlos Administrador",
        email: "carlos@ubs.gov.br",
        perfil: [PerfilCodigo.ADMINISTRADOR],
        perfilCodigo: PerfilCodigo.ADMINISTRADOR,
        deveTrocarSenha: false,
      }),
    );
    localStorage.setItem(
      "@FarmaUBS:expiresAt",
      new Date(Date.now() + 3600_000).toISOString(),
    );

    renderWithProviders(
      <Routes>
        <Route path="/403" element={<AccessDenied />} />
        <Route
          path="/usuarios"
          element={
            <RoleRoute allowedRoles={[PerfilCodigo.ADMINISTRADOR]}>
              <div>Painel de Usuários Autorizado</div>
            </RoleRoute>
          }
        />
      </Routes>,
      { initialEntries: ["/usuarios"] },
    );

    expect(
      screen.getByText("Painel de Usuários Autorizado"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("deve forçar redirecionamento para /trocar-senha-obrigatoria se deveTrocarSenha for true", () => {
    localStorage.setItem("@FarmaUBS:token", "fake-token");
    localStorage.setItem(
      "@FarmaUBS:usuario",
      JSON.stringify({
        id: "admin-1",
        nome: "Carlos Administrador",
        email: "carlos@ubs.gov.br",
        perfil: [PerfilCodigo.ADMINISTRADOR],
        perfilCodigo: PerfilCodigo.ADMINISTRADOR,
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
          path="/usuarios"
          element={
            <RoleRoute allowedRoles={[PerfilCodigo.ADMINISTRADOR]}>
              <div>Painel de Usuários</div>
            </RoleRoute>
          }
        />
        <Route
          path="/trocar-senha-obrigatoria"
          element={<div>Tela de Troca de Senha</div>}
        />
      </Routes>,
      { initialEntries: ["/usuarios"] },
    );

    expect(screen.getByText("Tela de Troca de Senha")).toBeInTheDocument();
    expect(screen.queryByText("Painel de Usuários")).not.toBeInTheDocument();
  });
});
