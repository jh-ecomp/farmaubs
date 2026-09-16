import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../../contexts/AuthContext";
import { authService, AuthError } from "../../services/api";
import { IndicadorForcaSenha } from "./components/IndicadorForcaSenha";
import iconeFarmaUbs from "../../assets/logofarmaubs.svg";

// Schema de validação client-side com Zod (RF003 / AC-05)
export const trocarSenhaSchema = z
  .object({
    novaSenha: z
      .string()
      .min(8, "A senha deve ter no mínimo 8 caracteres")
      .regex(/[A-Z]/, "A senha deve conter ao menos uma letra maiúscula")
      .regex(/[a-z]/, "A senha deve conter ao menos uma letra minúscula")
      .regex(/[0-9]/, "A senha deve conter ao menos um número")
      .regex(
        /[@$!%*?&#]/,
        "A senha deve conter ao menos um caractere especial (@$!%*?&#)",
      ),
    confirmacaoSenha: z.string().min(1, "A confirmação de senha é obrigatória"),
  })
  .refine((data) => data.novaSenha === data.confirmacaoSenha, {
    message: "As senhas não coincidem",
    path: ["confirmacaoSenha"],
  });

export type TrocarSenhaFormInputs = z.infer<typeof trocarSenhaSchema>;

export default function TrocarSenha() {
  const navigate = useNavigate();
  const { usuario, logout, atualizarDeveTrocarSenha } = useAuth();

  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erroApi, setErroApi] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<TrocarSenhaFormInputs>({
    resolver: zodResolver(trocarSenhaSchema),
    mode: "onChange",
    defaultValues: {
      novaSenha: "",
      confirmacaoSenha: "",
    },
  });

  const novaSenhaValor = watch("novaSenha") || "";

  const onSubmit = async (dados: TrocarSenhaFormInputs) => {
    setErroApi(null);
    setIsSubmitting(true);

    try {
      await authService.trocarSenha({
        novaSenha: dados.novaSenha,
        confirmacaoSenha: dados.confirmacaoSenha,
      });

      // Atualiza o estado da sessão local (RF003 / Conclusão e Desbloqueio)
      atualizarDeveTrocarSenha(false);
      setSucesso(true);

      // Redireciona para o dashboard
      setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 1200);
    } catch (err) {
      if (err instanceof AuthError) {
        setErroApi(err.message);
      } else {
        setErroApi(
          "Não foi possível redefinir sua senha no momento. Tente novamente.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelar = () => {
    logout("Operação cancelada pelo usuário.");
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-canvas-bg flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      {/* CARD PRINCIPAL FOCADO DE SEGURANÇA */}
      <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl border border-border-crisp p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* LOGO & CABEÇALHO */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center mb-1">
            <img
              src={iconeFarmaUbs}
              alt="FarmaUBS"
              className="h-12 w-auto object-contain"
            />
          </div>
          <h1 className="font-headline-md text-headline-md text-text-primary tracking-tight">
            Primeiro Acesso ao FarmaUBS
          </h1>
          <p className="font-body-md text-body-md text-text-secondary">
            Defina sua nova senha pessoal para continuar
          </p>
          {usuario?.email && (
            <p className="font-caption-micro text-caption-micro text-text-tertiary">
              Conectado como:{" "}
              <span className="font-body-md-medium text-text-secondary">
                {usuario.email}
              </span>
            </p>
          )}
        </div>

        {/* FEEDBACK DE SUCESSO */}
        {sucesso && (
          <div
            role="status"
            aria-live="polite"
            className="p-4 rounded-xl bg-status-optimal-bg/20 border border-status-optimal-fg/30 flex items-center gap-3 text-status-optimal-fg"
          >
            <span className="material-symbols-outlined text-[24px] shrink-0">
              check_circle
            </span>
            <div>
              <p className="font-body-md-medium text-body-md leading-none">
                Senha redefinida com sucesso!
              </p>
              <p className="font-caption-micro opacity-90 mt-1">
                Redirecionando para o painel de trabalho...
              </p>
            </div>
          </div>
        )}

        {/* FEEDBACK DE ERRO DA API */}
        {erroApi && (
          <div
            role="alert"
            aria-live="assertive"
            className="p-3.5 rounded-xl bg-error-container/20 border border-error/30 text-error flex items-start gap-2.5 text-body-md"
          >
            <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">
              error
            </span>
            <span className="leading-snug">{erroApi}</span>
          </div>
        )}

        {/* FORMULÁRIO */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          {/* CAMPO NOVA SENHA */}
          <div>
            <label
              htmlFor="novaSenha"
              className="block font-label-caps text-label-caps uppercase text-text-secondary mb-1.5"
            >
              Nova Senha Pessoal
            </label>
            <div className="relative">
              <input
                id="novaSenha"
                type={mostrarNovaSenha ? "text" : "password"}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.novaSenha)}
                aria-describedby={
                  errors.novaSenha ? "novaSenha-error" : undefined
                }
                placeholder="Crie sua senha segura..."
                {...register("novaSenha")}
                className={`w-full text-body-md px-3.5 py-2.5 pr-10 bg-surface-container-lowest border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-text-primary placeholder:text-text-tertiary ${
                  errors.novaSenha
                    ? "border-error focus:border-error focus:ring-error/20"
                    : "border-border-crisp"
                }`}
              />
              <button
                type="button"
                onClick={() => setMostrarNovaSenha((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary p-1 rounded transition-colors"
                aria-label={
                  mostrarNovaSenha
                    ? "Ocultar nova senha"
                    : "Visualizar nova senha"
                }
              >
                <span className="material-symbols-outlined text-[20px]">
                  {mostrarNovaSenha ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
            {errors.novaSenha && (
              <p
                id="novaSenha-error"
                role="alert"
                className="font-caption-micro text-caption-micro text-error mt-1"
              >
                {errors.novaSenha.message}
              </p>
            )}
          </div>

          {/* MEDIDOR VISUAL DE FORÇA DA SENHA */}
          <IndicadorForcaSenha senha={novaSenhaValor} />

          {/* CAMPO CONFIRMAÇÃO DE SENHA */}
          <div className="pt-1">
            <label
              htmlFor="confirmacaoSenha"
              className="block font-label-caps text-label-caps uppercase text-text-secondary mb-1.5"
            >
              Confirmar Nova Senha
            </label>
            <div className="relative">
              <input
                id="confirmacaoSenha"
                type={mostrarConfirmacao ? "text" : "password"}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.confirmacaoSenha)}
                aria-describedby={
                  errors.confirmacaoSenha ? "confirmacaoSenha-error" : undefined
                }
                placeholder="Digite novamente a nova senha..."
                {...register("confirmacaoSenha")}
                className={`w-full text-body-md px-3.5 py-2.5 pr-10 bg-surface-container-lowest border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-text-primary placeholder:text-text-tertiary ${
                  errors.confirmacaoSenha
                    ? "border-error focus:border-error focus:ring-error/20"
                    : "border-border-crisp"
                }`}
              />
              <button
                type="button"
                onClick={() => setMostrarConfirmacao((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary p-1 rounded transition-colors"
                aria-label={
                  mostrarConfirmacao
                    ? "Ocultar confirmação de senha"
                    : "Visualizar confirmação de senha"
                }
              >
                <span className="material-symbols-outlined text-[20px]">
                  {mostrarConfirmacao ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
            {errors.confirmacaoSenha && (
              <p
                id="confirmacaoSenha-error"
                role="alert"
                className="font-caption-micro text-caption-micro text-error mt-1"
              >
                {errors.confirmacaoSenha.message}
              </p>
            )}
          </div>

          {/* BOTÕES DE AÇÃO */}
          <div className="pt-4 flex flex-col sm:flex-row-reverse items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting || !isValid}
              className="w-full sm:flex-1 px-5 py-2.5 rounded-lg bg-primary text-on-primary hover:bg-primary-hover font-body-md-medium text-body-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              {isSubmitting && (
                <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
              )}
              <span>
                {isSubmitting ? "Salvando..." : "Confirmar Nova Senha"}
              </span>
            </button>

            <button
              type="button"
              onClick={handleCancelar}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-border-crisp text-text-secondary hover:bg-surface-subtle font-body-md-medium text-body-md transition-colors"
            >
              Cancelar e Sair
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
