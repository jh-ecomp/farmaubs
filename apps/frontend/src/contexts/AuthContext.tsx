import { createContext, useContext, useState, ReactNode } from "react";

// 1. Tipando o Payload que o back-end devolve (conforme AC-10)
interface UsuarioPayload {
  nome: string;
  email: string;
  perfil: string[];
  municipio_id: number;
  unidade_id: number;
}

interface AuthState {
  token: string | null;
  expiresAt: string | null;
  ttlSeconds: number | null;
  warningSeconds: number | null;
  usuario: UsuarioPayload | null;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (dadosAuth: Omit<AuthState, "isAuthenticated">) => void;
  logout: () => void;
}

// 2. Criando o Contexto
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 3. Provider que vai envelopar a aplicação
export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    token: null,
    expiresAt: null,
    ttlSeconds: null,
    warningSeconds: null,
    usuario: null,
    isAuthenticated: false,
  });

  const login = (dadosAuth: Omit<AuthState, "isAuthenticated">) => {
    // Salvando no state do React
    setAuthState({
      ...dadosAuth,
      isAuthenticated: true,
    });

    // (Opcional, mas recomendado) Persistir no localStorage ou Cookie seguro
    // dependendo da implementação exata do seu time de back-end.
    if (dadosAuth.token) {
      localStorage.setItem("@FarmaUBS:token", dadosAuth.token);
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
