import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import "../index.css";
import { useAuth } from "../contexts/AuthContext";
import { authService, AuthError } from "../services/api";
import logoFarmaUbs from "../assets/logofarmaubs.svg";

// 1. Definindo as regras de validação (Zod) conforme os critérios e cenários 2 e 3
const loginSchema = z.object({
  email: z
    .string()
    .min(1, "O e-mail é obrigatório.")
    .trim()
    .toLowerCase()
    .email("Formato de e-mail inválido."),
  senha: z
    .string()
    .min(1, "A senha é obrigatória.")
    .min(8, "A senha deve ter no mínimo 8 caracteres."),
});

type LoginFormInputs = z.infer<typeof loginSchema>;

export default function Login() {
  const [erroApi, setErroApi] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const { login, logoutReason, clearLogoutReason } = useAuth(); // Contexto de Autenticação (ADR-013)
  const navigate = useNavigate(); // Redirecionar após login bem-sucedido (RF002)

  // 2. Configurando o React Hook Form (validando no submit)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
    mode: "onSubmit",
  });

  // 3. Mutação via TanStack Query (ADR-013 / AC-11)
  const loginMutation = useMutation({
    mutationFn: async (dadosLogin: LoginFormInputs) => {
      return await authService.login(dadosLogin);
    },
    onSuccess: (data) => {
      setErroApi("");
      // Armazenando sessão completa no contexto de autenticação (ADR-013 / AC-10)
      login({
        token: data.token,
        expiresAt: data.expiresAt,
        ttlSeconds: data.ttlSeconds,
        warningSeconds: data.warningSeconds,
        usuario: data.usuario,
      });

      // Redirecionamento padrão para a tela de 'Em Desenvolvimento' enquanto as próximas telas são construídas
      navigate("/em-desenvolvimento");
    },
    onError: (error: unknown) => {
      // Cenários 4 (anti-enumeração), 5 (bloqueio temporário) e 6 (erro de rede)
      if (error instanceof AuthError) {
        setErroApi(error.message);
      } else {
        setErroApi("E-mail ou senha incorretos.");
      }
    },
  });

  // 4. Disparo do formulário
  const onSubmit = (data: LoginFormInputs) => {
    setErroApi("");
    clearLogoutReason();
    loginMutation.mutate(data);
  };

  const handleForgotPassword = () => {
    setShowForgotModal(true);
  };

  return (
    <div className="login-container1">
      {/* Cartão de Autenticação Central */}
      <main className="login-thq-main-authentication-card-level1-elevation-elm">
        <header className="login-thq-header-typographymargin-elm">
          {/* LOGO */}
          <img
            src={logoFarmaUbs}
            alt="Logo FarmaUBS"
            style={{
              height: "48px",
              marginBottom: "16px",
            }}
          />
          <h1
            style={{
              fontSize: "24px",
              color: "#0F172A",
              fontWeight: 700,
              margin: 0,
            }}
          >
            Acesso ao Sistema
          </h1>
          <p style={{ fontSize: "14px", color: "#64748B", margin: 0 }}>
            Insira suas credenciais institucionais
          </p>
        </header>

        {/* Formulário integrado e acessível (ADR-032 / WCAG 2.1 AA) */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="login-thq-login-form-elm"
          noValidate
          aria-label="Formulário de acesso ao FarmaUBS"
        >
          {/* Campo de E-mail */}
          <div className="login-thq-input1-email-institucional-elm">
            <label
              htmlFor="email"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "14px",
                fontWeight: 500,
                color: "#334155",
              }}
            >
              <span>E-mail institucional</span>
              <span
                style={{
                  fontSize: "11px",
                  color: "#001c6d",
                  backgroundColor: "#e6eeff",
                  padding: "2px 6px",
                  borderRadius: "2px",
                }}
              >
                CNES / SUS
              </span>
            </label>

            <div style={{ position: "relative" }}>
              <span
                aria-hidden="true"
                className="material-symbols-outlined text-[20px]"
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  color: "#64748B",
                  fontSize: "20px",
                }}
              >
                mail
              </span>
              <input
                id="email"
                className="login-thq-input-elm1"
                type="email"
                placeholder="farmaceutico@saude.parnaiba.pi.gov.br"
                autoComplete="username"
                aria-required="true"
                aria-invalid={errors.email ? "true" : "false"}
                aria-describedby={errors.email ? "email-error" : undefined}
                style={{ paddingLeft: "38px" }}
                {...register("email")}
              />
            </div>

            {/* Mensagem de Erro Acessível (Cenários 2 e 3) */}
            {errors.email && (
              <span
                id="email-error"
                role="alert"
                aria-live="polite"
                style={{
                  color: "#cc0000",
                  fontSize: "11px",
                  marginTop: "4px",
                  display: "block",
                }}
              >
                {errors.email.message}
              </span>
            )}
          </div>

          {/* Campo de Senha */}
          <div className="login-thq-input2-senha-elm">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <label
                htmlFor="senha"
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#334155",
                }}
              >
                Senha
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontSize: "11px",
                  color: "#0b3099",
                  cursor: "pointer",
                  fontWeight: 700,
                  textDecoration: "underline",
                }}
                aria-label="Esqueceu sua senha? Solicitar recuperação de senha"
              >
                Esqueceu sua senha?
              </button>
            </div>

            <div style={{ position: "relative" }}>
              <span
                aria-hidden="true"
                className="material-symbols-outlined text-[20px]"
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  color: "#64748B",
                  fontSize: "20px",
                }}
              >
                lock
              </span>
              <input
                id="senha"
                className="login-thq-input-elm2"
                type={mostrarSenha ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
                aria-required="true"
                aria-invalid={errors.senha ? "true" : "false"}
                aria-describedby={errors.senha ? "senha-error" : undefined}
                style={{ paddingLeft: "38px", paddingRight: "40px" }}
                {...register("senha")}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((prev) => !prev)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "#64748B",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-label={mostrarSenha ? "Ocultar senha" : "Ver senha"}
              >
                <span
                  className="material-symbols-outlined text-[20px]"
                  id="eyeIcon"
                >
                  {mostrarSenha ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>

            {/* Mensagem de Erro Acessível (Cenário 3) */}
            {errors.senha && (
              <span
                id="senha-error"
                role="alert"
                aria-live="polite"
                style={{
                  color: "#cc0000",
                  fontSize: "11px",
                  marginTop: "4px",
                  display: "block",
                }}
              >
                {errors.senha.message}
              </span>
            )}
          </div>

          {/* Botão de Envio com Loading State (Cenário 1 e NF002) */}
          <div className="login-thq-primary-cta-buttonmargin-elm">
            <button
              type="submit"
              className="login-thq-primary-cta-button-elm"
              disabled={loginMutation.isPending || isSubmitting}
              aria-busy={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Entrando..." : "Entrar no FarmaUBS"}
            </button>
          </div>
        </form>

        <section
          className="login-thq-divider-sectionmargin-elm"
          aria-label="Suporte"
        >
          <div
            style={{
              fontSize: "11px",
              color: "#64748B",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            Suporte Técnico
          </div>
          <div
            style={{
              fontSize: "14px",
              color: "#001c6d",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-[18px]"
            >
              badge
            </span>
            <span>Solicite cadastro junto à coordenação CAF</span>
          </div>
        </section>

        {/* Mensagens de Sessão Expirada / Logout Informativo (NF012 / AC-10) */}
        {logoutReason && (
          <div
            role="alert"
            aria-live="polite"
            style={{
              width: "100%",
              marginTop: "16px",
              padding: "12px 14px",
              border: "1px solid #FCD34D",
              backgroundColor: "#FFFBEB",
              color: "#92400E",
              borderRadius: "6px",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                textAlign: "left",
              }}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={{ color: "#D97706", flexShrink: 0 }}
              >
                lock_clock
              </span>
              <span>{logoutReason}</span>
            </div>
            <button
              type="button"
              onClick={clearLogoutReason}
              aria-label="Fechar aviso de sessão expirada"
              style={{
                background: "transparent",
                border: "none",
                color: "#92400E",
                cursor: "pointer",
                padding: "2px",
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined text-[18px]">
                close
              </span>
            </button>
          </div>
        )}

        {/* Mensagens de Erro da API (Cenários 4, 5 e 6) */}
        {erroApi && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              width: "100%",
              marginTop: "16px",
              padding: "12px",
              border: "1px dashed #ef4444",
              backgroundColor: "#fef2f2",
              color: "#991b1b",
              borderRadius: "4px",
              fontSize: "13px",
              textAlign: "center",
            }}
          >
            <span aria-hidden="true">⚠ </span>
            {erroApi}
          </div>
        )}
      </main>

      {/* Rodapé institucional */}
      <footer
        style={{
          textAlign: "center",
          marginTop: "32px",
          color: "#64748B",
          fontSize: "11px",
          lineHeight: "1.6",
        }}
      >
        <p style={{ margin: "0 0 8px 0" }}>
          Sistema Integrado de Gestão Farmacêutica • Município de Parnaíba - PI
          • SUS
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "12px",
            alignItems: "center",
          }}
        >
          <span>Central de Abastecimento Farmacêutico</span>
          <span aria-hidden="true">•</span>
          <a
            href="#"
            style={{
              color: "#001c6d",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Aviso de Privacidade
          </a>
        </div>
      </footer>

      {/* Modal Acessível "FarmaUBS diz" para Recuperação de Senha */}
      {showForgotModal && (
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
            aria-labelledby="forgot-modal-title"
            aria-describedby="forgot-modal-desc"
            style={{
              width: "100%",
              maxWidth: "420px",
              backgroundColor: "#FFFFFF",
              borderRadius: "10px",
              padding: "24px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
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
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  backgroundColor: "#E0E7FF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#001c6d",
                }}
              >
                <span className="material-symbols-outlined text-[20px]">
                  info
                </span>
              </div>
              <h2
                id="forgot-modal-title"
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "#0F172A",
                  margin: 0,
                }}
              >
                FarmaUBS diz:
              </h2>
            </div>

            <p
              id="forgot-modal-desc"
              style={{
                fontSize: "14px",
                lineHeight: "1.5",
                color: "#475569",
                margin: 0,
              }}
            >
              Para recuperar o acesso, contate a coordenação CAF do seu
              município ou o administrador do sistema FarmaUBS.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                style={{
                  padding: "8px 20px",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#FFFFFF",
                  backgroundColor: "#001c6d",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
