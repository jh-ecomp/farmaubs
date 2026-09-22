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

  const rawPerfil = (usuario as any).perfilCodigo ?? (usuario as any).perfil;
  const perfisUsuario = Array.isArray(rawPerfil)
    ? rawPerfil.map((p) => String(p).toUpperCase())
    : typeof rawPerfil === "string" && rawPerfil.length > 0
      ? [rawPerfil.toUpperCase()]
      : [];

  const temPermissao = allowedRoles.some((role) =>
    perfisUsuario.includes(role.toUpperCase()),
  );

  if (!temPermissao) {
    return <Navigate to="/403" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
