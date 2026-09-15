import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, usuario } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Se o usuário precisa trocar a senha obrigatoriamente (RF003 / Guarda Anti-Desvio)
  if (usuario?.deveTrocarSenha && location.pathname !== "/trocar-senha") {
    return <Navigate to="/trocar-senha" replace />;
  }

  // Se a conta não tem pendência de troca mas tenta acessar /trocar-senha
  if (!usuario?.deveTrocarSenha && location.pathname === "/trocar-senha") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
