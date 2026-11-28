import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PerfilCodigo } from "@farmaubs/shared";
import NotFound from "./NotFound";
import { renderWithProviders } from "../test/test-utils";
import { resolveRouteDocumentTitle } from "../hooks/useDocumentTitle";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("NotFound e Títulos Dinâmicos — RL-07", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("direciona visitante não autenticado para /login ao clicar em Voltar ao Início", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotFound />);

    await user.click(screen.getByRole("button", { name: /voltar ao início/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  it("direciona usuário autenticado para /dashboard em vez de /login (RL-07)", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "@FarmaUBS:usuario",
      JSON.stringify({
        id: "usr-1",
        nomeCompleto: "Dra. Ana",
        email: "ana@ubs.gov.br",
        perfilCodigo: PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
        deveTrocarSenha: false,
      }),
    );
    localStorage.setItem(
      "@FarmaUBS:expiresAt",
      new Date(Date.now() + 3600_000).toISOString(),
    );

    renderWithProviders(<NotFound />);

    await user.click(screen.getByRole("button", { name: /voltar ao início/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });

  it("resolve títulos dinâmicos por rota no padrão '<Tópico> | FarmaUBS'", () => {
    expect(resolveRouteDocumentTitle("/login")).toBe("Login | FarmaUBS");
    expect(resolveRouteDocumentTitle("/dispensas")).toBe(
      "Dispensação de Medicamentos | FarmaUBS",
    );
    expect(resolveRouteDocumentTitle("/privacidade")).toBe(
      "Política de Privacidade | FarmaUBS",
    );
    expect(resolveRouteDocumentTitle("/rota-inexistente")).toBe(
      "Página não encontrada | FarmaUBS",
    );
  });
});
