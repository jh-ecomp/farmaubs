export interface CadastrarUsuarioComando {
  municipioId: string;
  nomeCompleto: string;
  email: string;
  senha: string;
  perfil: string;
  ubsIds: string[];
}

export type RegisterUserCommand = CadastrarUsuarioComando;
