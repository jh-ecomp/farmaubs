import type { UsuarioAutenticado } from "@farmaubs/shared";

const EMAIL_FORMATO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MENSAGEM_CAMPOS_VAZIOS = "Informe o e-mail e a senha de acesso.";
export const MENSAGEM_EMAIL_INVALIDO = "Informe um e-mail institucional válido.";
export const MENSAGEM_CREDENCIAIS = "E-mail ou senha incorretos.";
export const MENSAGEM_REDE =
  "Falha de conexão com o servidor da UBS. Verifique sua rede e tente novamente.";

export type LoginSucesso = {
  token: string;
  usuario: UsuarioAutenticado;
};

export type FalhaLogin =
  | { tipo: "bloqueio"; mensagem: string; minutos: number }
  | { tipo: "credenciais"; mensagem: string }
  | { tipo: "rede"; mensagem: string };

/**
 * [RF002]: Bloqueia o POST enquanto e-mail ou senha faltam, ou o e-mail não tem formato válido.
 * @param email - Texto do campo de e-mail institucional.
 * @param senha - Texto do campo de senha.
 * @returns Mensagem em pt-BR, ou null quando o payload pode ser enviado.
 */
export function validarCamposLogin(email: string, senha: string): string | null {
  if (!email.trim() || !senha) return MENSAGEM_CAMPOS_VAZIOS;
  if (!EMAIL_FORMATO.test(email.trim().toLowerCase())) return MENSAGEM_EMAIL_INVALIDO;
  return null;
}

/**
 * [RF002]: A API atual responde 429 com minutosRestantes. A história cita 423. Os dois entram aqui.
 * @param status - Status HTTP da resposta de login.
 * @param minutosRestantes - Campo do corpo, quando a API o envia.
 * @returns Falha de bloqueio, credencial ou rede, com o texto da tela.
 */
export function classificarErroLogin(status: number, minutosRestantes: unknown): FalhaLogin {
  if ((status === 429 || status === 423) && typeof minutosRestantes === "number") {
    return {
      tipo: "bloqueio",
      minutos: minutosRestantes,
      mensagem: `Conta temporariamente bloqueada. Tente novamente em ${minutosRestantes} minutos.`,
    };
  }
  if (status === 401) return { tipo: "credenciais", mensagem: MENSAGEM_CREDENCIAIS };
  return { tipo: "rede", mensagem: MENSAGEM_REDE };
}

/**
 * [RF002]: Aceita o corpo real (token + usuario). Sem token não há o que gravar no SecureStore.
 * @param data - JSON parseado do POST /api/v1/acesso/login.
 * @returns Sessão mínima para o sessionService, ou null se o corpo não trouxer token e usuário.
 */
export function lerLoginSucesso(data: unknown): LoginSucesso | null {
  if (!data || typeof data !== "object") return null;
  const corpo = data as { token?: unknown; usuario?: UsuarioAutenticado };
  if (typeof corpo.token !== "string" || !corpo.token || !corpo.usuario) return null;
  return { token: corpo.token, usuario: corpo.usuario };
}
