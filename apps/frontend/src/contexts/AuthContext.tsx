import { createContext, useContext, useState, type ReactNode } from "react";
import type { UsuarioPayload } from "../types/auth";
import { authService } from "../services/api";

export interface AuthState {
  token: string | null;
  expiresAt: string | null;
  ttlSeconds: number | null;
  warningSeconds: number | null;
  usuario: UsuarioPayload | null;
  isAuthenticated: boolean;
}

export interface AuthContextType extends AuthState {
  login: (dadosAuth: Omit<AuthState, "isAuthenticated">) => void;
  logout: (motivo?: string) => void;
  extendSession: () => Promise<void>;
  logoutReason: string | null;
  clearLogoutReason: () => void;
}

// 2. Criando o Contexto
export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

// 3. Provider que vai envelopar a aplicação
export function AuthProvider({ children }: { children: ReactNode }) {
  const [logoutReason, setLogoutReason] = useState<string | null>(() => {
    return sessionStorage.getItem("@FarmaUBS:logoutReason");
  });

  const [authState, setAuthState] = useState<AuthState>(() => {
    const savedToken = localStorage.getItem("@FarmaUBS:token");
    const savedUser = localStorage.getItem("@FarmaUBS:usuario");
    const savedExpiresAt = localStorage.getItem("@FarmaUBS:expiresAt");
    const savedTtlSeconds = localStorage.getItem("@FarmaUBS:ttlSeconds");
    const savedWarningSeconds = localStorage.getItem(
      "@FarmaUBS:warningSeconds",
    );

    let usuario: UsuarioPayload | null = null;
    if (savedToken) {
      // NF012: Se a data de expiração salva já tiver passado, a sessão é inválida
      if (savedExpiresAt && new Date(savedExpiresAt).getTime() <= Date.now()) {
        localStorage.removeItem("@FarmaUBS:token");
        localStorage.removeItem("@FarmaUBS:usuario");
        localStorage.removeItem("@FarmaUBS:expiresAt");
        localStorage.removeItem("@FarmaUBS:ttlSeconds");
        localStorage.removeItem("@FarmaUBS:warningSeconds");
        sessionStorage.setItem(
          "@FarmaUBS:logoutReason",
          "Sua sessão expirou por inatividade. Faça login novamente para continuar.",
        );
        return {
          token: null,
          expiresAt: null,
          ttlSeconds: null,
          warningSeconds: null,
          usuario: null,
          isAuthenticated: false,
        };
      }

      try {
        if (savedUser) {
          usuario = JSON.parse(savedUser);
        }
      } catch {
        // Usuário inválido no storage permanece null
      }

      return {
        token: savedToken,
        expiresAt: savedExpiresAt,
        ttlSeconds: savedTtlSeconds ? parseInt(savedTtlSeconds, 10) : 3600,
        warningSeconds: savedWarningSeconds
          ? parseInt(savedWarningSeconds, 10)
          : 300,
        usuario,
        isAuthenticated: true,
      };
    }

    return {
      token: null,
      expiresAt: null,
      ttlSeconds: null,
      warningSeconds: null,
      usuario: null,
      isAuthenticated: false,
    };
  });

  const login = (dadosAuth: Omit<AuthState, "isAuthenticated">) => {
    setAuthState({
      ...dadosAuth,
      isAuthenticated: true,
    });

    if (dadosAuth.token) {
      localStorage.setItem("@FarmaUBS:token", dadosAuth.token);
    }
    if (dadosAuth.usuario) {
      localStorage.setItem(
        "@FarmaUBS:usuario",
        JSON.stringify(dadosAuth.usuario),
      );
    }
    if (dadosAuth.expiresAt) {
      localStorage.setItem("@FarmaUBS:expiresAt", dadosAuth.expiresAt);
    }
    if (dadosAuth.ttlSeconds) {
      localStorage.setItem(
        "@FarmaUBS:ttlSeconds",
        String(dadosAuth.ttlSeconds),
      );
    }
    if (dadosAuth.warningSeconds) {
      localStorage.setItem(
        "@FarmaUBS:warningSeconds",
        String(dadosAuth.warningSeconds),
      );
    }
  };

  const logout = (motivo?: string) => {
    setAuthState({
      token: null,
      expiresAt: null,
      ttlSeconds: null,
      warningSeconds: null,
      usuario: null,
      isAuthenticated: false,
    });
    localStorage.removeItem("@FarmaUBS:token");
    localStorage.removeItem("@FarmaUBS:usuario");
    localStorage.removeItem("@FarmaUBS:expiresAt");
    localStorage.removeItem("@FarmaUBS:ttlSeconds");
    localStorage.removeItem("@FarmaUBS:warningSeconds");

    if (typeof motivo === "string" && motivo.trim().length > 0) {
      sessionStorage.setItem("@FarmaUBS:logoutReason", motivo);
      setLogoutReason(motivo);
    }
  };

  const extendSession = async () => {
    try {
      const dados = await authService.renovarSessao();
      setAuthState((prev) => ({
        ...prev,
        expiresAt: dados.expiresAt,
        ttlSeconds: dados.ttlSeconds,
        warningSeconds: dados.warningSeconds,
      }));
      localStorage.setItem("@FarmaUBS:expiresAt", dados.expiresAt);
      localStorage.setItem("@FarmaUBS:ttlSeconds", String(dados.ttlSeconds));
      localStorage.setItem(
        "@FarmaUBS:warningSeconds",
        String(dados.warningSeconds),
      );
    } catch {
      logout(
        "Sua sessão expirou no servidor. Faça login novamente para continuar.",
      );
    }
  };

  const clearLogoutReason = () => {
    sessionStorage.removeItem("@FarmaUBS:logoutReason");
    setLogoutReason(null);
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        logout,
        extendSession,
        logoutReason,
        clearLogoutReason,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// 4. Hook customizado para facilitar o uso nos componentes
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}
