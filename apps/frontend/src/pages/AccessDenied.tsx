import { useNavigate } from "react-router-dom";

/**
 * [NF009 / ADR-032]: Página de Acesso Negado (403) com anúncio acessível para leitores de tela e retorno ao Dashboard.
 */
export function AccessDenied() {
  const navigate = useNavigate();

  return (
    <main
      className="min-h-screen bg-canvas-bg flex flex-col items-center justify-center p-4 text-center select-none"
      role="main"
      aria-labelledby="access-denied-title"
    >
      <div
        role="alert"
        aria-live="assertive"
        className="max-w-md w-full bg-surface-container-lowest border border-border-crisp rounded-xl p-space-xl shadow-lg flex flex-col items-center gap-space-md"
      >
        <div className="w-16 h-16 rounded-full bg-error-container text-error flex items-center justify-center">
          <span
            className="material-symbols-outlined text-[36px]"
            aria-hidden="true"
          >
            lock_person
          </span>
        </div>

        <span className="px-2.5 py-1 rounded-full bg-error-container text-error font-label-caps text-label-caps uppercase tracking-wider">
          Erro 403 • Acesso Negado
        </span>

        <h1
          id="access-denied-title"
          className="font-headline-lg text-headline-lg text-text-primary"
        >
          Acesso Não Autorizado
        </h1>

        <p className="font-body-md text-body-md text-text-secondary leading-relaxed">
          Acesso Negado: Seu perfil não possui permissão para acessar este recurso.
          Esta restrição segue a política de controle de acesso (RBAC) e segurança do sistema FarmaUBS.
        </p>

        <div className="w-full pt-space-xs flex flex-col sm:flex-row gap-2 justify-center">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary/90 font-body-md-medium text-body-md transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Voltar ao Dashboard
          </button>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="px-4 py-2 rounded-lg bg-surface-subtle text-text-secondary hover:bg-surface-container font-body-md text-body-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Ir para o Login
          </button>
        </div>
      </div>
    </main>
  );
}

export default AccessDenied;

