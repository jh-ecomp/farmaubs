export interface LoginRequest {
  email: string;
  senha: string;
}

export interface LoginResponse {
  usuarioId: string;
  redirectUrl: string;
}

export interface ContaBloqueadaResponse {
  message: string;
  minutosRestantes: number;
}

export interface ErroCredenciaisResponse {
  message: string;
}
