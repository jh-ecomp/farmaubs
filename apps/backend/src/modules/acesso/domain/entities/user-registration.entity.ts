export interface UsuarioModeloDominio {
  id: string;
  municipioId: string;
  nomeCompleto: string;
  email: string;
  perfilId: string;
  ativo: boolean;
  deveTrocarSenha: boolean;
  tentativasLoginFalhas: number;
  bloqueadoAte: Date | null;
  senhaAtualizadaEm: Date | null;
  ultimoLoginEm: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
  // Compatibilidade
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PerfilModeloDominio {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
}

export interface UnidadeSaudeModeloDominio {
  id: string;
  municipioId: string;
  nome: string;
  endereco?: string | null;
}

export interface DadosCriacaoUsuario {
  id?: string;
  municipioId: string;
  nomeCompleto: string;
  email: string;
  senhaHash: string;
  perfilId: string;
  ativo: boolean;
  deveTrocarSenha: boolean;
  tentativasLoginFalhas: number;
  bloqueadoAte?: Date | null;
  senhaAtualizadaEm?: Date | null;
}

// Aliases para compatibilidade
export type UserDomainModel = UsuarioModeloDominio;
export type ProfileDomainModel = PerfilModeloDominio;
export type HealthUnitDomainModel = UnidadeSaudeModeloDominio;
export type CreateUserData = DadosCriacaoUsuario;
