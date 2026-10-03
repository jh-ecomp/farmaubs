import type { RenovarSessaoResponse } from "@farmaubs/shared";
import {
  type ISessionRepository,
} from "../../domain/ports/session.repository.port";

export interface RenewSessionUseCaseConfig {
  ttlMinutos?: number;
  warningMinutos?: number;
}

export class RenewSessionUseCase {
  private readonly ttlMinutos: number;
  private readonly warningMinutos: number;

  constructor(
    private readonly sessionRepo: ISessionRepository,
    config?: RenewSessionUseCaseConfig,
  ) {
    this.ttlMinutos = config?.ttlMinutos ?? 60;
    this.warningMinutos = config?.warningMinutos ?? 5;
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
