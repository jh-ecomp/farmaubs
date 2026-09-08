export interface CadastrarUsuarioResultado {
  id: string;
  municipioId: string;
  nomeCompleto: string;
  email: string;
  perfilId: string;
  ativo: boolean;
  deveTrocarSenha: boolean;
  ubsIds: string[];
  criadoEm: Date;
  // Compatibilidade
  createdAt?: Date;
}

export type RegisterUserResult = CadastrarUsuarioResultado;
export type ResultadoCadastroUsuario = CadastrarUsuarioResultado;
