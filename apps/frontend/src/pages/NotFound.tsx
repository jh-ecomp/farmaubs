import { useNavigate } from "react-router-dom";
import { Compass, Home } from "lucide-react";
import logoFarmaUbs from "../assets/logofarmaubs.svg";
import "../index.css";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="login-container1">
      <main
        className="login-thq-main-authentication-card-level1-elevation-elm"
        style={{ textAlign: "center" }}
      >
        <img
          src={logoFarmaUbs}
          alt="Logo FarmaUBS"
          style={{ height: "48px", marginBottom: "8px" }}
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
          <Compass size={32} />
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
          ERRO 404
        </span>

        <h1
          style={{
            fontSize: "22px",
            color: "#0F172A",
            fontWeight: 700,
            margin: "0 0 8px 0",
          }}
        >
          Página não encontrada
        </h1>

        <p
          style={{
            fontSize: "14px",
            color: "#64748B",
            lineHeight: "1.5",
            margin: "0 0 24px 0",
            maxWidth: "360px",
          }}
        >
          O endereço acessado não existe, foi alterado ou está temporariamente
          indisponível.
        </p>

        <button
          type="button"
          onClick={() => navigate("/login")}
          className="login-thq-primary-cta-button-elm"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            maxWidth: "240px",
          }}
        >
          <Home size={16} />
          Voltar ao Início
        </button>
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
