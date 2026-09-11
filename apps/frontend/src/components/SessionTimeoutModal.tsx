import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useSessionTimeout } from "../hooks/useSessionTimeout";

export default function SessionTimeoutModal() {
  const navigate = useNavigate();
  const { expiresAt, warningSeconds, isAuthenticated, extendSession, logout } =
    useAuth();

  const [isExtending, setIsExtending] = useState(false);
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleTimeout = () => {
    logout(
      "Sua sessão expirou por inatividade. Faça login novamente para continuar.",
    );
    navigate("/login");
  };

  const { isWarning, formattedTime, secondsRemaining } = useSessionTimeout({
    expiresAt,
    warningSeconds,
    isAuthenticated,
    onTimeout: handleTimeout,
  });

  // Foco inicial no botão primário quando o modal for aberto
  useEffect(() => {
    if (isWarning && primaryButtonRef.current) {
      primaryButtonRef.current.focus();
    }
  }, [isWarning]);

  if (!isWarning) {
    return null;
  }

  const handleExtend = async () => {
    try {
      setIsExtending(true);
      await extendSession();
    } finally {
      setIsExtending(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Se restar menos de 1 minuto, destaca com tom de urgência visual
  const isUrgent = secondsRemaining < 60;

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(2px)",
        padding: "16px",
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-timeout-title"
        aria-describedby="session-timeout-description"
        style={{
          width: "100%",
          maxWidth: "440px",
          backgroundColor: "#FFFFFF",
          borderRadius: "12px",
          boxShadow:
            "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)",
          padding: "28px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          animation: "fadeIn 0.2s ease-out",
        }}
      >
        {/* Cabeçalho com ícone e badge de segurança NF012 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                backgroundColor: isUrgent ? "#FEE2E2" : "#FEF3C7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isUrgent ? "#DC2626" : "#D97706",
              }}
            >
              <span className="material-symbols-outlined text-[24px]">
                timer
              </span>
            </div>
            <h2
              id="session-timeout-title"
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "#0F172A",
                margin: 0,
              }}
            >
              Aviso de Inatividade
            </h2>
          </div>

          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "#001c6d",
              backgroundColor: "#E0E7FF",
              padding: "4px 8px",
              borderRadius: "4px",
            }}
          >
            NF012 / Segurança
          </span>
        </div>

        {/* Descrição acessível */}
        <p
          id="session-timeout-description"
          style={{
            fontSize: "14px",
            lineHeight: "1.5",
            color: "#475569",
            margin: 0,
          }}
        >
          Sua sessão no <strong>FarmaUBS</strong> expirará em breve devido ao
          período de inatividade. Deseja continuar conectado ao sistema?
        </p>

        {/* Box da Contagem Regressiva */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "14px",
            borderRadius: "8px",
            backgroundColor: isUrgent ? "#FEF2F2" : "#FFFBEB",
            border: `1px solid ${isUrgent ? "#FCA5A5" : "#FDE68A"}`,
          }}
        >
          <span
            style={{
              fontSize: "12px",
              fontWeight: 500,
              color: isUrgent ? "#991B1B" : "#92400E",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Tempo restante para encerramento
          </span>
          <span
            style={{
              fontSize: "32px",
              fontWeight: 800,
              color: isUrgent ? "#DC2626" : "#B45309",
              fontVariantNumeric: "tabular-nums",
              marginTop: "4px",
            }}
          >
            {formattedTime}
          </span>
        </div>

        {/* Ações: Continuar Conectado ou Sair */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            marginTop: "4px",
          }}
        >
          <button
            type="button"
            onClick={handleLogout}
            style={{
              flex: 1,
              padding: "10px 16px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#475569",
              backgroundColor: "#FFFFFF",
              border: "1px solid #CBD5E1",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Sair do Sistema
          </button>

          <button
            ref={primaryButtonRef}
            type="button"
            onClick={handleExtend}
            disabled={isExtending}
            style={{
              flex: 1.4,
              padding: "10px 16px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#FFFFFF",
              backgroundColor: "#001c6d",
              border: "none",
              borderRadius: "6px",
              cursor: isExtending ? "not-allowed" : "pointer",
              opacity: isExtending ? 0.7 : 1,
              transition: "all 0.15s ease",
            }}
          >
            {isExtending ? "Renovando..." : "Continuar Conectado"}
          </button>
        </div>
      </div>
    </div>
  );
}
