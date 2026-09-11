import type {
  LoginRequest,
  LoginResponse as BackendLoginResponse,
  ContaBloqueadaResponse,
  ErroCredenciaisResponse,
} from "@farmaubs/shared";

// Re-exporta os contratos oficiais compartilhados de @farmaubs/shared (ADR-022)
export type {
  LoginRequest,
  BackendLoginResponse,
  ContaBloqueadaResponse,
  ErroCredenciaisResponse,
};

export interface UsuarioPayload {
  nome: string;
  email: string;
  perfil: string[];
  municipio_id: number;
  unidade_id: number;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  ttlSeconds: number;
  warningSeconds: number;
  usuario: UsuarioPayload;
  usuarioId?: string;
  redirectUrl?: string;
}

export interface ApiErrorResponse {
  message?: string | string[];
  error?: string;
  statusCode?: number;
  minutosRestantes?: number;
}
