import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { status, isAuthenticated, usuario } = useAuth();
  const location = useLocation();

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
