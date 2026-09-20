import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSessionTimeout } from "./useSessionTimeout";

describe("useSessionTimeout — Hook de Timeout de Sessão (Camada D / NF012)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Cenário: Ativação do aviso aos 5 minutos (300 segundos)", () => {
    const now = new Date("2026-09-16T12:00:00.000Z").getTime();
    vi.setSystemTime(now);

    const expiresAt = new Date(now + 300 * 1000).toISOString();
    const onTimeout = vi.fn();

    const { result } = renderHook(() =>
      useSessionTimeout({
        expiresAt,
        warningSeconds: 300,
        isAuthenticated: true,
        onTimeout,
      }),
    );

    expect(result.current.isWarning).toBe(true);
    expect(result.current.formattedTime).toBe("05:00");
    expect(result.current.secondsRemaining).toBe(300);
    expect(result.current.isExpired).toBe(false);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("Cenário: Disparo de callback de timeout ao zerar o tempo", () => {
    const now = new Date("2026-09-16T12:00:00.000Z").getTime();
    vi.setSystemTime(now);

    const expiresAt = new Date(now + 1 * 1000).toISOString();
    const onTimeout = vi.fn();

    const { result } = renderHook(() =>
      useSessionTimeout({
        expiresAt,
        warningSeconds: 300,
        isAuthenticated: true,
        onTimeout,
      }),
    );

    expect(result.current.isExpired).toBe(false);
    expect(onTimeout).not.toHaveBeenCalled();

    // Avança 1 segundo no tempo do sistema e cronômetro
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(result.current.isExpired).toBe(true);
    expect(result.current.secondsRemaining).toBe(0);
    expect(result.current.formattedTime).toBe("00:00");
  });

  it("não deve ativar aviso quando o tempo restante for maior que o limiar (ex: 10 minutos)", () => {
    const now = new Date("2026-09-16T12:00:00.000Z").getTime();
    vi.setSystemTime(now);

    const expiresAt = new Date(now + 600 * 1000).toISOString();
    const onTimeout = vi.fn();

    const { result } = renderHook(() =>
      useSessionTimeout({
        expiresAt,
        warningSeconds: 300,
        isAuthenticated: true,
        onTimeout,
      }),
    );

    expect(result.current.isWarning).toBe(false);
    expect(result.current.isExpired).toBe(false);
    expect(result.current.formattedTime).toBe("10:00");
    expect(result.current.secondsRemaining).toBe(600);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("deve retornar zeros e não disparar timeout quando usuário não estiver autenticado", () => {
    const now = new Date("2026-09-16T12:00:00.000Z").getTime();
    vi.setSystemTime(now);

    const onTimeout = vi.fn();

    const { result } = renderHook(() =>
      useSessionTimeout({
        expiresAt: new Date(now + 1000).toISOString(),
        warningSeconds: 300,
        isAuthenticated: false,
        onTimeout,
      }),
    );

    expect(result.current.secondsRemaining).toBe(0);
    expect(result.current.formattedTime).toBe("00:00");
    expect(result.current.isWarning).toBe(false);
    expect(result.current.isExpired).toBe(false);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("deve atualizar dinamicamente quando a sessão for estendida (renovação)", () => {
    const now = new Date("2026-09-16T12:00:00.000Z").getTime();
    vi.setSystemTime(now);

    let currentExpiresAt = new Date(now + 150 * 1000).toISOString();
    const onTimeout = vi.fn();

    const { result, rerender } = renderHook(
      ({ exp }) =>
        useSessionTimeout({
          expiresAt: exp,
          warningSeconds: 300,
          isAuthenticated: true,
          onTimeout,
        }),
      { initialProps: { exp: currentExpiresAt } },
    );

    expect(result.current.isWarning).toBe(true);
    expect(result.current.formattedTime).toBe("02:30");

    // Simula renovação da sessão estendendo para 60 minutos
    currentExpiresAt = new Date(now + 3600 * 1000).toISOString();
    rerender({ exp: currentExpiresAt });

    expect(result.current.isWarning).toBe(false);
    expect(result.current.formattedTime).toBe("60:00");
    expect(result.current.secondsRemaining).toBe(3600);
  });

  it("deve garantir que onTimeout é invocado apenas uma vez mesmo após múltiplos ticks no tempo esgotado", () => {
    const now = new Date("2026-09-16T12:00:00.000Z").getTime();
    vi.setSystemTime(now);

    const expiresAt = new Date(now + 1000).toISOString();
    const onTimeout = vi.fn();

    renderHook(() =>
      useSessionTimeout({
        expiresAt,
        warningSeconds: 300,
        isAuthenticated: true,
        onTimeout,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onTimeout).toHaveBeenCalledTimes(1);
  });
});
