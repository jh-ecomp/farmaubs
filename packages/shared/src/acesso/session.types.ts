import type { PerfilCodigo } from "./perfil.types";

export enum SessionStatus {
  ATIVA = "ativa",
  PENDENTE_2FA = "pendente_2fa",
  REVOGADA = "revogada",
}

export interface SessionDto {
  id: string;
  usuarioId: string;
  status: SessionStatus;
  totpVerificadoEm?: Date | string | null;
  ipOrigem?: string | null;
  userAgent?: string | null;
  criadoEm: Date | string;
  ultimaAtividadeEm: Date | string;
  expiraEm: Date | string;
  revogadaEm?: Date | string | null;
}

export interface SessionInfo {
  id: string;
  usuarioId: string;
  municipioId: string;
  status: SessionStatus;
  expiraEm: Date | string;
}

export interface RenovarSessaoResponse {
  expiresAt: string;
  ttlSeconds: number;
  warningSeconds: number;
}

export interface SessaoUsuarioResponse {
  usuarioId: string;
  municipioId: string;
  perfilCodigo: string;
  unidadeIds: string[];
  nomeCompleto: string;
  email: string;
  deveTrocarSenha: boolean;
  expiresAt: string;
}

export interface SessaoUsuarioDto {
  id: string;
  nomeCompleto: string;
  email: string;
  perfilCodigo: PerfilCodigo | string;
  municipioId: string;
  unidadeIds: string[];
  deveTrocarSenha: boolean;
  expiresAt: string;
  usuarioId?: string;
}
