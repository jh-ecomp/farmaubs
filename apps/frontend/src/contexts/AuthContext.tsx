import { createContext, useContext, useState, type ReactNode } from "react";
import type { UsuarioPayload } from "../types/auth";

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
  logout: () => void;
}

// 2. Criando o Contexto
export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

// 3. Provider que vai envelopar a aplicação
export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(() => {
    const savedToken = localStorage.getItem("@FarmaUBS:token");
    const savedUser = localStorage.getItem("@FarmaUBS:usuario");
    const savedExpiresAt = localStorage.getItem("@FarmaUBS:expiresAt");

    let usuario: UsuarioPayload | null = null;
    if (savedToken) {
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
        ttlSeconds: null,
        warningSeconds: null,
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
  };

  const logout = () => {
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
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, logout }}>
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
