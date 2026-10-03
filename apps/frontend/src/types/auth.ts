import type {
  LoginRequest,
  LoginResponse as BackendLoginResponse,
  ContaBloqueadaResponse,
  ErroCredenciaisResponse,
  SessaoUsuarioDto,
  LoginResponseDto,
  ApiErrorResponse,
  UsuarioAutenticado,
} from "@farmaubs/shared";

// Re-exporta os contratos oficiais compartilhados de @farmaubs/shared (ADR-022)
export type {
  LoginRequest,
  BackendLoginResponse,
  ContaBloqueadaResponse,
  ErroCredenciaisResponse,
  SessaoUsuarioDto,
  LoginResponseDto,
  ApiErrorResponse,
  UsuarioAutenticado,
};

export type AuthStatus = "carregando" | "autenticado" | "nao_autenticado";

export interface EscopoAtivo {
  municipioId: string;
  unidadeIds: string[];
  isGlobalAdmin: boolean;
}

export type UsuarioPayload = Omit<UsuarioAutenticado, "perfilCodigo"> & {
  perfilCodigo: string;
  nome?: string;
  perfil?: string[] | string;
  municipio_id?: number | string;
  unidade_id?: number | string;
};

export type LoginResponse = Omit<LoginResponseDto, "usuario"> & {
  usuario: UsuarioPayload;
};
