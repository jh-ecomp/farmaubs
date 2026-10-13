import type { PerfilCodigo } from "./perfil.types";

export interface TenantScopeContext {
  municipioId: string;
  unidadeIds: string[];
  isGlobalAdmin: boolean;
}

export interface AuthenticatedUserPayload {
  id: string;
  email: string;
  nomeCompleto: string;
  perfilCodigo: PerfilCodigo;
  municipioId: string;
  unidadeIds: string[];
  deveTrocarSenha: boolean;
}

// Snapshot consolidado retornado pelo repositório de sessões em busca única (NF010, ADR-006)
export interface SessionRecord {
  id: string;
  usuarioId: string;
  email: string;
  nomeCompleto: string;
  municipioId: string;
  perfilCodigo: PerfilCodigo;
  deveTrocarSenha: boolean;
  unidadeIds: string[];
  status: string;
  expiraEm: Date;
  criadoEm: Date;
}
