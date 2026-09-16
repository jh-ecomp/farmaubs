import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AdminCadastro from "./pages/AdminCadastro";
import EmDesenvolvimento from "./pages/EmDesenvolvimento";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import SessionTimeoutModal from "./components/SessionTimeoutModal";
import { RoleRoute } from "./components/RoleRoute";
import { AdminUsuarios } from "./pages/AdminUsuarios";
import { AccessDenied } from "./pages/AccessDenied";
import { ServerError } from "./pages/ServerError";
import { ErrorBoundary } from "./components/ErrorBoundary";

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        {/* Modal global de aviso de expiração de sessão (NF012 / AC-10) */}
        <SessionTimeoutModal />
        <Routes>
          {/* Rota pública da tela de Login (ADR-012) */}
          <Route path="/login" element={<Login />} />

          {/* Rotas protegidas (exigem login ativo) */}
          <Route
            path="/em-desenvolvimento"
            element={
              <ProtectedRoute>
                <EmDesenvolvimento />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/cadastro"
            element={
              <ProtectedRoute>
                <AdminCadastro />
              </ProtectedRoute>
            }
          />

          {/* Acesso Negado (403 - RBAC) */}
          <Route path="/403" element={<AccessDenied />} />

          {/* Erro Interno / Indisponibilidade do Servidor (5xx) */}
          <Route path="/500" element={<ServerError />} />

          {/* Painel Administrativo de Gestão de Usuários */}
          <Route
            path="/admin/usuarios"
            element={
              <RoleRoute allowedRoles={["ADMINISTRADOR"]}>
                <AdminUsuarios />
              </RoleRoute>
            }
          />

          {/* Redirecionamento da raiz para login */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Rota padrão 404 para qualquer caminho não reconhecido */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
