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

export type AuthStatus = "carregando" | "autenticado" | "nao_autenticado";

export interface EscopoAtivo {
  municipioId: string;
  unidadeIds: string[];
  isGlobalAdmin: boolean;
}

export interface SessaoUsuarioDto {
  id: string;
  usuarioId?: string;
  nomeCompleto: string;
  email: string;
  perfilCodigo: string;
  municipioId: string;
  unidadeIds: string[];
  deveTrocarSenha: boolean;
  expiresAt: string;
}

export interface UsuarioPayload {
  id?: string;
  nomeCompleto?: string;
  nome: string;
  email: string;
  perfilCodigo?: string;
  perfil: string[] | string;
  municipioId?: string;
  municipio_id: number | string;
  unidadeIds?: string[];
  unidade_id: number | string;
  deveTrocarSenha?: boolean;
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
