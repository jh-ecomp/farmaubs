import * as crypto from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  SESSION_REPOSITORY,
  type ISessionRepository,
} from "../../domain/ports/session.repository.port";

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY)
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
