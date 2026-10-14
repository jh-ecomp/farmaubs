import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MATRIZ_PERMISSOES_ROTAS } from "@farmaubs/shared";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AdminCadastro from "./pages/AdminCadastro";
import EmDesenvolvimento from "./pages/EmDesenvolvimento";
import NotFound from "./pages/NotFound";
import TrocarSenha from "./pages/TrocarSenha";
import ProtectedRoute from "./components/ProtectedRoute";
import SessionTimeoutModal from "./components/SessionTimeoutModal";
import { RoleRoute } from "./components/RoleRoute";
import { MainLayout } from "./components/MainLayout";
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

          {/* Rota de troca obrigatória de senha (RF003 / ADR-006 / AC-21) */}
          <Route
            path="/trocar-senha-obrigatoria"
            element={
              <ProtectedRoute>
                <TrocarSenha />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trocar-senha"
            element={
              <ProtectedRoute>
                <TrocarSenha />
              </ProtectedRoute>
            }
          />

          {/* Rotas protegidas gerais */}
          <Route
            path="/em-desenvolvimento"
            element={
              <ProtectedRoute>
                <EmDesenvolvimento />
              </ProtectedRoute>
            }
          />

          {/* Dashboard Operacional (Todos os perfis autenticados) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={MATRIZ_PERMISSOES_ROTAS["/dashboard"]}>
                  <Dashboard />
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          {/* Rotas de Operação da UBS */}
          <Route
            path="/estoque"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={MATRIZ_PERMISSOES_ROTAS["/estoque"]}>
                  <MainLayout titulo="Controle de Estoque">
                    <EmDesenvolvimento
                      titulo="Controle de Estoque"
                      descricao="Módulo de estoque, entradas e lotes de medicamentos em desenvolvimento."
                    />
                  </MainLayout>
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/dispensas"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={MATRIZ_PERMISSOES_ROTAS["/dispensas"]}>
                  <MainLayout titulo="Dispensação de Medicamentos">
                    <EmDesenvolvimento
                      titulo="Dispensação"
                      descricao="Módulo de registro e conferência de dispensações em desenvolvimento."
                    />
                  </MainLayout>
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/indicadores"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={MATRIZ_PERMISSOES_ROTAS["/indicadores"]}>
                  <MainLayout titulo="Indicadores Operacionais">
                    <EmDesenvolvimento
                      titulo="Indicadores"
                      descricao="Módulo de métricas operacionais e curva ABC em desenvolvimento."
                    />
                  </MainLayout>
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          {/* Gestão & Controle */}
          <Route
            path="/relatorios"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={MATRIZ_PERMISSOES_ROTAS["/relatorios"]}>
                  <MainLayout titulo="Relatórios & Inventário">
                    <EmDesenvolvimento
                      titulo="Relatórios"
                      descricao="Módulo de emissão de relatórios gerenciais e perdas em desenvolvimento."
                    />
                  </MainLayout>
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/parametros"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={MATRIZ_PERMISSOES_ROTAS["/parametros"]}>
                  <MainLayout titulo="Parâmetros do Sistema">
                    <EmDesenvolvimento
                      titulo="Parâmetros"
                      descricao="Módulo de limiares de alerta e estoque de segurança em desenvolvimento."
                    />
                  </MainLayout>
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          {/* Governança & Auditoria */}
          <Route
            path="/log-auditoria"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={MATRIZ_PERMISSOES_ROTAS["/log-auditoria"]}>
                  <MainLayout titulo="Trilha de Auditoria">
                    <EmDesenvolvimento
                      titulo="Auditoria (Logs)"
                      descricao="Consulta de eventos e trilha de auditoria em desenvolvimento."
                    />
                  </MainLayout>
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          {/* Painel Administrativo de Gestão de Usuários (AC-08 / AC-12 / AC-21) */}
          <Route
            path="/usuarios"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={MATRIZ_PERMISSOES_ROTAS["/usuarios"]}>
                  <AdminUsuarios />
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          {/* Gestão de UBSs */}
          <Route
            path="/ubs"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={MATRIZ_PERMISSOES_ROTAS["/ubs"]}>
                  <MainLayout titulo="Gestão de Unidades de Saúde">
                    <EmDesenvolvimento
                      titulo="Gestão de UBS"
                      descricao="Módulo de gerenciamento de unidades básicas de saúde em desenvolvimento."
                    />
                  </MainLayout>
                </RoleRoute>
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

          {/* Redirecionamento da raiz para login */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Rota padrão 404 para qualquer caminho não reconhecido */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
