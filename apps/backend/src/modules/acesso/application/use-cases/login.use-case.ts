import * as bcrypt from "bcrypt";
import type { UsuarioAutenticado } from "@farmaubs/shared";
import type { IAcessoRepository } from "../../domain/ports/acesso.repository.port";

export type LoginResult =
  | {
      ok: true;
      token: string;
      usuario: UsuarioAutenticado;
      sessao: { expiresAt: Date; ttlSeconds: number; warningSeconds: number };
      redirectUrl: string;
    }
  | { ok: false; motivo: "CREDENCIAIS_INVALIDAS" }
  | { ok: false; motivo: "CONTA_BLOQUEADA"; minutosRestantes: number };

export interface LoginUseCaseConfig {
  maxTentativas?: number;
  ttlMinutos?: number;
  warningSeconds?: number;
}

export class LoginUseCase {
  private readonly maxTentativas: number;
  private readonly ttlMinutos: number;
  private readonly warningSeconds: number;

  constructor(
    private readonly acessoRepo: IAcessoRepository,
    config?: LoginUseCaseConfig,
  ) {
    this.maxTentativas = config?.maxTentativas ?? 5;
    this.ttlMinutos = config?.ttlMinutos ?? 60;
    this.warningSeconds = config?.warningSeconds ?? 300;
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
      return { ok: false, motivo: "CREDENCIAIS_INVALIDAS" };
    }

    if (usuario.bloqueadoAte && usuario.bloqueadoAte > new Date()) {
      const msRestantes = usuario.bloqueadoAte.getTime() - Date.now();
      const minutosRestantes = Math.ceil(msRestantes / 60_000);
      return { ok: false, motivo: "CONTA_BLOQUEADA", minutosRestantes };
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);

    if (!senhaValida) {
      await this.acessoRepo.registrarFalhaLogin(usuario.id);
      return { ok: false, motivo: "CREDENCIAIS_INVALIDAS" };
    }

    await this.acessoRepo.resetarEstadoLogin(usuario.id);

    const ttlSeconds = this.ttlMinutos * 60;
    const expiraEm = new Date(Date.now() + ttlSeconds * 1000);

    const token = await this.acessoRepo.criarSessao({
      usuarioId: usuario.id,
      expiraEm,
      ipOrigem,
      userAgent,
    });

    const redirectUrl = usuario.deveTrocarSenha
      ? "/trocar-senha"
      : "/dashboard";

    return {
      ok: true,
      token,
      usuario: {
        id: usuario.id,
        nomeCompleto: usuario.nomeCompleto,
        email: usuario.email,
        perfilCodigo: usuario.perfilCodigo,
        municipioId: usuario.municipioId,
        unidadeIds: usuario.unidadeIds,
        deveTrocarSenha: usuario.deveTrocarSenha,
      },
      sessao: {
        expiresAt: expiraEm,
        ttlSeconds,
        warningSeconds: this.warningSeconds,
      },
      redirectUrl,
    };
  }
}
