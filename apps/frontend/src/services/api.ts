import type {
  LoginRequest,
  LoginResponse,
  ApiErrorResponse,
} from "../types/auth";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

export type AuthErrorType =
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_LOCKED"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export interface AuthErrorDetails {
  tempoRestanteMinutos?: number;
  tempoRestanteSegundos?: number;
  bloqueadoAte?: string;
}

export class AuthError extends Error {
  type: AuthErrorType;
  details?: AuthErrorDetails;

  constructor(
    message: string,
    type: AuthErrorType,
    details?: AuthErrorDetails,
  ) {
    super(message);
    this.name = "AuthError";
    this.type = type;
    this.details = details;
  }
}

export const authService = {
  async login(dadosLogin: LoginRequest): Promise<LoginResponse> {
    let resposta: Response;
    try {
      resposta = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dadosLogin),
      });
    } catch {
      // Cenário 6 BDD: Falha de conexão exibe erro tratável com nova tentativa
      throw new AuthError(
        "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
        "NETWORK_ERROR",
      );
    }

    if (!resposta.ok) {
      let data: ApiErrorResponse = {};
      try {
        data = await resposta.json();
      } catch {
        // Resposta sem corpo JSON válido
      }

      // Cenário 4 BDD: 401 Credenciais inválidas (anti-enumeração)
      if (resposta.status === 401) {
        throw new AuthError(
          "E-mail ou senha incorretos.",
          "INVALID_CREDENTIALS",
        );
      }

      // Cenário 5 BDD: Conta bloqueada (403, 423 ou 429)
      if (
        resposta.status === 403 ||
        resposta.status === 423 ||
        resposta.status === 429
      ) {
        const minutos =
          data.tempoRestanteMinutos ??
          (data.tempoRestanteSegundos
            ? Math.ceil(data.tempoRestanteSegundos / 60)
            : 15);
        const mensagemBloqueio =
          typeof data.message === "string"
            ? data.message
            : `Conta bloqueada temporariamente. Tente novamente em ${minutos} minuto(s).`;

        throw new AuthError(mensagemBloqueio, "ACCOUNT_LOCKED", {
          tempoRestanteMinutos: minutos,
          tempoRestanteSegundos: data.tempoRestanteSegundos,
          bloqueadoAte: data.bloqueadoAte,
        });
      }

      const mensagemGenerica =
        typeof data.message === "string"
          ? data.message
          : "Falha na autenticação";
      throw new AuthError(mensagemGenerica, "UNKNOWN");
    }

    return (await resposta.json()) as LoginResponse;
  },
};
