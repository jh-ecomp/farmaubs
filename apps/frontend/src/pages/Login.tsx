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
  const { login } = useAuth(); // Contexto de Autenticação (ADR-013)
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

      // Redirecionamento ao dashboard da UBS padrão (RF002 / Cenário 1)
      navigate("/dashboard");
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
    loginMutation.mutate(data);
  };

  const handleForgotPassword = () => {
    // Cenário 7: Acesso à recuperação de senha (RF003)
    alert(
      "Para recuperar o acesso, contate o gestor CAF do seu município ou use o canal institucional de suporte.",
    );
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
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                }}
              >
                ✉
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
                style={{ paddingLeft: "36px" }}
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
            <label
              htmlFor="senha"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "14px",
                fontWeight: 500,
                color: "#334155",
              }}
            >
              <span>Senha</span>
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
            </label>

            <div style={{ position: "relative" }}>
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                }}
              >
                🔒
              </span>
              <input
                id="senha"
                className="login-thq-input-elm2"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                aria-required="true"
                aria-invalid={errors.senha ? "true" : "false"}
                aria-describedby={errors.senha ? "senha-error" : undefined}
                style={{ paddingLeft: "36px" }}
                {...register("senha")}
              />
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
          <div style={{ fontSize: "14px", color: "#001c6d", fontWeight: 700 }}>
            <span aria-hidden="true">📋 </span> Solicite cadastro junto à
            coordenação CAF
          </div>
        </section>

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
    </div>
  );
}
