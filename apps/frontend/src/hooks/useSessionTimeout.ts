import { useState, useEffect, useRef } from "react";

export interface UseSessionTimeoutOptions {
  expiresAt: string | null;
  warningSeconds?: number | null;
  isAuthenticated: boolean;
  onTimeout: () => void;
}

export interface UseSessionTimeoutResult {
  secondsRemaining: number;
  isWarning: boolean;
  isExpired: boolean;
  formattedTime: string;
}

function calculateSecondsRemaining(
  expiresAt: string | null,
  isAuthenticated: boolean,
): number {
  if (!isAuthenticated || !expiresAt) return 0;
  const expiryTime = new Date(expiresAt).getTime();
  if (isNaN(expiryTime)) return 0;
  return Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
}

export function useSessionTimeout({
  expiresAt,
  warningSeconds = 300,
  isAuthenticated,
  onTimeout,
}: UseSessionTimeoutOptions): UseSessionTimeoutResult {
  const threshold = warningSeconds ?? 300;

  const [secondsRemaining, setSecondsRemaining] = useState<number>(() =>
    calculateSecondsRemaining(expiresAt, isAuthenticated),
  );

  const timeoutTriggeredRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    timeoutTriggeredRef.current = false;
    if (!isAuthenticated || !expiresAt) {
      setSecondsRemaining(0);
      return;
    }

    const tick = () => {
      const remaining = calculateSecondsRemaining(expiresAt, isAuthenticated);
      setSecondsRemaining(remaining);

      if (remaining <= 0 && !timeoutTriggeredRef.current) {
        timeoutTriggeredRef.current = true;
        onTimeoutRef.current();
      }
    };

    tick();

    const interval = setInterval(tick, 1000);

    // NF012 / AC-20: Sincronização imediata ao reativar a aba (evita atraso por timer throttling do navegador)
    const handleReactivation = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        tick();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleReactivation);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleReactivation);
    }

    return () => {
      clearInterval(interval);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleReactivation);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", handleReactivation);
      }
    };
  }, [expiresAt, isAuthenticated]);

  const currentRemaining =
    !isAuthenticated || !expiresAt ? 0 : secondsRemaining;

  const minutes = Math.floor(currentRemaining / 60);
  const seconds = currentRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(
    seconds,
  ).padStart(2, "0")}`;

  const isWarning =
    isAuthenticated &&
    Boolean(expiresAt) &&
    currentRemaining > 0 &&
    currentRemaining <= threshold;

  const isExpired =
    isAuthenticated && Boolean(expiresAt) && currentRemaining <= 0;

  return {
    secondsRemaining: currentRemaining,
    isWarning,
    isExpired,
    formattedTime,
  };
}
