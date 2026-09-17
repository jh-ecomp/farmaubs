import { Inject, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import {
  type RedefinirSenhaProvisoriaComando,
  TipoOperacaoAuditoria,
} from "@farmaubs/shared";
import {
  REPOSITORIO_USUARIO_PORT,
  type RepositorioUsuarioPort,
} from "../../domain/ports/user.repository.port";
import {
  GERADOR_HASH_SENHA_PORT,
  type GeradorHashSenhaPort,
} from "../../domain/ports/password-hasher.port";
import {
  SESSION_REPOSITORY,
  type ISessionRepository,
} from "../../domain/ports/session.repository.port";
import {
  AUDIT_REPOSITORY_PORT,
  type AuditRepositoryPort,
} from "../../domain/ports/audit.repository.port";
import {
  SenhaInvalidaException,
  UsuarioNaoEncontradoException,
} from "../../domain/errors/user-management.errors";

// Mínimo 8 caracteres, contendo maiúscula, minúscula, número e caractere especial (RF003, NF011)
const SENHA_COMPLEXA_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,}$/;

@Injectable()
export class SetTemporaryPasswordUseCase {
  constructor(
    @Inject(REPOSITORIO_USUARIO_PORT)
    private readonly usuarioRepo: RepositorioUsuarioPort,
    @Inject(GERADOR_HASH_SENHA_PORT)
    private readonly passwordHasher: GeradorHashSenhaPort,
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepo: ISessionRepository,
    @Inject(AUDIT_REPOSITORY_PORT)
    private readonly auditRepo: AuditRepositoryPort,
  ) {}

  async executar(
    executorId: string,
    alvoId: string,
    comando?: RedefinirSenhaProvisoriaComando,
  ): Promise<void> {
    const usuario = await this.usuarioRepo.buscarPorId(alvoId);
    if (!usuario) {
      throw new UsuarioNaoEncontradoException(alvoId);
    }

    const senhaPlana =
      comando?.senhaProvisoria?.trim() || this.gerarSenhaForte();

    if (!SENHA_COMPLEXA_REGEX.test(senhaPlana)) {
      throw new SenhaInvalidaException(
        "A senha fornecida não atende aos requisitos mínimos de complexidade: mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial.",
      );
    }

    // BCrypt custo mínimo 12 (NF011)
    const senhaHash = await this.passwordHasher.gerarHash(senhaPlana);

    // Persiste hash, deve_trocar_senha = true, reseta falhas e bloqueios (RF003)
    await this.usuarioRepo.atualizarSenhaProvisoria(alvoId, senhaHash);

    // Revogação imediata de todas as sessões ativas do usuário alvo (RF004)
    await this.sessionRepo.revogarTodas(alvoId);

    // Trilha de auditoria transacional (RF028, NF018) — nunca grava texto puro ou hash da senha
    await this.auditRepo.registrar({
      usuarioExecutorId: executorId,
      usuarioAlvoId: alvoId,
      tipoOperacao: TipoOperacaoAuditoria.REDEFINICAO_SENHA_PROVISORIA,
      detalhes: {
        deveTrocarSenha: true,
        tentativasResetadas: true,
        sessoesRevogadas: true,
      },
    });
  }

  private gerarSenhaForte(): string {
    const aleatorio = randomBytes(6).toString("hex");
    return `Temp#${aleatorio}A1!`;
  }
}

export type RedefinirSenhaProvisoriaUseCase = SetTemporaryPasswordUseCase;
