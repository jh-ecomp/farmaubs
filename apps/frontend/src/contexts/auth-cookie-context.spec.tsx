import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./AuthContext";

function CookieAuthConsumer() {
  const { status, isAuthenticated, usuario, token, login, logout } = useAuth();

  return (
    <div>
      <span data-testid="auth-status">{status}</span>
      <span data-testid="is-authenticated">
        {isAuthenticated ? "true" : "false"}
      </span>
      <span data-testid="user-name">
        {usuario?.nomeCompleto || usuario?.nome || "nenhum"}
      </span>
      <span data-testid="user-token">{token ?? "sem-token"}</span>
      <button
        type="button"
        onClick={() =>
          login({
            token: null,
            usuario: {
              id: "usr-novo-123",
              nomeCompleto: "Farmacêutico Teste Cookie",
              email: "farmaceutico@farmaubs.dev",
              perfilCodigo: "FARMACEUTICO",
              perfil: ["FARMACEUTICO"],
              municipioId: "mun-1",
              unidadeIds: ["ubs-1"],
              deveTrocarSenha: false,
            },
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
            ttlSeconds: 3600,
            warningSeconds: 300,
          })
        }
        data-testid="btn-login-simulado"
      >
        Login Simulado
      </button>
      <button
        type="button"
        onClick={() => logout()}
        data-testid="btn-logout"
      >
        Logout
      </button>
    </div>
  );
}

function renderCookieAuthContext(
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  }),
) {
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <CookieAuthConsumer />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    ),
  };
}

describe("AC-30 BDD: Migração de Sessão para Cookie HttpOnly e Expurgo de Tokens do localStorage (NF012)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("Cenário 1: Inicialização e restauração automática com cookie válido (credentials: 'include')", async () => {
    // GIVEN: Servidor possui sessão ativa vinculada ao cookie HttpOnly farmaubs_session
    const sessaoMock = {
      id: "usr-admin-1",
      nomeCompleto: "Dra. Helena Souza",
      email: "helena@farmaubs.dev",
      perfilCodigo: "ADMINISTRADOR",
      municipioId: "mun-10",
      unidadeIds: ["ubs-01", "ubs-02"],
      deveTrocarSenha: false,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    };

    let fetchCalledWith: { url: string; options?: RequestInit } | null = null;
    globalThis.fetch = vi.fn().mockImplementation((url, options) => {
      fetchCalledWith = { url: String(url), options };
      return Promise.resolve(
        new Response(JSON.stringify(sessaoMock), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    // WHEN: Aplicação inicializa o AuthProvider
    renderCookieAuthContext();

    // THEN: Executou requisição com credentials: 'include' e sem Authorization Header
    await waitFor(() => {
      expect(screen.getByTestId("auth-status")).toHaveTextContent("autenticado");
    });

    expect(fetchCalledWith).not.toBeNull();
    expect(fetchCalledWith!.url).toContain("/api/v1/acesso/me");
    expect(fetchCalledWith!.options?.credentials).toBe("include");
    const headers = fetchCalledWith!.options?.headers as Record<string, string>;
    expect(headers?.Authorization).toBeUndefined();

    // AND: Contexto é populado e nenhum token é exposto ou gravado no localStorage
    expect(screen.getByTestId("is-authenticated")).toHaveTextContent("true");
    expect(screen.getByTestId("user-name")).toHaveTextContent("Dra. Helena Souza");
    expect(screen.getByTestId("user-token")).toHaveTextContent("sem-token");
    expect(localStorage.getItem("@FarmaUBS:token")).toBeNull();
    expect(localStorage.getItem("@FarmaUBS:usuario")).toContain("usr-admin-1");
  });

  it("Cenário 2: Inicialização com cookie inexistente ou expirado (API responde 401)", async () => {
    // GIVEN: Cookie inexistente ou sessão expirada no servidor
    globalThis.fetch = vi.fn().mockImplementation(() => {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            code: "SESSION_EXPIRED",
            message: "Sessão inválida ou expirada.",
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    });

    // WHEN: AuthProvider inicializa
    renderCookieAuthContext();

    // THEN: Transiciona para nao_autenticado, sem usuário e sem token
    await waitFor(() => {
      expect(screen.getByTestId("auth-status")).toHaveTextContent(
        "nao_autenticado",
      );
    });

    expect(screen.getByTestId("is-authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("user-name")).toHaveTextContent("nenhum");
    expect(screen.getByTestId("user-token")).toHaveTextContent("sem-token");
    expect(localStorage.getItem("@FarmaUBS:token")).toBeNull();
    expect(localStorage.getItem("@FarmaUBS:usuario")).toBeNull();
  });

  it("Cenário 3: Login bem-sucedido não expõe token no localStorage (NF012)", async () => {
    // GIVEN: Usuário não autenticado
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            code: "SESSION_EXPIRED",
            message: "Não autenticado.",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    renderCookieAuthContext();

    await waitFor(() => {
      expect(screen.getByTestId("auth-status")).toHaveTextContent(
        "nao_autenticado",
      );
    });

    // Preenche intencionalmente uma chave antiga de token para verificar se é expurgada
    localStorage.setItem("@FarmaUBS:token", "token-antigo-remanescente");

    // WHEN: Login é acionado
    const user = userEvent.setup();
    await user.click(screen.getByTestId("btn-login-simulado"));

    // THEN: Estado transita para autenticado com dados do usuário
    expect(screen.getByTestId("auth-status")).toHaveTextContent("autenticado");
    expect(screen.getByTestId("is-authenticated")).toHaveTextContent("true");
    expect(screen.getByTestId("user-name")).toHaveTextContent(
      "Farmacêutico Teste Cookie",
    );
    expect(screen.getByTestId("user-token")).toHaveTextContent("sem-token");

    // AND: A chave @FarmaUBS:token é permanentemente banida do localStorage
    expect(localStorage.getItem("@FarmaUBS:token")).toBeNull();
    expect(localStorage.getItem("@FarmaUBS:usuario")).not.toBeNull();
    expect(localStorage.getItem("@FarmaUBS:expiresAt")).not.toBeNull();
  });

  it("Cenário 4: Logout seguro limpa estado, esvazia QueryClient e dispara POST /logout com credentials: 'include'", async () => {
    // GIVEN: Usuário autenticado
    const sessaoMock = {
      id: "usr-admin-1",
      nomeCompleto: "Dra. Helena Souza",
      email: "helena@farmaubs.dev",
      perfilCodigo: "ADMINISTRADOR",
      municipioId: "mun-10",
      unidadeIds: ["ubs-01"],
      deveTrocarSenha: false,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    };

    let logoutCalledWith: { url: string; options?: RequestInit } | null = null;
    globalThis.fetch = vi.fn().mockImplementation((url, options) => {
      const urlStr = String(url);
      if (urlStr.includes("/acesso/me")) {
        return Promise.resolve(
          new Response(JSON.stringify(sessaoMock), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (urlStr.includes("/acesso/logout")) {
        logoutCalledWith = { url: urlStr, options };
        return Promise.resolve(
          new Response(JSON.stringify({ mensagem: "Logout efetuado com sucesso." }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const queryClient = new QueryClient();
    const clearSpy = vi.spyOn(queryClient, "clear");

    renderCookieAuthContext(queryClient);

    await waitFor(() => {
      expect(screen.getByTestId("auth-status")).toHaveTextContent("autenticado");
    });

    // WHEN: Logout é acionado
    const user = userEvent.setup();
    await user.click(screen.getByTestId("btn-logout"));

    // THEN: Backend recebe POST /acesso/logout com credentials: 'include'
    await waitFor(() => {
      expect(logoutCalledWith).not.toBeNull();
    });
    expect(logoutCalledWith!.url).toContain("/api/v1/acesso/logout");
    expect(logoutCalledWith!.options?.method).toBe("POST");
    expect(logoutCalledWith!.options?.credentials).toBe("include");

    // AND: TanStack Query tem cache em memória RAM esvaziado
    expect(clearSpy).toHaveBeenCalled();

    // AND: Estado transiciona para nao_autenticado e storage é limpo
    expect(screen.getByTestId("auth-status")).toHaveTextContent("nao_autenticado");
    expect(screen.getByTestId("is-authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("user-name")).toHaveTextContent("nenhum");
    expect(localStorage.getItem("@FarmaUBS:usuario")).toBeNull();
    expect(localStorage.getItem("@FarmaUBS:token")).toBeNull();
  });
});

