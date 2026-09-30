import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { authService, inspectSessionExpiresHeader, onSessionExpiresUpdate } from "./api";
import { usuarioService } from "./usuario.service";

describe("api.ts — authService & Interceptores (AC-08 / AC-20)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("authService.redefinirSenhaProvisoria", () => {
    it("deve tratar status 204 No Content sem lançar SyntaxError e retornar a senha provisória enviada", async () => {
      localStorage.setItem("@FarmaUBS:token", "fake-token-adm");

      // Simula backend respondendo 204 No Content (sem corpo de resposta)
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(null, {
          status: 204,
          statusText: "No Content",
        }),
      );

      const resultado = await authService.redefinirSenhaProvisoria(
        "usr-123",
        "SenhaSegura@2026",
      );

      expect(resultado).toEqual({
        usuarioId: "usr-123",
        senhaProvisoria: "SenhaSegura@2026",
        mensagem: "Senha provisória emitida com sucesso.",
      });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/usuarios/usr-123/senha-provisoria"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer fake-token-adm",
          }),
          body: JSON.stringify({ senhaProvisoria: "SenhaSegura@2026" }),
        }),
      );
    });

    it("deve tratar resposta 200 OK com corpo JSON normalmente", async () => {
      localStorage.setItem("@FarmaUBS:token", "fake-token-adm");

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            usuarioId: "usr-456",
            senhaProvisoria: "ServidorGerou@123",
            mensagem: "Senha redefinida com sucesso",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

      const resultado = await authService.redefinirSenhaProvisoria(
        "usr-456",
      );

      expect(resultado).toEqual({
        usuarioId: "usr-456",
        senhaProvisoria: "ServidorGerou@123",
        mensagem: "Senha redefinida com sucesso",
      });
    });
  });

  describe("usuarioService.redefinirSenha (unificação de rota)", () => {
    it("deve delegar a chamada para authService.redefinirSenhaProvisoria", async () => {
      const spy = vi
        .spyOn(authService, "redefinirSenhaProvisoria")
        .mockResolvedValueOnce({
          usuarioId: "usr-789",
          senhaProvisoria: "Provisoria@2026",
          mensagem: "Senha emitida",
        });

      const resultado = await usuarioService.redefinirSenha(
        "usr-789",
        "Provisoria@2026",
      );

      expect(spy).toHaveBeenCalledWith("usr-789", "Provisoria@2026");
      expect(resultado).toEqual({
        usuarioId: "usr-789",
        senhaProvisoria: "Provisoria@2026",
        mensagem: "Senha emitida",
      });
    });
  });

  describe("inspectSessionExpiresHeader (NF012 / AC-20)", () => {
    it("deve salvar no localStorage e acionar listeners quando header X-Session-Expires-At estiver presente", () => {
      const listenerMock = vi.fn();
      const unsubscribe = onSessionExpiresUpdate(listenerMock);

      const expiresAtIso = new Date(Date.now() + 3600_000).toISOString();
      const headers = new Headers();
      headers.set("X-Session-Expires-At", expiresAtIso);

      const response = new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers,
      });

      inspectSessionExpiresHeader(response);

      expect(localStorage.getItem("@FarmaUBS:expiresAt")).toBe(expiresAtIso);
      expect(listenerMock).toHaveBeenCalledWith(expiresAtIso);

      unsubscribe();
    });
  });

  describe("authService.logout (RF004 / AC-06)", () => {
    it("deve disparar POST /api/v1/acesso/logout com cabeçalho Authorization Bearer", async () => {
      localStorage.setItem("@FarmaUBS:token", "jwt-token-ativo");

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(null, {
          status: 204,
          statusText: "No Content",
        }),
      );

      await authService.logout();

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/acesso/logout"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer jwt-token-ativo",
          }),
        }),
      );
    });

    it("deve priorizar token explicitamente passado no argumento", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(null, {
          status: 204,
        }),
      );

      await authService.logout("token-passado-diretamente");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/acesso/logout"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer token-passado-diretamente",
          }),
        }),
      );
    });

    it("não deve disparar requisição se não houver token disponível", async () => {
      globalThis.fetch = vi.fn();

      await authService.logout();

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it("deve tolerar falha de rede sem propagar exceção", async () => {
      localStorage.setItem("@FarmaUBS:token", "token-com-falha-de-rede");
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network Error"));

      await expect(authService.logout()).resolves.toBeUndefined();
    });
  });
});
