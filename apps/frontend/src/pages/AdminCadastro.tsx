import { useNavigate } from "react-router-dom";
import { UserPlus, ArrowLeft, ShieldCheck } from "lucide-react";
import logoFarmaUbs from "../assets/logofarmaubs.svg";
import "../index.css";

export default function AdminCadastro() {
  const navigate = useNavigate();

  return (
    <div className="login-container1">
      <main
        className="login-thq-main-authentication-card-level1-elevation-elm"
        style={{ maxWidth: "560px", textAlign: "left" }}
      >
        <div
          style={{ textAlign: "center", width: "100%", marginBottom: "16px" }}
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
              gap: "6px",
              backgroundColor: "#e6eeff",
              color: "#001c6d",
              padding: "4px 10px",
              borderRadius: "4px",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            <ShieldCheck size={16} /> Módulo de Administração
          </div>
          <h1
            style={{
              fontSize: "22px",
              color: "#0F172A",
              fontWeight: 700,
              margin: "12px 0 4px 0",
            }}
          >
            Cadastro de Usuários e Farmacêuticos
          </h1>
          <p style={{ fontSize: "14px", color: "#64748B", margin: 0 }}>
            Gerenciamento de acessos e permissões por UBS e CAF
          </p>
        </div>

        <div
          style={{
            width: "100%",
            backgroundColor: "#f8fafc",
            border: "1px dashed #cbd5e1",
            borderRadius: "6px",
            padding: "24px",
            textAlign: "center",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              backgroundColor: "#eff6ff",
              color: "#0b3099",
              marginBottom: "12px",
            }}
          >
            <UserPlus size={24} />
          </div>
          <h2
            style={{ fontSize: "16px", color: "#1e293b", margin: "0 0 8px 0" }}
          >
            Estrutura da Tela em Preparação
          </h2>
          <p
            style={{
              fontSize: "13px",
              color: "#64748B",
              margin: "0 0 16px 0",
              lineHeight: "1.5",
            }}
          >
            Esta tela receberá os campos de cadastro (nome, CPF, CNS, e-mail
            institucional, perfil RBAC e vinculação de UBS).
          </p>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="login-thq-primary-cta-button-elm"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              maxWidth: "220px",
              margin: "0 auto",
            }}
          >
            <ArrowLeft size={16} />
            Voltar ao Dashboard
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
