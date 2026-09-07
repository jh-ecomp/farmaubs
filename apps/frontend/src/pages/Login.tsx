import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

// AJUSTE AQUI: Como o arquivo está em /pages, usamos "../" para importar da raiz do src
import "../index.css";
import { useAuth } from "../contexts/AuthContext";
import logoFarmaUbs from "../assets/logofarmaubs.svg";

// 1. Definindo as regras de validação (Zod) conforme o DoD
const loginSchema = z.object({
  email: z
    .string()
    .min(1, "O e-mail é obrigatório.")
    .email("Formato de e-mail inválido."),
  senha: z.string().min(8, "A senha deve ter no mínimo 8 caracteres."),
});

type LoginFormInputs = z.infer<typeof loginSchema>;

export default function Login() {
  // Renomeei de App para Login para ficar semântico
  const [erroApi, setErroApi] = useState("");
  const { login } = useAuth(); // AC-10: Contexto de Autenticação
  const navigate = useNavigate(); // Para redirecionar após login bem-sucedido

  // 2. Configurando o React Hook Form (Agora validando apenas no Submit)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
    mode: "onSubmit", // O erro só aparece depois de tentar enviar
  });

  // 3. Integração AC-11 com TanStack Query (ADR-013)
  const loginMutation = useMutation({
    mutationFn: async (dadosLogin: LoginFormInputs) => {
      // Endpoint exigido na AC-11
      const resposta = await fetch("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dadosLogin),
      });

      if (!resposta.ok) throw new Error("Falha na autenticação");
      return resposta.json(); // Retorna token, expiresAt, ttlSeconds, etc.
    },
    onSuccess: (data) => {
      setErroApi("");

      // Chamando a função do AuthContext para salvar a sessão globalmente
      login({
        token: data.token,
        expiresAt: data.expiresAt,
        ttlSeconds: data.ttlSeconds,
        warningSeconds: data.warningSeconds,
        usuario: data.usuario,
      });

      console.log("Sessão salva com sucesso no AuthContext!", data);
      navigate("/dashboard");
    },
    onError: () => {
      // Mensagem genérica para respeitar a NF001 (Segurança contra Enumeração)
      setErroApi("E-mail ou senha incorretos.");
    },
  });

  // 4. Função disparada ao clicar em Entrar
  const onSubmit = (data: LoginFormInputs) => {
    setErroApi("");
    loginMutation.mutate(data); // Dispara a requisição para o NestJS
  };

  return (
    <div className="login-container1">
      {/* Cartão de Autenticação Central */}
      <div className="login-thq-main-authentication-card-level1-elevation-elm">
        <div className="login-thq-header-typographymargin-elm">
          {/* LOGO */}
          <img
            src={logoFarmaUbs}
            alt="Logo FarmaUBS"
            style={{
              height: "48px",
              marginBottom: "16px",
            }}
          ></img>
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
        </div>

        {/* Formulário integrado com o layout novo */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="login-thq-login-form-elm"
        >
          {/* Campo de E-mail */}
          <div className="login-thq-input1-email-institucional-elm">
            <label
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "14px",
                fontWeight: 500,
                color: "#334155",
              }}
            >
              E-mail institucional
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
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              >
                ✉
              </span>
              <input
                className="login-thq-input-elm1"
                type="email"
                placeholder="farmaceutico@saude.parnaiba.pi.gov.br"
                style={{ paddingLeft: "36px" }}
                {...register("email")}
              />
            </div>

            {/* Mensagem de Erro Acessível */}
            {errors.email && (
              <span
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
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "14px",
                fontWeight: 500,
                color: "#334155",
              }}
            >
              Senha
              <span
                style={{
                  fontSize: "11px",
                  color: "#0b3099",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Esqueceu sua senha?
              </span>
            </label>

            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              >
                🔒
              </span>
              <input
                className="login-thq-input-elm2"
                type="password"
                placeholder="••••••••"
                style={{ paddingLeft: "36px" }}
                {...register("senha")}
              />
            </div>

            {errors.senha && (
              <span
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

          <div className="login-thq-primary-cta-buttonmargin-elm">
            <button
              type="submit"
              className="login-thq-primary-cta-button-elm"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Entrando..." : "Entrar no FarmaUBS"}
            </button>
          </div>
        </form>

        <div className="login-thq-divider-sectionmargin-elm">
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
            <span>📋</span> Solicite cadastro junto à coordenação CAF
          </div>
        </div>

        {erroApi && (
          <div
            style={{
              width: "100%",
              marginTop: "16px",
              padding: "12px",
              border: "1px dashed #666",
              backgroundColor: "#e4e4e4",
              borderRadius: "4px",
              fontSize: "13px",
              textAlign: "center",
            }}
          >
            ⚠ {erroApi}
          </div>
        )}
      </div>

      {/* TEXTOS OFICIAIS DO GERADOR VISUAL INSERIDOS AQUI */}
      <div
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
          <span>•</span>
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
      </div>
    </div>
  );
}
