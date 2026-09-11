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

  useEffect(() => {
    timeoutTriggeredRef.current = false;
    if (!isAuthenticated || !expiresAt) {
      return;
    }

    const tick = () => {
      const remaining = calculateSecondsRemaining(expiresAt, isAuthenticated);
      setSecondsRemaining(remaining);

      if (remaining <= 0 && !timeoutTriggeredRef.current) {
        timeoutTriggeredRef.current = true;
        onTimeout();
      }
    };

    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, isAuthenticated, onTimeout]);

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
