import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rota da tela de Login */}
        <Route path="/login" element={<Login />} />

        {/* Rota do Dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Qualquer endereço desconhecido joga o usuário de volta pro Login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
