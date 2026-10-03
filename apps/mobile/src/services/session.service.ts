import * as SecureStore from "expo-secure-store";
import type { UsuarioAutenticado } from "@farmaubs/shared";

const TOKEN_KEY = "farmaubs_auth_token";
const USER_KEY = "farmaubs_auth_user";

/**
 * Serviço de armazenamento seguro em Keystore (Android) / Keychain (iOS)
 * Conforme ADR-034 e requisitos de segurança NF011/NF018
 */
export const sessionService = {
  async salvarSessao(token: string, usuario: UsuarioAutenticado): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(usuario));
  },

  async obterToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
  },

  async obterUsuario(): Promise<UsuarioAutenticado | null> {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UsuarioAutenticado;
    } catch {
      return null;
    }
  },

  async limparSessao(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  },
};
