import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface RoleRouteProps {
  allowedRoles: string[];
  children?: React.ReactNode;
}

/**
 * [RF002 / RBAC]: Guarda de rotas protegidas por papéis de acesso do usuário autenticado.
 * @param props - Propriedades com perfis permitidos e componentes filhos opcionais.
 * @returns Elemento de rota, splash de carregamento acessível ou redirecionamento (/login ou /403).
 */
export function RoleRoute({ allowedRoles, children }: RoleRouteProps) {
  const { status, isAuthenticated, usuario, hasRole } = useAuth();

  if (status === "carregando") {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <span>Carregando informações da sessão...</span>
      </div>
    );
  }

  if (!isAuthenticated || !usuario) {
    return <Navigate to="/login" replace />;
  }

  const temPermissao = hasRole(allowedRoles);

  if (!temPermissao) {
    return <Navigate to="/403" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

