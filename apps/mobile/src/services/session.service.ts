import * as SecureStore from "expo-secure-store";
import type { UsuarioAutenticado } from "@farmaubs/shared";
import { lerSessaoGravada, serializarSessao } from "./session-gravada";
import { lerCatalogoUnidades, type UnidadeResumo } from "./unidade-ativa";

const TOKEN_KEY = "farmaubs_auth_token";
const USER_KEY = "farmaubs_auth_user";
const UNIDADE_KEY = "farmaubs_unidade_ativa";
const CATALOGO_KEY = "farmaubs_unidades_catalogo";
const TOQUE_TRATADO_KEY = "farmaubs_alerta_tratado";
const TTL_PADRAO_MS = 60 * 60 * 1000;

export type SessaoRestaurada = {
  token: string;
  usuario: UsuarioAutenticado;
  expiraEm: string;
};

export type RestauracaoSessao =
  | (SessaoRestaurada & { estado: "pronta" })
  | { estado: "expirada" }
  | { estado: "ausente" };

/**
 * Serviço de armazenamento seguro em Keystore (Android) / Keychain (iOS).
 * A tela não chama o SecureStore direto. ADR-034, NF011.
 */
export const sessionService = {
  async salvarSessao(
    token: string,
    usuario: UsuarioAutenticado,
    expiraEm: string = new Date(Date.now() + TTL_PADRAO_MS).toISOString(),
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
  async restaurarSessao(): Promise<RestauracaoSessao> {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const raw = await SecureStore.getItemAsync(USER_KEY);
    if (!token && !raw) return { estado: "ausente" };
    const lida = lerSessaoGravada(raw, Date.now());
    if (!token || !lida.valida) {
      const expirada = !lida.valida && lida.motivo === "expirada";
      await this.limparSessao();
      return expirada ? { estado: "expirada" } : { estado: "ausente" };
    }
    return { estado: "pronta", token, usuario: lida.usuario, expiraEm: lida.expiraEm };
  },

  /**
   * [AC-MOB-07]: Guarda a nova data devolvida por POST /api/v1/acesso/renovar ou pelo cabeçalho.
   * @param expiraEm - ISO da API.
   * @returns Usuário já gravado, ou null se a sessão local não estiver íntegra.
   */
  async atualizarExpiraEm(expiraEm: string): Promise<UsuarioAutenticado | null> {
    if (Number.isNaN(Date.parse(expiraEm))) return null;
    const raw = await SecureStore.getItemAsync(USER_KEY);
    const lida = lerSessaoGravada(raw, Date.now());
    if (!lida.valida) return null;
    await SecureStore.setItemAsync(USER_KEY, serializarSessao(lida.usuario, expiraEm));
    return lida.usuario;
  },

  /**
   * [AC-MOB-04]: Depois que a API aceita a senha nova, a sessão local deixa de exigir a troca.
   * @returns Usuário atualizado, ou null se a sessão gravada não estiver íntegra.
   */
  async marcarSenhaDefinitiva(): Promise<UsuarioAutenticado | null> {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    const lida = lerSessaoGravada(raw, Date.now());
    if (!lida.valida) return null;
    const usuario = { ...lida.usuario, deveTrocarSenha: false };
    await SecureStore.setItemAsync(USER_KEY, serializarSessao(usuario, lida.expiraEm));
    return usuario;
  },

  async salvarUnidadeAtiva(id: string): Promise<void> {
    await SecureStore.setItemAsync(UNIDADE_KEY, id);
  },

  async obterUnidadeAtiva(): Promise<string | null> {
    return SecureStore.getItemAsync(UNIDADE_KEY);
  },

  async salvarCatalogoUnidades(lista: UnidadeResumo[]): Promise<void> {
    await SecureStore.setItemAsync(CATALOGO_KEY, JSON.stringify(lista));
  },

  async obterCatalogoUnidades(): Promise<UnidadeResumo[]> {
    const raw = await SecureStore.getItemAsync(CATALOGO_KEY);
    try {
      return lerCatalogoUnidades(raw ? JSON.parse(raw) : []);
    } catch {
      return [];
    }
  },

  async toqueJaTratado(chave: string): Promise<boolean> {
    return (await SecureStore.getItemAsync(TOQUE_TRATADO_KEY)) === chave;
  },

  async marcarToqueTratado(chave: string): Promise<void> {
    await SecureStore.setItemAsync(TOQUE_TRATADO_KEY, chave);
  },

  async limparSessao(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    await SecureStore.deleteItemAsync(UNIDADE_KEY);
    await SecureStore.deleteItemAsync(CATALOGO_KEY);
    await SecureStore.deleteItemAsync(TOQUE_TRATADO_KEY);
  },
};
