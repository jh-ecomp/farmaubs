import { useNavigate } from "react-router-dom";
import { ServerCrash, RefreshCw, Home } from "lucide-react";
import logoFarmaUbs from "../assets/logofarmaubs.svg";
import "../index.css";

interface ServerErrorProps {
  statusCode?: number;
  mensagem?: string;
  onRetry?: () => void;
}

export function ServerError({
  statusCode = 500,
  mensagem = "Ocorreu uma instabilidade inesperada nos servidores do FarmaUBS. Nossos serviços podem estar temporariamente indisponíveis.",
  onRetry,
}: ServerErrorProps) {
  const navigate = useNavigate();

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="login-container1">
      <main
        className="login-thq-main-authentication-card-level1-elevation-elm"
        style={{ textAlign: "center", maxWidth: "480px" }}
        role="main"
        aria-labelledby="server-error-title"
      >
        <img
          src={logoFarmaUbs}
          alt="Logo FarmaUBS"
          style={{ height: "48px", marginBottom: "16px" }}
        />

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            backgroundColor: "#fef2f2",
            color: "#dc2626",
            margin: "0 auto 16px auto",
          }}
        >
          <ServerCrash size={32} />
        </div>

        <span
          style={{
            display: "inline-block",
            fontSize: "12px",
            fontWeight: 700,
            color: "#dc2626",
            backgroundColor: "#fee2e2",
            padding: "2px 8px",
            borderRadius: "4px",
            marginBottom: "8px",
          }}
        >
          ERRO {statusCode} • INSTABILIDADE NO SERVIDOR
        </span>

        <h1
          id="server-error-title"
          style={{
            fontSize: "22px",
            color: "#0F172A",
            fontWeight: 700,
            margin: "0 0 8px 0",
          }}
        >
          Serviço Temporariamente Indisponível
        </h1>

        <p
          style={{
            fontSize: "14px",
            color: "#64748B",
            lineHeight: "1.5",
            margin: "0 0 24px 0",
            maxWidth: "380px",
          }}
        >
          {mensagem}
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: "12px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={handleRetry}
            className="login-thq-primary-cta-button-elm"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "10px 18px",
              width: "auto",
            }}
          >
            <RefreshCw size={16} />
            Tentar Novamente
          </button>

          <button
            type="button"
            onClick={() => navigate("/")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "10px 18px",
              borderRadius: "8px",
              backgroundColor: "#f1f5f9",
              color: "#334155",
              fontWeight: 600,
              fontSize: "14px",
              border: "1px solid #cbd5e1",
              cursor: "pointer",
            }}
          >
            <Home size={16} />
            Ir para o Início
          </button>
        </div>
      </main>

      <footer
        style={{
          textAlign: "center",
          marginTop: "32px",
          color: "#64748B",
          fontSize: "11px",
        }}
      >
        Sistema Integrado de Gestão Farmacêutica • SUS
      </footer>
    </div>
  );
}

export default ServerError;
