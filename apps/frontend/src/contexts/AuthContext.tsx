import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AuthStatus, EscopoAtivo, UsuarioPayload } from "../types/auth";
import { authService, onSessionExpiresUpdate } from "../services/api";

export interface AuthState {
  token: string | null;
  expiresAt: string | null;
  ttlSeconds: number | null;
  warningSeconds: number | null;
  usuario: UsuarioPayload | null;
  isAuthenticated: boolean;
  status: AuthStatus;
}

export interface AuthContextType extends AuthState {
  login: (dadosAuth: Omit<AuthState, "isAuthenticated" | "status">) => void;
  logout: (motivo?: string) => void;
  extendSession: () => Promise<void>;
  updateExpiresAt?: (expiresAt: string) => void;
  logoutReason: string | null;
  clearLogoutReason: () => void;
  atualizarDeveTrocarSenha: (deveTrocar: boolean) => void;
  hasRole: (roles: string | string[]) => boolean;
  isAdmin: boolean;
  escopoAtivo: EscopoAtivo;
}

// 2. Criando o Contexto
export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

interface AuthProviderProps {
  children: ReactNode;
  initialStatus?: AuthStatus;
}

// 3. Provider que vai envelopar a aplicação
export function AuthProvider({ children, initialStatus }: AuthProviderProps) {
  let queryClient: ReturnType<typeof useQueryClient> | null = null;
  try {
    queryClient = useQueryClient();
  } catch {
    // Caso não esteja encapsulado por QueryClientProvider (ex.: em testes isolados)
  }

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

    if (initialStatus) {
      let usuario: UsuarioPayload | null = null;
      try {
        if (savedUser) usuario = JSON.parse(savedUser);
      } catch {}
      return {
        token: savedToken,
        expiresAt: savedExpiresAt,
        ttlSeconds: savedTtlSeconds ? parseInt(savedTtlSeconds, 10) : 3600,
        warningSeconds: savedWarningSeconds
          ? parseInt(savedWarningSeconds, 10)
          : 300,
        usuario,
        isAuthenticated: initialStatus === "autenticado",
        status: initialStatus,
      };
    }

    if (!savedToken) {
      return {
        token: null,
        expiresAt: null,
        ttlSeconds: null,
        warningSeconds: null,
        usuario: null,
        isAuthenticated: false,
        status: "nao_autenticado",
      };
    }

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
        status: "nao_autenticado",
      };
    }

    let usuario: UsuarioPayload | null = null;
    try {
      if (savedUser) {
        usuario = JSON.parse(savedUser);
      }
    } catch {
      // Usuário inválido no storage permanece null
    }

    // Se temos token mas não temos usuário em cache, inicia em carregando
    const statusCalculado: AuthStatus = usuario ? "autenticado" : "carregando";

    return {
      token: savedToken,
      expiresAt: savedExpiresAt,
      ttlSeconds: savedTtlSeconds ? parseInt(savedTtlSeconds, 10) : 3600,
      warningSeconds: savedWarningSeconds
        ? parseInt(savedWarningSeconds, 10)
        : 300,
      usuario,
      isAuthenticated: Boolean(usuario),
      status: statusCalculado,
    };
  });

  // Revalidação inicial via GET /api/v1/acesso/me quando montado
  useEffect(() => {
    let isMounted = true;

    const validarSessao = async () => {
      const token = localStorage.getItem("@FarmaUBS:token");
      if (!token) {
        if (isMounted) {
          setAuthState((prev) => ({
            ...prev,
            status: "nao_autenticado",
            isAuthenticated: false,
          }));
        }
        return;
      }

      const expiresAt = localStorage.getItem("@FarmaUBS:expiresAt");
      if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
        localStorage.removeItem("@FarmaUBS:token");
        localStorage.removeItem("@FarmaUBS:usuario");
        localStorage.removeItem("@FarmaUBS:expiresAt");
        localStorage.removeItem("@FarmaUBS:ttlSeconds");
        localStorage.removeItem("@FarmaUBS:warningSeconds");
        sessionStorage.setItem(
          "@FarmaUBS:logoutReason",
          "Sua sessão expirou por inatividade. Faça login novamente para continuar.",
        );
        setLogoutReason(
          "Sua sessão expirou por inatividade. Faça login novamente para continuar.",
        );
        if (isMounted) {
          setAuthState({
            token: null,
            expiresAt: null,
            ttlSeconds: null,
            warningSeconds: null,
            usuario: null,
            isAuthenticated: false,
            status: "nao_autenticado",
          });
        }
        return;
      }

      try {
        const sessao = await authService.obterSessaoAtual(token);
        if (isMounted) {
          setAuthState((prev) => {
            const usuarioBase: UsuarioPayload = prev.usuario || {
              id: sessao.id,
              nomeCompleto: sessao.nomeCompleto,
              nome: sessao.nomeCompleto,
              email: sessao.email,
              perfilCodigo: sessao.perfilCodigo,
              perfil: [sessao.perfilCodigo],
              municipioId: sessao.municipioId,
              municipio_id: sessao.municipioId,
              unidadeIds: sessao.unidadeIds,
              unidade_id: sessao.unidadeIds[0] || "",
              deveTrocarSenha: sessao.deveTrocarSenha,
            };

            const usuarioAtualizado: UsuarioPayload = {
              id: sessao.id || usuarioBase.id,
              nomeCompleto:
                sessao.nomeCompleto ||
                usuarioBase.nomeCompleto ||
                usuarioBase.nome ||
                "",
              nome: sessao.nomeCompleto || usuarioBase.nome,
              email: sessao.email || usuarioBase.email,
              perfilCodigo: sessao.perfilCodigo || usuarioBase.perfilCodigo,
              perfil: sessao.perfilCodigo
                ? [sessao.perfilCodigo]
                : usuarioBase.perfil,
              municipioId: sessao.municipioId || usuarioBase.municipioId,
              municipio_id: sessao.municipioId || usuarioBase.municipio_id,
              unidadeIds: sessao.unidadeIds.length
                ? sessao.unidadeIds
                : usuarioBase.unidadeIds || [],
              unidade_id: sessao.unidadeIds[0] || usuarioBase.unidade_id,
              deveTrocarSenha: Boolean(
                sessao.deveTrocarSenha ?? usuarioBase.deveTrocarSenha,
              ),
            };

            localStorage.setItem(
              "@FarmaUBS:usuario",
              JSON.stringify(usuarioAtualizado),
            );
            if (sessao.expiresAt) {
              localStorage.setItem("@FarmaUBS:expiresAt", sessao.expiresAt);
            }

            return {
              ...prev,
              usuario: usuarioAtualizado,
              expiresAt: sessao.expiresAt || prev.expiresAt,
              isAuthenticated: true,
              status: "autenticado",
            };
          });
        }
      } catch (err: any) {
        // Se a sessão expirou no servidor (401), limpa credenciais locais
        if (
          err?.type === "SESSION_EXPIRED" ||
          err?.message?.includes("expirou")
        ) {
          localStorage.removeItem("@FarmaUBS:token");
          localStorage.removeItem("@FarmaUBS:usuario");
          localStorage.removeItem("@FarmaUBS:expiresAt");
          localStorage.removeItem("@FarmaUBS:ttlSeconds");
          localStorage.removeItem("@FarmaUBS:warningSeconds");
          sessionStorage.setItem(
            "@FarmaUBS:logoutReason",
            "Sua sessão expirou no servidor. Faça login novamente para continuar.",
          );
          setLogoutReason(
            "Sua sessão expirou no servidor. Faça login novamente para continuar.",
          );
          if (isMounted) {
            setAuthState({
              token: null,
              expiresAt: null,
              ttlSeconds: null,
              warningSeconds: null,
              usuario: null,
              isAuthenticated: false,
              status: "nao_autenticado",
            });
          }
        }
      }
    };

    if (authState.token) {
      validarSessao();
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // NF012 / AC-20: Sincronização reativa via cabeçalho X-Session-Expires-At (sem polling)
  useEffect(() => {
    if (typeof onSessionExpiresUpdate !== "function") return;
    const unsubscribe = onSessionExpiresUpdate((novoExpiresAt) => {
      setAuthState((prev) => {
        if (!prev.isAuthenticated) return prev;
        return {
          ...prev,
          expiresAt: novoExpiresAt,
        };
      });
    });
    return unsubscribe;
  }, []);

  const updateExpiresAt = (novoExpiresAt: string) => {
    localStorage.setItem("@FarmaUBS:expiresAt", novoExpiresAt);
    setAuthState((prev) => ({
      ...prev,
      expiresAt: novoExpiresAt,
    }));
  };

  const login = (dadosAuth: Omit<AuthState, "isAuthenticated" | "status">) => {
    setAuthState({
      ...dadosAuth,
      isAuthenticated: true,
      status: "autenticado",
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
    // NF012 / AC-06: Expurgo imediato e obrigatório do cache de memória RAM
    if (queryClient) {
      queryClient.clear();
    }

    localStorage.removeItem("@FarmaUBS:token");
    localStorage.removeItem("@FarmaUBS:usuario");
    localStorage.removeItem("@FarmaUBS:expiresAt");
    localStorage.removeItem("@FarmaUBS:ttlSeconds");
    localStorage.removeItem("@FarmaUBS:warningSeconds");

    setAuthState({
      token: null,
      expiresAt: null,
      ttlSeconds: null,
      warningSeconds: null,
      usuario: null,
      isAuthenticated: false,
      status: "nao_autenticado",
    });

    if (typeof motivo === "string" && motivo.trim().length > 0) {
      sessionStorage.setItem("@FarmaUBS:logoutReason", motivo);
      setLogoutReason(motivo);
    } else {
      sessionStorage.removeItem("@FarmaUBS:logoutReason");
      setLogoutReason(null);
    }

    // Revoga a sessão no backend em segundo plano (resiliente a falhas de rede)
    authService.logout().catch(() => {
      // Falha de rede não impede o logout local
    });
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

  const atualizarDeveTrocarSenha = (deveTrocar: boolean) => {
    setAuthState((prev) => {
      if (!prev.usuario) return prev;
      const usuarioAtualizado = {
        ...prev.usuario,
        deveTrocarSenha: deveTrocar,
      };
      localStorage.setItem(
        "@FarmaUBS:usuario",
        JSON.stringify(usuarioAtualizado),
      );
      return {
        ...prev,
        usuario: usuarioAtualizado,
      };
    });
  };

  const hasRole = (roles: string | string[]): boolean => {
    if (!authState.usuario) return false;
    const rolesArray = Array.isArray(roles) ? roles : [roles];
    const rolesNormalized = rolesArray.map((r) =>
      String(r).trim().toUpperCase(),
    );

    const userRoles: string[] = [];
    if (authState.usuario.perfilCodigo) {
      userRoles.push(
        String(authState.usuario.perfilCodigo).trim().toUpperCase(),
      );
    }
    const rawPerfil = authState.usuario.perfil as unknown;
    if (Array.isArray(rawPerfil)) {
      userRoles.push(...rawPerfil.map((p) => String(p).trim().toUpperCase()));
    } else if (typeof rawPerfil === "string" && rawPerfil.trim()) {
      userRoles.push(rawPerfil.trim().toUpperCase());
    }

    return rolesNormalized.some((r) => userRoles.includes(r));
  };

  const isAdmin = hasRole("ADMINISTRADOR");

  const escopoAtivo: EscopoAtivo = {
    municipioId: authState.usuario?.municipioId
      ? String(authState.usuario.municipioId)
      : authState.usuario?.municipio_id
        ? String(authState.usuario.municipio_id)
        : "",
    unidadeIds: authState.usuario?.unidadeIds
      ? authState.usuario.unidadeIds.map(String)
      : authState.usuario?.unidade_id
        ? [String(authState.usuario.unidade_id)]
        : [],
    isGlobalAdmin: isAdmin,
  };

  if (authState.status === "carregando") {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8fafc",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            border: "4px solid #e2e8f0",
            borderTop: "4px solid #001c6d",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            marginBottom: "16px",
          }}
        />
        <span
          style={{
            fontSize: "14px",
            fontWeight: 500,
            color: "#334155",
          }}
        >
          Carregando informações da sessão...
        </span>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        logout,
        extendSession,
        updateExpiresAt,
        logoutReason,
        clearLogoutReason,
        atualizarDeveTrocarSenha,
        hasRole,
        isAdmin,
        escopoAtivo,
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
