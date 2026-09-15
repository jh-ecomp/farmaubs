import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { RenovarSessaoResponse } from "@farmaubs/shared";
import {
  SESSION_REPOSITORY,
  type ISessionRepository,
} from "../../domain/ports/session.repository.port";

@Injectable()
export class RenewSessionUseCase {
  private readonly ttlMinutos: number;
  private readonly warningMinutos: number;

  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepo: ISessionRepository,
    private readonly config: ConfigService,
  ) {
    this.ttlMinutos = parseInt(
      this.config.get<string>("SESSION_TTL_MINUTES", "60"),
      10,
    );
    this.warningMinutos = parseInt(
      this.config.get<string>("SESSION_WARNING_MINUTES", "5"),
      10,
    );
  }

  async executar(sessionId: string): Promise<RenovarSessaoResponse> {
    const novaExpiraEm = new Date(Date.now() + this.ttlMinutos * 60_000);

    await this.sessionRepo.renovarAtividade({
      sessionId,
      expiraEm: novaExpiraEm,
    });

    return {
      expiresAt: novaExpiraEm.toISOString(),
      ttlSeconds: this.ttlMinutos * 60,
      warningSeconds: this.warningMinutos * 60,
    };
  }
}
