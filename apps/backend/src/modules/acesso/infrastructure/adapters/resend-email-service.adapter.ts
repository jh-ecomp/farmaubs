import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ServicoEmailPort } from "../../domain/ports/email-service.port";

const DEFAULT_TIMEOUT_MS = 8_000;
const RESEND_API_URL = "https://api.resend.com/emails";

/**
 * [RF001 / RF022 / ADR-003 / ADR-027 / RL-03]: Adaptador real de e-mail transacional via API HTTPS do Resend.
 * Usa fetch nativo do Node com AbortSignal.timeout(8000) e nunca expõe chaves de API em logs.
 */
@Injectable()
export class ResendEmailServiceAdapter implements ServicoEmailPort {
  private readonly logger = new Logger(ResendEmailServiceAdapter.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * [RF001]: Envia confirmação de cadastro ao usuário recém-criado com timeout estrito de 8s.
   * @param email - Endereço de destino do usuário.
   * @param nomeCompleto - Nome civil para saudação institucional.
   */
  async enviarConfirmacaoCadastro(
    email: string,
    nomeCompleto: string,
  ): Promise<void> {
    const apiKey = this.config.get<string>("RESEND_API_KEY", "").trim();
    const from = this.config
      .get<string>("SMTP_FROM", "no-reply@farmaubs.com.br")
      .trim();
    const timeoutMs = parseInt(
      this.config.get<string>("EMAIL_TIMEOUT_MS", String(DEFAULT_TIMEOUT_MS)),
      10,
    );

    const destinatario = email.trim().toLowerCase();
    const nome = nomeCompleto.trim();

    try {
      const response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [destinatario],
          subject: "Bem-vindo(a) ao FarmaUBS — Acesso Criado",
          text: `Olá, ${nome}.\n\nSeu cadastro no sistema FarmaUBS foi realizado pelo administrador da unidade.\nNo primeiro acesso, utilize a senha provisória informada pela gestão e realize a troca obrigatória.\n\nEquipe FarmaUBS`,
        }),
        signal: AbortSignal.timeout(
          Number.isFinite(timeoutMs) && timeoutMs > 0
            ? timeoutMs
            : DEFAULT_TIMEOUT_MS,
        ),
      });

      if (!response.ok) {
        this.logger.error(
          `Falha HTTP ${response.status} ao enviar e-mail transacional para ${destinatario}`,
        );
        throw new Error(`Provedor de e-mail retornou HTTP ${response.status}`);
      }

      this.logger.log(
        `E-mail de confirmação enviado com sucesso para ${destinatario}`,
      );
    } catch (error) {
      const motivo =
        error instanceof Error ? error.message : "erro desconhecido";
      this.logger.error(
        `Não foi possível enviar e-mail transacional para ${destinatario}: ${motivo}`,
      );
      throw error;
    }
  }
}
