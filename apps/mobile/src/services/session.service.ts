import * as SecureStore from "expo-secure-store";
import type { UsuarioAutenticado } from "@farmaubs/shared";
import { lerSessaoGravada, serializarSessao } from "./session-gravada";

const TOKEN_KEY = "farmaubs_auth_token";
const USER_KEY = "farmaubs_auth_user";

export type SessaoRestaurada = {
  token: string;
  usuario: UsuarioAutenticado;
};

/**
 * Serviço de armazenamento seguro em Keystore (Android) / Keychain (iOS).
 * A tela não chama o SecureStore direto. ADR-034, NF011.
 */
export const sessionService = {
  async salvarSessao(
    token: string,
    usuario: UsuarioAutenticado,
    expiraEm: string,
  ): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(USER_KEY, serializarSessao(usuario, expiraEm));
  },

  async obterToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
  },

  async obterUsuario(): Promise<UsuarioAutenticado | null> {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    const lida = lerSessaoGravada(raw, Date.now());
    if (!lida.valida) {
      if (lida.motivo !== "vazia") await this.limparSessao();
      return null;
    }
    return lida.usuario;
  },

  /**
   * [NF012]: Na abertura do app, devolve a sessão só se o JSON estiver íntegro e a data não tiver passado.
   * @returns Token e usuário, ou null depois de apagar dados inválidos ou vencidos.
   */
  async restaurarSessao(): Promise<SessaoRestaurada | null> {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const raw = await SecureStore.getItemAsync(USER_KEY);
    if (!token && !raw) return null;
    const lida = lerSessaoGravada(raw, Date.now());
    if (!token || !lida.valida) {
      await this.limparSessao();
      return null;
    }
    return { token, usuario: lida.usuario };
  },

  async limparSessao(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  },
};
