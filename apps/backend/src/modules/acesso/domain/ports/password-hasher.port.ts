export const GERADOR_HASH_SENHA_PORT = Symbol('GERADOR_HASH_SENHA_PORT');
export const PASSWORD_HASHER_PORT = GERADOR_HASH_SENHA_PORT;

export interface GeradorHashSenhaPort {
  gerarHash(textoPlano: string): Promise<string>;
  comparar(textoPlano: string, hash: string): Promise<boolean>;
}

export type PasswordHasherPort = GeradorHashSenhaPort;
