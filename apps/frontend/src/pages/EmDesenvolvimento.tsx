import { Construction, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import logoFarmaUbs from "../assets/logofarmaubs.svg";
import "../index.css";

interface EmDesenvolvimentoProps {
  titulo?: string;
  descricao?: string;
}

export default function EmDesenvolvimento({
  titulo = "Funcionalidade em Desenvolvimento",
  descricao = "Esta tela está em desenvolvimento e será disponibilizada nas próximas etapas do FarmaUBS.",
}: EmDesenvolvimentoProps) {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="login-container1">
      <main
        className="login-thq-main-authentication-card-level1-elevation-elm"
        style={{ textAlign: "center", maxWidth: "480px" }}
      >
        {/* LOGO OFICIAL */}
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
            backgroundColor: "#eff6ff",
            color: "#0b3099",
            margin: "0 auto 16px auto",
          }}
        >
          <Construction size={32} />
        </div>

        {/* FRASE PRINCIPAL */}
        <h1
          style={{
            fontSize: "22px",
            color: "#0F172A",
            fontWeight: 700,
            margin: "0 0 8px 0",
          }}
        >
          {titulo}
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
          {descricao}
        </p>

        {isAuthenticated && (
          <button
            type="button"
            onClick={handleLogout}
            className="login-thq-primary-cta-button-elm"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              maxWidth: "200px",
              margin: "0 auto",
            }}
          >
            <LogOut size={16} />
            Sair do Sistema
          </button>
        )}
      </main>

      <footer
        style={{
          textAlign: "center",
          marginTop: "32px",
          color: "#64748B",
          fontSize: "11px",
          lineHeight: "1.6",
        }}
      >
        <p style={{ margin: 0 }}>
          Sistema Integrado de Gestão Farmacêutica • Município de Parnaíba - PI
          • SUS
        </p>
      </footer>
    </div>
  );
}
