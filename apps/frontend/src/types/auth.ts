import type {
  LoginRequest,
  LoginResponse as BackendLoginResponse,
  ContaBloqueadaResponse,
  ErroCredenciaisResponse,
  SessaoUsuarioDto,
} from "@farmaubs/shared";

// Re-exporta os contratos oficiais compartilhados de @farmaubs/shared (ADR-022)
export type {
  LoginRequest,
  BackendLoginResponse,
  ContaBloqueadaResponse,
  ErroCredenciaisResponse,
  SessaoUsuarioDto,
};

export type AuthStatus = "carregando" | "autenticado" | "nao_autenticado";

export interface EscopoAtivo {
  municipioId: string;
  unidadeIds: string[];
  isGlobalAdmin: boolean;
}

export interface UsuarioPayload {
  id: string;
  nomeCompleto: string;
  email: string;
  perfilCodigo: string;
  municipioId: string;
  unidadeIds: string[];
  deveTrocarSenha: boolean;
  // Campos auxiliares opcionais para compatibilidade retroativa
  nome?: string;
  perfil?: string[] | string;
  municipio_id?: number | string;
  unidade_id?: number | string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  ttlSeconds: number;
  warningSeconds: number;
  usuario: UsuarioPayload;
  redirectUrl: string;
}

export interface ApiErrorResponse {
  message?: string | string[];
  error?: string;
  statusCode?: number;
  minutosRestantes?: number;
}
