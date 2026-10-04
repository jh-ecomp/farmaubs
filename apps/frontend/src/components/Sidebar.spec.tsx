import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { PerfilCodigo } from "@farmaubs/shared";
import { renderWithProviders } from "../test/test-utils";
import { Sidebar } from "./Sidebar";

describe("Sidebar — Renderização Dinâmica de Menu por Perfil RBAC (NF009 / ADR-006 / WCAG 2.1 AA)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  const setupUserSession = (perfilCodigo: PerfilCodigo) => {
    localStorage.setItem("@FarmaUBS:token", "fake-token");
    localStorage.setItem(
      "@FarmaUBS:usuario",
      JSON.stringify({
        id: "usr-test",
        nome: "Usuário Teste",
        email: "teste@ubs.gov.br",
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

  it("Cenário: Farmacêutico Residente enxerga rotas operacionais e NÃO tem rotas de gestão no DOM", () => {
    setupUserSession(PerfilCodigo.FARMACEUTICO_RESIDENTE);

    renderWithProviders(<Sidebar />, { initialEntries: ["/dashboard"] });

    // Rotas autorizadas presentes
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /estoque/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dispensas/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /indicadores/i })).toBeInTheDocument();

    // Rotas restritas NÃO devem existir no DOM
    expect(screen.queryByRole("link", { name: /relatórios/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /auditoria/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /gestão de usuários/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /gestão de ubs/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /parâmetros/i })).not.toBeInTheDocument();
  });

  it("Cenário: Farmacêutico Responsável enxerga Relatórios e Parâmetros, mas NÃO Gestão de Usuários ou UBS", () => {
    setupUserSession(PerfilCodigo.FARMACEUTICO_RESPONSAVEL);

    renderWithProviders(<Sidebar />, { initialEntries: ["/estoque"] });

    // Relatórios e Parâmetros visíveis
    expect(screen.getByRole("link", { name: /relatórios/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /parâmetros/i })).toBeInTheDocument();

    // Rotas exclusivas de Admin e Gerente não estão no DOM
    expect(screen.queryByRole("link", { name: /gestão de usuários/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /gestão de ubs/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /auditoria/i })).not.toBeInTheDocument();
  });

  it("Cenário: Gerente enxerga Auditoria e Relatórios, mas NÃO Gestão de Usuários ou UBS", () => {
    setupUserSession(PerfilCodigo.GERENTE);

    renderWithProviders(<Sidebar />, { initialEntries: ["/dashboard"] });

    expect(screen.getByRole("link", { name: /auditoria/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /relatórios/i })).toBeInTheDocument();

    expect(screen.queryByRole("link", { name: /gestão de usuários/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /gestão de ubs/i })).not.toBeInTheDocument();
  });

  it("Cenário: Administrador enxerga todos os itens de menu no DOM", () => {
    setupUserSession(PerfilCodigo.ADMINISTRADOR);

    renderWithProviders(<Sidebar />, { initialEntries: ["/dashboard"] });

    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /estoque/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dispensas/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /indicadores/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /relatórios/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /parâmetros/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /auditoria/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /gestão de usuários/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /gestão de ubs/i })).toBeInTheDocument();
  });

  it("deve aplicar aria-current='page' exclusivamente no link correspondente à rota atual", () => {
    setupUserSession(PerfilCodigo.ADMINISTRADOR);

    renderWithProviders(<Sidebar />, { initialEntries: ["/estoque"] });

    const linkEstoque = screen.getByRole("link", { name: /estoque/i });
    const linkDashboard = screen.getByRole("link", { name: /dashboard/i });

    expect(linkEstoque).toHaveAttribute("aria-current", "page");
    expect(linkDashboard).not.toHaveAttribute("aria-current");
  });
});
