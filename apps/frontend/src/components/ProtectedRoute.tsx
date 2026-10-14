import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * [RF002 / NF009]: Guarda de autenticação, carregamento acessível e trava obrigatória de troca de senha.
 * @param props - Componentes filhos a serem renderizados quando a rota for autorizada.
 * @returns Splash acessível, redirecionamento ou filhos protegidos.
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { status, isAuthenticated, usuario } = useAuth();
  const location = useLocation();

  if (status === "carregando") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="min-h-screen flex items-center justify-center bg-canvas-bg"
      >
        <span className="sr-only">Carregando sessão...</span>
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || status === "nao_autenticado") {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isRotaTrocaSenha =
    location.pathname === "/trocar-senha-obrigatoria" ||
    location.pathname === "/trocar-senha";

  // Se o usuário precisa trocar a senha obrigatoriamente (RF003 / Guarda Anti-Desvio)
  if (usuario?.deveTrocarSenha && !isRotaTrocaSenha) {
    return <Navigate to="/trocar-senha-obrigatoria" replace />;
  }

  // Se a conta não tem pendência de troca mas tenta acessar a rota de troca de senha
  if (!usuario?.deveTrocarSenha && isRotaTrocaSenha) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

