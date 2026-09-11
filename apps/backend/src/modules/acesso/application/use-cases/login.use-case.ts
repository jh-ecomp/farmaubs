import * as bcrypt from 'bcrypt';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IAcessoRepository } from '../../domain/ports/acesso.repository.port';
import { ACESSO_REPOSITORY } from '../../domain/ports/acesso.repository.port';

export type LoginResult =
  | { ok: true; token: string; usuarioId: string; municipioId: string }
  | { ok: false; motivo: 'CREDENCIAIS_INVALIDAS' }
  | { ok: false; motivo: 'CONTA_BLOQUEADA'; minutosRestantes: number };

@Injectable()
export class LoginUseCase {
  private readonly maxTentativas: number;
  private readonly ttlMinutos: number;

  constructor(
    @Inject(ACESSO_REPOSITORY)
    private readonly acessoRepo: IAcessoRepository,
    private readonly config: ConfigService,
  ) {
    this.maxTentativas = parseInt(
      this.config.get<string>('LOGIN_MAX_ATTEMPTS', '5'),
      10,
    );
    this.ttlMinutos = parseInt(
      this.config.get<string>('SESSION_TTL_MINUTES', '60'),
      10,
    );
  }

  async executar(
    email: string,
    senha: string,
    ipOrigem?: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    const normalizado = email.trim().toLowerCase();

    const usuario = await this.acessoRepo.buscarUsuarioPorEmail(normalizado);

    if (!usuario || !usuario.ativo) {
      return { ok: false, motivo: 'CREDENCIAIS_INVALIDAS' };
    }

    if (usuario.bloqueadoAte && usuario.bloqueadoAte > new Date()) {
      const msRestantes = usuario.bloqueadoAte.getTime() - Date.now();
      const minutosRestantes = Math.ceil(msRestantes / 60_000);
      return { ok: false, motivo: 'CONTA_BLOQUEADA', minutosRestantes };
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);

    if (!senhaValida) {
      await this.acessoRepo.registrarFalhaLogin(usuario.id);
      return { ok: false, motivo: 'CREDENCIAIS_INVALIDAS' };
    }

    await this.acessoRepo.resetarEstadoLogin(usuario.id);

    const expiraEm = new Date(Date.now() + this.ttlMinutos * 60_000);

    const token = await this.acessoRepo.criarSessao({
      usuarioId: usuario.id,
      expiraEm,
      ipOrigem,
      userAgent,
    });

    return {
      ok: true,
      token,
      usuarioId: usuario.id,
      municipioId: usuario.municipioId,
    };
  }
}
