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
