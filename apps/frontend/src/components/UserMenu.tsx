import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { PerfilCodigo } from "@farmaubs/shared";
import { useAuth } from "../contexts/AuthContext";

/**
 * [RF004 / NF009 / ADR-032]: Menu de perfil do usuário autenticado e ação acessível de logout com descarte de histórico.
 */
export function UserMenu() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  let queryClient: ReturnType<typeof useQueryClient> | null = null;
  try {
    queryClient = useQueryClient();
  } catch {
    // Caso executado fora de QueryClientProvider em testes isolados
  }

  const userNome =
    usuario?.nomeCompleto || usuario?.nome || "Usuário FarmaUBS";
  const userEmail = usuario?.email || "";

  const perfilCodigo =
    usuario?.perfilCodigo ||
    (Array.isArray(usuario?.perfil) ? usuario.perfil[0] : "") ||
    "";

  const getPerfilLabel = (codigo: string) => {
    switch (codigo) {
      case PerfilCodigo.ADMINISTRADOR:
      case "ADMIN":
        return "Administrador Geral";
      case PerfilCodigo.GERENTE:
      case "GESTOR":
        return "Gerente de Unidade";
      case PerfilCodigo.FARMACEUTICO_RESPONSAVEL:
      case "FARM_RESP":
        return "Farmacêutico Responsável";
      case PerfilCodigo.FARMACEUTICO_RESIDENTE:
      case "FARM_RES":
        return "Farmacêutico Residente";
      default:
        return codigo || "Profissional de Saúde";
    }
  };

  const handleLogout = async () => {
    if (queryClient) {
      queryClient.clear();
    }
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div
      className="flex items-center gap-space-md"
      role="region"
      aria-label="Perfil do Usuário e Sessão"
    >
      {/* Badge de Perfil RBAC */}
      <div className="hidden lg:flex items-center gap-space-xs px-2.5 py-1 rounded bg-surface-subtle border border-border-crisp">
        <span
          className="material-symbols-outlined text-[18px] text-primary"
          aria-hidden="true"
        >
          verified_user
        </span>
        <span className="font-label-caps text-label-caps text-primary uppercase font-headline-md text-headline-md">
          {getPerfilLabel(perfilCodigo)}
        </span>
      </div>

      {/* Dados do Usuário */}
      <div className="flex items-center gap-space-xs">
        <div className="text-right hidden sm:block">
          <p className="font-body-md-medium text-body-md-medium text-text-primary leading-none">
            {userNome}
          </p>
          <p className="font-caption-micro text-caption-micro text-text-tertiary mt-1">
            {userEmail}
          </p>
        </div>

        {/* Avatar com inicial */}
        <div
          className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-body-md-medium text-caption-micro"
          title={userNome}
          aria-hidden="true"
        >
          {userNome.charAt(0).toUpperCase()}
        </div>

        {/* Botão Sair (Logout) com foco acessível */}
        <button
          type="button"
          onClick={handleLogout}
          className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-error hover:bg-error-container/20 font-body-md-medium text-body-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
          aria-label="Sair do sistema e encerrar sessão"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            logout
          </span>
          <span className="hidden md:inline">Sair</span>
        </button>
      </div>
    </div>
  );
}

export default UserMenu;
