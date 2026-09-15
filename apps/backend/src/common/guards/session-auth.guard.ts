import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import * as crypto from "node:crypto";
import type { Request } from "express";
import { SKIP_AUTH_KEY } from "./skip-auth.decorator";
import {
  SESSION_REPOSITORY,
  type ISessionRepository,
  type SessionRecord,
} from "../../modules/acesso/domain/ports/session.repository.port";

@Injectable()
export class SessionAuthGuard implements CanActivate {
  private readonly ttlMinutos: number;
  private readonly throttleSegundos: number;

  constructor(
    private readonly reflector: Reflector,
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepo: ISessionRepository,
    private readonly config: ConfigService,
  ) {
    this.ttlMinutos = parseInt(
      this.config.get<string>("SESSION_TTL_MINUTES", "60"),
      10,
    );
    this.throttleSegundos = parseInt(
      this.config.get<string>("SESSION_THROTTLE_SECONDS", "30"),
      10,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(SKIP_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    if (context.getType() !== "http") {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers["authorization"];

    if (!authHeader || typeof authHeader !== "string") {
      throw new UnauthorizedException(
        "Token de autenticação ausente ou inválido",
      );
    }

    if (!authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException(
        "Token de autenticação ausente ou inválido",
      );
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      throw new UnauthorizedException(
        "Token de autenticação ausente ou inválido",
      );
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const sessao = await this.sessionRepo.buscarPorTokenHash(tokenHash);

    if (!sessao) {
      throw new UnauthorizedException("Sessão inválida ou expirada");
    }

    if (sessao.status !== "ativa") {
      throw new UnauthorizedException("Sessão revogada ou inativa");
    }

    const now = Date.now();
    if (new Date(sessao.expiraEm).getTime() <= now) {
      throw new UnauthorizedException("Sessão expirada");
    }

    const diffMs = now - new Date(sessao.ultimaAtividadeEm).getTime();
    const novoExpiraEm = new Date(now + this.ttlMinutos * 60_000);

    if (diffMs >= this.throttleSegundos * 1000) {
      await this.sessionRepo.renovarAtividade({
        sessionId: sessao.id,
        expiraEm: novoExpiraEm,
      });
      sessao.expiraEm = novoExpiraEm;
      sessao.ultimaAtividadeEm = new Date(now);
    }

    // Propaga contexto da sessão no request para interceptors e controllers
    (req as any).session = sessao;
    (req as any).sessao = sessao;
    (req as any).user = sessao;

    return true;
  }
}
