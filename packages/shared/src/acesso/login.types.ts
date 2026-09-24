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

// Comando do Administrador para emitir senha provisória (AC-23)
export interface DefinirSenhaProvisoriaComando {
  senhaProvisoria?: string;
}

export interface DefinirSenhaProvisoriaResultado {
  mensagem: string;
  usuarioId: string;
  deveTrocarSenha?: boolean;
  senhaProvisoria?: string;
}

// Comando do Usuário para cadastrar sua nova senha definitiva (AC-23)
export interface TrocarSenhaComando {
  novaSenha: string;
  confirmacaoSenha: string;
}

export interface TrocarSenhaResultado {
  sucesso: boolean;
  mensagem: string;
}

export type RedefinirSenhaProvisoriaComando = DefinirSenhaProvisoriaComando;
export type RedefinirSenhaProvisoriaResultado = DefinirSenhaProvisoriaResultado;
