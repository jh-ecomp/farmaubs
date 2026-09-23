import type { PerfilCodigo } from "./perfil.types";

export interface LoginRequest {
  email: string;
  senha: string;
}

export interface UsuarioAutenticado {
  id: string;
  nomeCompleto: string;
  email: string;
  perfilCodigo: PerfilCodigo;
  municipioId: string;
  unidadeIds: string[];
  deveTrocarSenha: boolean;
}

export interface SessaoLoginInfo {
  expiresAt: string; // ISO 8601
  ttlSeconds: number;
  warningSeconds: number;
}

export interface LoginResponse {
  usuario: UsuarioAutenticado;
  sessao: SessaoLoginInfo;
  redirectUrl: string;
}

export interface ContaBloqueadaResponse {
  message: string;
  minutosRestantes: number;
}

export interface ErroCredenciaisResponse {
  message: string;
}
