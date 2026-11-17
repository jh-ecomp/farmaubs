import type { UsuarioAutenticado } from "@farmaubs/shared";

export const MENSAGEM_SESSAO_EXPIRADA =
  "Sua sessão expirou por segurança. Por favor, entre novamente.";

export type SessaoGravada =
  | { valida: true; usuario: UsuarioAutenticado; expiraEm: string }
  | { valida: false; motivo: "corrompida" | "expirada" | "vazia" };

/**
 * [NF011]: O JSON do SecureStore só restaura a sessão se for um UsuarioAutenticado e a data ainda não passou.
 * @param raw - Conteúdo da chave farmaubs_auth_user, ou null se a chave não existe.
 * @param agoraMs - Relógio do aparelho, em milissegundos.
 * @returns Sessão utilizável, ou o motivo para apagar o armazenamento.
 */
export function lerSessaoGravada(raw: string | null, agoraMs: number): SessaoGravada {
  if (!raw) return { valida: false, motivo: "vazia" };
  let dados: unknown;
  try {
    dados = JSON.parse(raw);
  } catch {
    return { valida: false, motivo: "corrompida" };
  }
  if (!dados || typeof dados !== "object") return { valida: false, motivo: "corrompida" };
  const corpo = dados as UsuarioAutenticado & { expiraEm?: unknown };
  if (!usuarioIntegro(corpo)) return { valida: false, motivo: "corrompida" };
  if (typeof corpo.expiraEm !== "string" || Number.isNaN(Date.parse(corpo.expiraEm))) {
    return { valida: false, motivo: "corrompida" };
  }
  if (Date.parse(corpo.expiraEm) <= agoraMs) return { valida: false, motivo: "expirada" };
  return { valida: true, usuario: corpo, expiraEm: corpo.expiraEm };
}

/**
 * [NF011]: Grava o usuário junto com o instante em que a API disse que a sessão acaba.
 * @param usuario - Perfil devolvido no login.
 * @param expiraEm - ISO 8601 de sessao.expiresAt.
 * @returns JSON da chave farmaubs_auth_user.
 */
export function serializarSessao(usuario: UsuarioAutenticado, expiraEm: string): string {
  return JSON.stringify({ ...usuario, expiraEm });
}

/**
 * [NF011]: 401 só encerra a sessão quando o pedido levou o Bearer. O login sem token continua sendo senha errada.
 * @param status - Status HTTP.
 * @param usouBearer - True se o header Authorization foi enviado.
 * @returns True quando o SecureStore deve ser apagado.
 */
export function sessaoDeveSerApagada(status: number, usouBearer: boolean): boolean {
  return usouBearer && status === 401;
}

/**
 * [NF011]: Monta o header das chamadas autenticadas sem apagar Content-Type.
 * @param token - Valor opaco gravado em farmaubs_auth_token.
 * @param headers - Headers já definidos pelo chamador.
 * @returns Headers com Authorization Bearer.
 */
export function comBearer(token: string, headers?: HeadersInit): Record<string, string> {
  return {
    ...(headers as Record<string, string> | undefined),
    Authorization: `Bearer ${token}`,
  };
}

function usuarioIntegro(valor: unknown): valor is UsuarioAutenticado {
  if (!valor || typeof valor !== "object") return false;
  const usuario = valor as UsuarioAutenticado;
  return (
    typeof usuario.id === "string" &&
    usuario.id.length > 0 &&
    typeof usuario.nomeCompleto === "string" &&
    typeof usuario.email === "string" &&
    typeof usuario.perfilCodigo === "string" &&
    typeof usuario.municipioId === "string" &&
    Array.isArray(usuario.unidadeIds) &&
    typeof usuario.deveTrocarSenha === "boolean"
  );
}
