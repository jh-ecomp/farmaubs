import { Inject, Injectable } from "@nestjs/common";
import {
  type AlterarStatusUsuarioComando,
  type UsuarioAtualizadoResultado,
  TipoOperacaoAuditoria,
} from "@farmaubs/shared";
import {
  REPOSITORIO_USUARIO_PORT,
  type RepositorioUsuarioPort,
} from "../../domain/ports/user.repository.port";
import {
  REPOSITORIO_PERFIL_PORT,
  type RepositorioPerfilPort,
} from "../../domain/ports/profile.repository.port";
import {
  SESSION_REPOSITORY,
  type ISessionRepository,
} from "../../domain/ports/session.repository.port";
import {
  AUDIT_REPOSITORY_PORT,
  type AuditRepositoryPort,
} from "../../domain/ports/audit.repository.port";
import {
  AutoInativacaoBloqueadaException,
  UltimoAdministradorException,
  UsuarioNaoEncontradoException,
} from "../../domain/errors/user-management.errors";

@Injectable()
export class ToggleUserStatusUseCase {
  constructor(
    @Inject(REPOSITORIO_USUARIO_PORT)
    private readonly usuarioRepo: RepositorioUsuarioPort,
    @Inject(REPOSITORIO_PERFIL_PORT)
    private readonly profileRepo: RepositorioPerfilPort,
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepo: ISessionRepository,
    @Inject(AUDIT_REPOSITORY_PORT)
    private readonly auditRepo: AuditRepositoryPort,
  ) {}

  async executar(
    executorId: string,
    alvoId: string,
    comando: AlterarStatusUsuarioComando,
  ): Promise<UsuarioAtualizadoResultado> {
    const usuario = await this.usuarioRepo.buscarPorId(alvoId);
    if (!usuario) {
      throw new UsuarioNaoEncontradoException(alvoId);
    }

    // Regras exclusivas para inativação
    if (comando.ativo === false) {
      if (executorId === alvoId) {
        throw new AutoInativacaoBloqueadaException();
      }

      const perfil = await this.profileRepo.buscarPorId(usuario.perfilId);
      if (perfil?.codigo?.toUpperCase() === "ADMINISTRADOR") {
        const adminsAtivos =
          await this.usuarioRepo.contarAdministradoresAtivos();
        if (adminsAtivos <= 1) {
          throw new UltimoAdministradorException(
            "Não é permitido inativar o único administrador ativo do sistema.",
          );
        }
      }

      // Revogação imediata de todas as sessões ativas (RF004)
      await this.sessionRepo.revogarTodas(alvoId);
    }

    const atualizado = await this.usuarioRepo.atualizarStatus(
      alvoId,
      comando.ativo,
    );

    const tipoOperacao = comando.ativo
      ? TipoOperacaoAuditoria.REATIVACAO
      : TipoOperacaoAuditoria.INATIVACAO;

    await this.auditRepo.registrar({
      usuarioExecutorId: executorId,
      usuarioAlvoId: alvoId,
      tipoOperacao,
      detalhes: {
        statusAnterior: usuario.ativo,
        statusNovo: comando.ativo,
      },
    });

    const ubsIds = await this.usuarioRepo.buscarUbsIds(alvoId);

    return {
      id: atualizado.id,
      municipioId: atualizado.municipioId,
      nomeCompleto: atualizado.nomeCompleto,
      email: atualizado.email,
      perfilId: atualizado.perfilId,
      ativo: atualizado.ativo,
      deveTrocarSenha: atualizado.deveTrocarSenha,
      ubsIds,
      atualizadoEm: atualizado.atualizadoEm,
    };
  }
}

export type AlterarStatusUsuarioUseCase = ToggleUserStatusUseCase;
