export const SERVICO_EMAIL_PORT = Symbol('SERVICO_EMAIL_PORT');
export const EMAIL_SERVICE_PORT = SERVICO_EMAIL_PORT;

export interface ServicoEmailPort {
  enviarConfirmacaoCadastro(email: string, nomeCompleto: string): Promise<void>;
}

export type EmailServicePort = ServicoEmailPort;
