import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AdminCadastro from "./pages/AdminCadastro";
import EmDesenvolvimento from "./pages/EmDesenvolvimento";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import SessionTimeoutModal from "./components/SessionTimeoutModal";

export default function App() {
  return (
    <BrowserRouter>
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

        {/* Redirecionamento da raiz para login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Rota padrão 404 para qualquer caminho não reconhecido */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
