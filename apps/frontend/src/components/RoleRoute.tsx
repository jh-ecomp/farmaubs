import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface RoleRouteProps {
  allowedRoles: string[];
  children?: React.ReactNode;
}

export function RoleRoute({ allowedRoles, children }: RoleRouteProps) {
  const { isAuthenticated, usuario } = useAuth();

  if (!isAuthenticated || !usuario) {
    return <Navigate to="/login" replace />;
  }

  const perfilCodigo = (usuario.perfilCodigo ?? "").toUpperCase();
  const temPermissao = allowedRoles.some(
    (role) => role.toUpperCase() === perfilCodigo,
  );

  if (!temPermissao) {
    return <Navigate to="/403" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
