import * as crypto from "node:crypto";
import {
  type ISessionRepository,
} from "../../domain/ports/session.repository.port";

export class LogoutUseCase {
  constructor(
    private readonly sessionRepo: ISessionRepository,
  ) {}

  /**
   * [RF004 / Logout]: Revoga a sessão ativa do usuário no PostgreSQL a partir do token informado.
   * Operação idempotente: caso a sessão não exista ou já esteja inativa/expirada, conclui com sucesso.
   * @param token - Token de autenticação em texto puro recebido no cabeçalho Authorization.
   * @returns Conclui com sucesso sem valor de retorno (void).
   */
  async executar(token: string): Promise<void> {
    if (!token?.trim()) {
      return;
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token.trim())
      .digest("hex");

    const sessao = await this.sessionRepo.buscarPorTokenHash(tokenHash);

    if (sessao && sessao.status === "ativa") {
      await this.sessionRepo.revogar(sessao.id);
    }
  }
}
