import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, act, fireEvent } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import { renderWithProviders, createTestQueryClient } from "../test/test-utils";
import SessionTimeoutModal from "./SessionTimeoutModal";
import { authService, inspectSessionExpiresHeader } from "../services/api";

describe("SessionTimeoutModal — Camada D (NF012 / AC-20)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const setupAuthenticatedSession = (secondsUntilExpire: number) => {
    const now = new Date("2026-09-16T12:00:00.000Z").getTime();
    vi.setSystemTime(now);

    const expiresAt = new Date(now + secondsUntilExpire * 1000).toISOString();

    localStorage.setItem("@FarmaUBS:token", "jwt-token-ativo");
    localStorage.setItem(
      "@FarmaUBS:usuario",
      JSON.stringify({
        id: "usr-1",
        nome: "Maria Farmacêutica",
        email: "maria@ubs.gov.br",
        perfil: ["FARMACEUTICO"],
        municipio_id: 1,
        unidade_id: 1,
        deveTrocarSenha: false,
      }),
    );
    localStorage.setItem("@FarmaUBS:expiresAt", expiresAt);
    localStorage.setItem("@FarmaUBS:ttlSeconds", "3600");
    localStorage.setItem("@FarmaUBS:warningSeconds", "300");

    return { now, expiresAt };
  };

  it("Cenário: Exibição do modal quando o tempo restante atinge 4 minutos e 30 segundos", () => {
    setupAuthenticatedSession(270); // 4 min e 30 seg

    renderWithProviders(<SessionTimeoutModal />);

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveTextContent(
      "Sua sessão no FarmaUBS expirará em breve",
    );
    expect(screen.getByText("04:30")).toBeInTheDocument();
  });

  it("não deve exibir o modal quando o tempo restante for maior que 5 minutos (300 segundos)", () => {
    setupAuthenticatedSession(600); // 10 minutos

    renderWithProviders(<SessionTimeoutModal />);

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("deve focar automaticamente no botão primário 'Continuar Conectado' ao abrir", () => {
    setupAuthenticatedSession(200);

    renderWithProviders(<SessionTimeoutModal />);

    const extendBtn = screen.getByRole("button", {
      name: /continuar conectado/i,
    });
    expect(extendBtn).toBeInTheDocument();
    expect(extendBtn).toHaveFocus();
  });

  it("deve aplicar estilização de urgência visual quando restar menos de 60 segundos", () => {
    setupAuthenticatedSession(45); // 45 segundos

    renderWithProviders(<SessionTimeoutModal />);

    const timer = screen.getByText("00:45");
    expect(timer).toBeInTheDocument();
    // A cor de destaque deve ser vermelha (#DC2626)
    expect(timer).toHaveStyle({ color: "#DC2626" });
  });

  it("Cenário: Ação Continuar Conectado chama extendSession, renova sessão e fecha modal", async () => {
    const { now } = setupAuthenticatedSession(180); // 3 minutos

    const novoExpiresAt = new Date(now + 3600 * 1000).toISOString();
    const renovarSpy = vi
      .spyOn(authService, "renovarSessao")
      .mockResolvedValue({
        expiresAt: novoExpiresAt,
        ttlSeconds: 3600,
        warningSeconds: 300,
      });

    renderWithProviders(<SessionTimeoutModal />);

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    const extendBtn = screen.getByRole("button", {
      name: /continuar conectado/i,
    });

    await act(async () => {
      fireEvent.click(extendBtn);
    });

    expect(renovarSpy).toHaveBeenCalledTimes(1);

    // Com o novo expiresAt (60 min), o modal fecha imediatamente
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("Cenário: Ação Sair do Sistema limpa o cache do queryClient, descarta credenciais e navega para /login", async () => {
    setupAuthenticatedSession(200);

    const testQueryClient = createTestQueryClient();
    const clearSpy = vi.spyOn(testQueryClient, "clear");

    renderWithProviders(
      <Routes>
        <Route
          path="/dashboard"
          element={
            <>
              <SessionTimeoutModal />
              <div>Painel Operacional</div>
            </>
          }
        />
        <Route path="/login" element={<div>Tela de Login</div>} />
      </Routes>,
      {
        initialEntries: ["/dashboard"],
        queryClient: testQueryClient,
      },
    );

    const logoutBtn = screen.getByRole("button", {
      name: /sair do sistema/i,
    });

    await act(async () => {
      fireEvent.click(logoutBtn);
    });

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("@FarmaUBS:token")).toBeNull();
    expect(localStorage.getItem("@FarmaUBS:usuario")).toBeNull();
    expect(screen.getByText("Tela de Login")).toBeInTheDocument();
  });

  it("Cenário: Logout por inatividade ao zerar o tempo limpa o cache, grava motivo no sessionStorage e redireciona", () => {
    setupAuthenticatedSession(2); // 2 segundos restantes

    const testQueryClient = createTestQueryClient();
    const clearSpy = vi.spyOn(testQueryClient, "clear");

    renderWithProviders(
      <Routes>
        <Route
          path="/dashboard"
          element={
            <>
              <SessionTimeoutModal />
              <div>Painel Operacional</div>
            </>
          }
        />
        <Route path="/login" element={<div>Tela de Login FarmaUBS</div>} />
      </Routes>,
      {
        initialEntries: ["/dashboard"],
        queryClient: testQueryClient,
      },
    );

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    // Avança 2 segundos no tempo simulado
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // 1. Expurgo obrigatório do cache de dados clínicos
    expect(clearSpy).toHaveBeenCalledTimes(1);

    // 2. Gravação do motivo de inatividade no sessionStorage
    expect(sessionStorage.getItem("@FarmaUBS:logoutReason")).toBe(
      "Sua sessão expirou por inatividade. Faça login novamente para continuar.",
    );

    // 3. Credenciais limpas do localStorage
    expect(localStorage.getItem("@FarmaUBS:token")).toBeNull();

    // 4. Redirecionamento para a tela de login
    expect(screen.getByText("Tela de Login FarmaUBS")).toBeInTheDocument();
  });

  it("Cenário: Sincronização reativa via cabeçalho X-Session-Expires-At atualiza a expiração e fecha o modal", () => {
    const { now } = setupAuthenticatedSession(100); // 100s restantes (modal aberto)

    renderWithProviders(<SessionTimeoutModal />);

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    // Simula resposta de qualquer requisição da API com cabeçalho X-Session-Expires-At renovado
    const novaDataExpiracao = new Date(now + 3600 * 1000).toISOString();
    const mockHeaders = new Headers();
    mockHeaders.set("X-Session-Expires-At", novaDataExpiracao);

    const mockResponse = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: mockHeaders,
    });

    act(() => {
      inspectSessionExpiresHeader(mockResponse);
    });

    // O modal deve fechar reativamente sem reload
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(localStorage.getItem("@FarmaUBS:expiresAt")).toBe(novaDataExpiracao);
  });
});
