import { Inject, Injectable } from "@nestjs/common";
import {
  type EditarUsuarioComando,
  type UsuarioAtualizadoResultado,
  TipoOperacaoAuditoria,
} from "@farmaubs/shared";
import {
  REPOSITORIO_USUARIO_PORT,
  type RepositorioUsuarioPort,
} from "../../domain/ports/user.repository.port";
import {
  AUDIT_REPOSITORY_PORT,
  type AuditRepositoryPort,
} from "../../domain/ports/audit.repository.port";
import {
  UsuarioEmailJaExisteException,
  UsuarioNaoEncontradoException,
} from "../../domain/errors/user-management.errors";

@Injectable()
export class EditUserUseCase {
  constructor(
    @Inject(REPOSITORIO_USUARIO_PORT)
    private readonly usuarioRepo: RepositorioUsuarioPort,
    @Inject(AUDIT_REPOSITORY_PORT)
    private readonly auditRepo: AuditRepositoryPort,
  ) {}

  async executar(
    executorId: string,
    alvoId: string,
    comando: EditarUsuarioComando,
  ): Promise<UsuarioAtualizadoResultado> {
    const usuario = await this.usuarioRepo.buscarPorId(alvoId);
    if (!usuario) {
      throw new UsuarioNaoEncontradoException(alvoId);
    }

    const alteracoes: { nomeCompleto?: string; email?: string } = {};

    if (comando.email !== undefined) {
      const emailNormalizado = comando.email.trim().toLowerCase();
      if (emailNormalizado !== usuario.email.toLowerCase()) {
        const usuarioExistente =
          await this.usuarioRepo.buscarPorEmail(emailNormalizado);
        if (usuarioExistente && usuarioExistente.id !== alvoId) {
          throw new UsuarioEmailJaExisteException(emailNormalizado);
        }
        alteracoes.email = emailNormalizado;
      }
    }

    if (comando.nomeCompleto !== undefined) {
      alteracoes.nomeCompleto = comando.nomeCompleto.trim();
    }

    const atualizado = await this.usuarioRepo.atualizarDados(
      alvoId,
      alteracoes,
    );

    await this.auditRepo.registrar({
      usuarioExecutorId: executorId,
      usuarioAlvoId: alvoId,
      tipoOperacao: TipoOperacaoAuditoria.EDICAO_DADOS,
      detalhes: {
        antes: {
          nomeCompleto: usuario.nomeCompleto,
          email: usuario.email,
        },
        depois: {
          nomeCompleto: atualizado.nomeCompleto,
          email: atualizado.email,
        },
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

export type EditarUsuarioUseCase = EditUserUseCase;
