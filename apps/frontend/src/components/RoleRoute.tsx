import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface RoleRouteProps {
  allowedRoles: string[];
  children?: React.ReactNode;
}

/**
 * [RF002 / RBAC / NF009]: Guarda de rotas protegidas por papéis de acesso do usuário autenticado.
 * @param props - Propriedades com perfis permitidos e componentes filhos opcionais.
 * @returns Elemento de rota, splash de carregamento acessível ou redirecionamento (/login ou /403).
 */
export function RoleRoute({ allowedRoles, children }: RoleRouteProps) {
  const { isAuthenticated, usuario, hasRole, status } = useAuth();

  if (status === "carregando") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="min-h-screen flex items-center justify-center bg-canvas-bg"
      >
        <span className="sr-only">Carregando permissões...</span>
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !usuario || status === "nao_autenticado") {
    return <Navigate to="/login" replace />;
  }

  if (usuario.deveTrocarSenha) {
    return <Navigate to="/trocar-senha-obrigatoria" replace />;
  }

  const temPermissao = hasRole(allowedRoles);

  if (!temPermissao) {
    return <Navigate to="/403" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

