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
}

export interface LoginRequest {
  email: string;
  senha: string;
}

export interface ApiErrorResponse {
  message?: string | string[];
  error?: string;
  statusCode?: number;
  tempoRestanteMinutos?: number;
  tempoRestanteSegundos?: number;
  bloqueadoAte?: string;
}
