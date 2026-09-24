import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route, MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./AuthContext";
import { authService } from "../services/api";
import { RoleRoute } from "../components/RoleRoute";

function TestConsumer() {
  const {
    status,
    isAuthenticated,
    usuario,
    logout,
    hasRole,
    isAdmin,
    escopoAtivo,
  } = useAuth();

  return (
    <div>
      <span data-testid="auth-status">{status}</span>
      <span data-testid="is-authenticated">
        {isAuthenticated ? "true" : "false"}
      </span>
      <span data-testid="user-name">
        {usuario?.nomeCompleto || usuario?.nome || "nenhum"}
      </span>
      <span data-testid="user-role">
        {usuario?.perfilCodigo || "sem-perfil"}
      </span>
      <span data-testid="is-admin">{isAdmin ? "sim" : "nao"}</span>
      <span data-testid="has-gestor">{hasRole("gestor") ? "sim" : "nao"}</span>
      <span data-testid="has-admin-array">
        {hasRole(["GESTOR", "ADMINISTRADOR"]) ? "sim" : "nao"}
      </span>
      <span data-testid="escopo-municipio">{escopoAtivo.municipioId}</span>
      <span data-testid="escopo-unidades">
        {escopoAtivo.unidadeIds.join(",")}
      </span>
      <button
        type="button"
        onClick={() => logout()}
        data-testid="btn-logout-voluntario"
      >
        Logout Voluntário
      </button>
      <button
        type="button"
        onClick={() => logout("Sua sessão expirou por inatividade.")}
        data-testid="btn-logout-timeout"
      >
        Logout Timeout
      </button>
    </div>
  );
}

function renderAuthContext(
  ui = <TestConsumer />,
  {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    }),
    initialEntries = ["/"],
  } = {},
) {
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    ),
  };
}

describe("AuthContext — Contexto Canônico de Autenticação & Logout Seguro (AC-19 / AC-06)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // =========================================================================
  // 1. Ciclo de Vida do Contexto (AuthStatus: carregando, autenticado, nao_autenticado)
  // =========================================================================
  describe("1. Ciclo de Vida do Contexto (AuthStatus)", () => {
    it("Cenário 1: Sem token no storage inicia imediatamente como nao_autenticado", () => {
      renderAuthContext();

      expect(screen.getByTestId("auth-status")).toHaveTextContent(
        "nao_autenticado",
      );
      expect(screen.getByTestId("is-authenticated")).toHaveTextContent("false");
      expect(screen.getByTestId("user-name")).toHaveTextContent("nenhum");
    });

    it("Cenário 2: Com token salvo e sem cache, exibe indicador acessível (role=status) e transita para autenticado após 200", async () => {
      localStorage.setItem("@FarmaUBS:token", "valid-jwt-token");
      localStorage.setItem(
        "@FarmaUBS:expiresAt",
        new Date(Date.now() + 3600_000).toISOString(),
      );

      vi.spyOn(authService, "obterSessaoAtual").mockResolvedValueOnce({
        id: "usr-canonico-100",
        nomeCompleto: "Dra. Joana Prado",
        email: "joana@farmaubs.dev",
        perfilCodigo: "ADMINISTRADOR",
        municipioId: "mun-parnaiba",
        unidadeIds: ["ubs-10", "ubs-20"],
        deveTrocarSenha: false,
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      });

      renderAuthContext();

      // Durante o carregamento da sessão, exibe o indicador acessível (NF001 / WCAG 2.1 AA)
      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(
        screen.getByText("Carregando informações da sessão..."),
      ).toBeInTheDocument();

      // Após a resolução de obterSessaoAtual
      await waitFor(() => {
        expect(screen.getByTestId("auth-status")).toHaveTextContent(
          "autenticado",
        );
      });

      expect(screen.getByTestId("is-authenticated")).toHaveTextContent("true");
      expect(screen.getByTestId("user-name")).toHaveTextContent(
        "Dra. Joana Prado",
      );
      expect(screen.getByTestId("user-role")).toHaveTextContent(
        "ADMINISTRADOR",
      );
      expect(screen.getByTestId("is-admin")).toHaveTextContent("sim");
    });

    it("Cenário 3: Com token com data de expiração no passado limpa storage e marca como nao_autenticado", () => {
      localStorage.setItem("@FarmaUBS:token", "expired-token");
      localStorage.setItem(
        "@FarmaUBS:expiresAt",
        new Date(Date.now() - 60_000).toISOString(),
      );

      renderAuthContext();

      expect(localStorage.getItem("@FarmaUBS:token")).toBeNull();
      expect(sessionStorage.getItem("@FarmaUBS:logoutReason")).toContain(
        "expirou por inatividade",
      );
      expect(screen.getByTestId("auth-status")).toHaveTextContent(
        "nao_autenticado",
      );
      expect(screen.getByTestId("is-authenticated")).toHaveTextContent("false");
    });

    it("Cenário 4: Com token rejeitado por 401 na validação limpa credenciais e define nao_autenticado", async () => {
      localStorage.setItem("@FarmaUBS:token", "rejected-token");
      localStorage.setItem(
        "@FarmaUBS:expiresAt",
        new Date(Date.now() + 3600_000).toISOString(),
      );

      vi.spyOn(authService, "obterSessaoAtual").mockRejectedValueOnce({
        type: "SESSION_EXPIRED",
        message: "Sua sessão expirou no servidor.",
      });

      renderAuthContext();

      await waitFor(() => {
        expect(screen.getByTestId("auth-status")).toHaveTextContent(
          "nao_autenticado",
        );
      });

      expect(localStorage.getItem("@FarmaUBS:token")).toBeNull();
      expect(sessionStorage.getItem("@FarmaUBS:logoutReason")).toContain(
        "expirou no servidor",
      );
      expect(screen.getByTestId("is-authenticated")).toHaveTextContent("false");
    });
  });

  // =========================================================================
  // 2. Helpers Reativos de Autorização e Escopo na UI (hasRole, isAdmin, escopoAtivo)
  // =========================================================================
  describe("2. Helpers Reativos de Autorização e Escopo (hasRole, isAdmin, escopoAtivo)", () => {
    it("deve verificar papéis com hasRole (case-insensitive e tolerante a arrays)", () => {
      localStorage.setItem("@FarmaUBS:token", "admin-token");
      localStorage.setItem(
        "@FarmaUBS:usuario",
        JSON.stringify({
          id: "usr-1",
          nome: "Admin Teste",
          email: "admin@ubs.gov.br",
          perfilCodigo: "ADMINISTRADOR",
          perfil: ["ADMINISTRADOR"],
          municipioId: "mun-1",
          municipio_id: 1,
          unidadeIds: ["ubs-1", "ubs-2"],
          unidade_id: 1,
        }),
      );

      renderAuthContext();

      expect(screen.getByTestId("is-admin")).toHaveTextContent("sim");
      expect(screen.getByTestId("has-gestor")).toHaveTextContent("nao");
      expect(screen.getByTestId("has-admin-array")).toHaveTextContent("sim");
      expect(screen.getByTestId("escopo-municipio")).toHaveTextContent("mun-1");
      expect(screen.getByTestId("escopo-unidades")).toHaveTextContent(
        "ubs-1,ubs-2",
      );
    });

    it("deve reconhecer perfil de farmacêutico com isAdmin=false", () => {
      localStorage.setItem("@FarmaUBS:token", "farm-token");
      localStorage.setItem(
        "@FarmaUBS:usuario",
        JSON.stringify({
          id: "usr-2",
          nome: "Farmacêutico Teste",
          email: "farm@ubs.gov.br",
          perfilCodigo: "FARMACEUTICO_RESPONSAVEL",
          perfil: ["FARMACEUTICO_RESPONSAVEL"],
          municipioId: "mun-2",
          municipio_id: 2,
          unidadeIds: ["ubs-3"],
          unidade_id: 3,
        }),
      );

      renderAuthContext();

      expect(screen.getByTestId("is-admin")).toHaveTextContent("nao");
      expect(screen.getByTestId("has-admin-array")).toHaveTextContent("nao");
      expect(screen.getByTestId("escopo-municipio")).toHaveTextContent("mun-2");
    });
  });

  // =========================================================================
  // 3. Logout Seguro e Expurgo de Cache de Memória RAM (AC-06 / RF004 / NF012)
  // =========================================================================
  describe("3. Logout Seguro e Expurgo de Cache de Memória RAM", () => {
    it("Cenário: Logout voluntário limpa queryClient, localStorage, reseta contexto e não grava logoutReason", async () => {
      const user = userEvent.setup();
      localStorage.setItem("@FarmaUBS:token", "token-voluntario");
      localStorage.setItem(
        "@FarmaUBS:usuario",
        JSON.stringify({ id: "usr-3", nome: "Voluntário", perfil: ["GESTOR"] }),
      );
      sessionStorage.setItem("@FarmaUBS:logoutReason", "aviso-antigo");

      const logoutServiceSpy = vi
        .spyOn(authService, "logout")
        .mockResolvedValueOnce();

      const { queryClient } = renderAuthContext();
      const clearSpy = vi.spyOn(queryClient, "clear");

      await user.click(screen.getByTestId("btn-logout-voluntario"));

      // 1. Expurgo imediato do cache de memória RAM (dados clínicos / pacientes)
      expect(clearSpy).toHaveBeenCalledTimes(1);

      // 2. Limpeza do armazenamento local
      expect(localStorage.getItem("@FarmaUBS:token")).toBeNull();
      expect(localStorage.getItem("@FarmaUBS:usuario")).toBeNull();

      // 3. Remove motivo antigo no logout voluntário (sem alerta indevido no login)
      expect(sessionStorage.getItem("@FarmaUBS:logoutReason")).toBeNull();

      // 4. Estado resetado
      expect(screen.getByTestId("auth-status")).toHaveTextContent(
        "nao_autenticado",
      );
      expect(screen.getByTestId("is-authenticated")).toHaveTextContent("false");

      // 5. Chamada de revogação no backend
      expect(logoutServiceSpy).toHaveBeenCalledTimes(1);
    });

    it("Cenário: Logout por timeout/inatividade grava motivo no sessionStorage", async () => {
      const user = userEvent.setup();
      localStorage.setItem("@FarmaUBS:token", "token-timeout");
      localStorage.setItem(
        "@FarmaUBS:usuario",
        JSON.stringify({
          id: "usr-4",
          nome: "Operador",
          perfil: ["FARMACEUTICO"],
        }),
      );

      vi.spyOn(authService, "logout").mockResolvedValueOnce();

      const { queryClient } = renderAuthContext();
      const clearSpy = vi.spyOn(queryClient, "clear");

      await user.click(screen.getByTestId("btn-logout-timeout"));

      expect(clearSpy).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem("@FarmaUBS:token")).toBeNull();
      expect(sessionStorage.getItem("@FarmaUBS:logoutReason")).toBe(
        "Sua sessão expirou por inatividade.",
      );
      expect(screen.getByTestId("auth-status")).toHaveTextContent(
        "nao_autenticado",
      );
    });

    it("Cenário: Resiliência — Falha na chamada de rede do backend não impede o expurgo local", async () => {
      const user = userEvent.setup();
      localStorage.setItem("@FarmaUBS:token", "token-resiliente");
      localStorage.setItem(
        "@FarmaUBS:usuario",
        JSON.stringify({
          id: "usr-5",
          nome: "Offline User",
          perfil: ["ADMINISTRADOR"],
        }),
      );

      vi.spyOn(authService, "logout").mockRejectedValueOnce(
        new Error("500 Server Error / Network Offline"),
      );

      const { queryClient } = renderAuthContext();
      const clearSpy = vi.spyOn(queryClient, "clear");

      await user.click(screen.getByTestId("btn-logout-voluntario"));

      // Deve expurgar memória e storage mesmo se backend falhar
      expect(clearSpy).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem("@FarmaUBS:token")).toBeNull();
      expect(screen.getByTestId("auth-status")).toHaveTextContent(
        "nao_autenticado",
      );
    });
  });

  // =========================================================================
  // 4. Integração com RoleRoute
  // =========================================================================
  describe("4. Integração com RoleRoute", () => {
    it("deve bloquear acesso e redirecionar para /403 se o usuário não tiver o perfil requerido", () => {
      localStorage.setItem("@FarmaUBS:token", "user-token");
      localStorage.setItem(
        "@FarmaUBS:usuario",
        JSON.stringify({
          id: "usr-farm",
          nome: "Farmacêutico",
          perfilCodigo: "FARMACEUTICO",
          perfil: ["FARMACEUTICO"],
          municipio_id: 1,
          unidade_id: 1,
        }),
      );

      renderAuthContext(
        <Routes>
          <Route
            path="/admin"
            element={
              <RoleRoute allowedRoles={["ADMINISTRADOR"]}>
                <div>Painel Restrito Admin</div>
              </RoleRoute>
            }
          />
          <Route path="/403" element={<div>Acesso Negado 403</div>} />
        </Routes>,
        { initialEntries: ["/admin"] },
      );

      expect(screen.getByText("Acesso Negado 403")).toBeInTheDocument();
      expect(
        screen.queryByText("Painel Restrito Admin"),
      ).not.toBeInTheDocument();
    });

    it("deve permitir acesso à rota se o usuário possuir o perfil requerido", () => {
      localStorage.setItem("@FarmaUBS:token", "admin-token");
      localStorage.setItem(
        "@FarmaUBS:usuario",
        JSON.stringify({
          id: "usr-adm",
          nome: "Admin Supremo",
          perfilCodigo: "ADMINISTRADOR",
          perfil: ["ADMINISTRADOR"],
          municipio_id: 1,
          unidade_id: 1,
        }),
      );

      renderAuthContext(
        <Routes>
          <Route
            path="/admin"
            element={
              <RoleRoute allowedRoles={["ADMINISTRADOR"]}>
                <div>Painel Restrito Admin</div>
              </RoleRoute>
            }
          />
          <Route path="/403" element={<div>Acesso Negado 403</div>} />
        </Routes>,
        { initialEntries: ["/admin"] },
      );

      expect(screen.getByText("Painel Restrito Admin")).toBeInTheDocument();
    });
  });
});
