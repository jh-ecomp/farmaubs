import { Injectable, Logger } from '@nestjs/common';
import { ServicoEmailPort } from '../../domain/ports/email-service.port';

@Injectable()
export class ConsoleEmailServiceAdapter implements ServicoEmailPort {
  private readonly logger = new Logger(ConsoleEmailServiceAdapter.name);

  enviarConfirmacaoCadastro(
    email: string,
    nomeCompleto: string,
  ): Promise<void> {
    const nomeLimpo = nomeCompleto?.trim() ?? '';
    const emailLimpo = email?.trim().toLowerCase() ?? '';

    const mensagem = `[EMAIL SERVICE] Notificação de cadastro enviada com sucesso para: ${nomeLimpo} <${emailLimpo}>`;

    console.log(mensagem);
    this.logger.log(mensagem);

    return Promise.resolve();
  }
}

export type ConsoleServicoEmailAdapter = ConsoleEmailServiceAdapter;
