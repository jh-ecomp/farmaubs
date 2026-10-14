import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import { renderWithProviders } from "../test/test-utils";
import { AccessDenied } from "./AccessDenied";

describe("AccessDenied — Página de Acesso Negado (403 / ADR-032 / WCAG 2.1 AA)", () => {
  it("deve renderizar container de alerta acessível com role='alert' e mensagem amigável", () => {
    renderWithProviders(<AccessDenied />);

    const alertBox = screen.getByRole("alert");
    expect(alertBox).toBeInTheDocument();
    expect(alertBox).toHaveAttribute("aria-live", "assertive");

    expect(
      screen.getByText(/acesso negado: seu perfil não possui permissão para acessar este recurso/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /acesso não autorizado/i })).toBeInTheDocument();
  });

  it("deve navegar para /dashboard ao clicar no botão 'Voltar ao Dashboard'", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <Routes>
        <Route path="/403" element={<AccessDenied />} />
        <Route path="/dashboard" element={<div>Painel Dashboard</div>} />
      </Routes>,
      { initialEntries: ["/403"] },
    );

    const botaoVoltar = screen.getByRole("button", {
      name: /voltar ao dashboard/i,
    });
    expect(botaoVoltar).toBeInTheDocument();

    await user.click(botaoVoltar);

    expect(screen.getByText("Painel Dashboard")).toBeInTheDocument();
  });
});
