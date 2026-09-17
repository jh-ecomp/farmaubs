import { Inject, Injectable } from "@nestjs/common";
import {
  type AtualizarAssociacoesUsuarioComando,
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
  REPOSITORIO_UNIDADE_SAUDE_PORT,
  type RepositorioUnidadeSaudePort,
} from "../../domain/ports/health-unit.repository.port";
import {
  AUDIT_REPOSITORY_PORT,
  type AuditRepositoryPort,
} from "../../domain/ports/audit.repository.port";
import {
  IntegridadeTerritorialException,
  PerfilNaoEncontradoException,
  UltimoAdministradorException,
  UnidadeSaudeInvalidaException,
  UsuarioNaoEncontradoException,
} from "../../domain/errors/user-management.errors";

@Injectable()
export class UpdateAssociationsUseCase {
  constructor(
    @Inject(REPOSITORIO_USUARIO_PORT)
    private readonly usuarioRepo: RepositorioUsuarioPort,
    @Inject(REPOSITORIO_PERFIL_PORT)
    private readonly profileRepo: RepositorioPerfilPort,
    @Inject(REPOSITORIO_UNIDADE_SAUDE_PORT)
    private readonly healthUnitRepo: RepositorioUnidadeSaudePort,
    @Inject(AUDIT_REPOSITORY_PORT)
    private readonly auditRepo: AuditRepositoryPort,
  ) {}

  async executar(
    executorId: string,
    alvoId: string,
    comando: AtualizarAssociacoesUsuarioComando,
  ): Promise<UsuarioAtualizadoResultado> {
    const usuario = await this.usuarioRepo.buscarPorId(alvoId);
    if (!usuario) {
      throw new UsuarioNaoEncontradoException(alvoId);
    }

    if (!comando.ubsIds || comando.ubsIds.length === 0) {
      throw new UnidadeSaudeInvalidaException(
        "O usuário deve estar vinculado a pelo menos uma UBS.",
      );
    }

    // Valida perfil no catálogo (por ID ou código)
    let novoPerfil = await this.profileRepo.buscarPorId(comando.perfilId);
    if (!novoPerfil) {
      novoPerfil = await this.profileRepo.buscarPorCodigoOuNome(
        comando.perfilId,
      );
    }
    if (!novoPerfil || !novoPerfil.ativo) {
      throw new PerfilNaoEncontradoException(comando.perfilId);
    }

    // Trava de último administrador (ADR-006, RF025, NF009)
    const perfilAtual = await this.profileRepo.buscarPorId(usuario.perfilId);
    const eraAdmin = perfilAtual?.codigo?.toUpperCase() === "ADMINISTRADOR";
    const seraAdmin = novoPerfil.codigo?.toUpperCase() === "ADMINISTRADOR";

    if (eraAdmin && !seraAdmin && usuario.ativo) {
      const adminsAtivos = await this.usuarioRepo.contarAdministradoresAtivos();
      if (adminsAtivos <= 1) {
        throw new UltimoAdministradorException(
          "Não é permitido alterar o perfil do único administrador ativo do sistema.",
        );
      }
    }

    // Integridade territorial: todas as UBSs devem pertencer ao município do usuário
    const ubsIdsDeduplicados = Array.from(new Set(comando.ubsIds));
    const ubsValidas = await this.healthUnitRepo.buscarIdsExistentes(
      ubsIdsDeduplicados,
      usuario.municipioId,
    );

    if (ubsValidas.length !== ubsIdsDeduplicados.length) {
      throw new IntegridadeTerritorialException(
        "Todas as UBSs associadas devem pertencer ao município do usuário.",
      );
    }

    const ubsAntigas = await this.usuarioRepo.buscarUbsIds(alvoId);

    // Sincronização atômica
    await this.usuarioRepo.atualizarPerfilEUbs(
      alvoId,
      novoPerfil.id,
      ubsIdsDeduplicados,
    );

    await this.auditRepo.registrar({
      usuarioExecutorId: executorId,
      usuarioAlvoId: alvoId,
      tipoOperacao: TipoOperacaoAuditoria.MUDANCA_PERFIL_UBSS,
      detalhes: {
        antes: {
          perfilId: usuario.perfilId,
          ubsIds: ubsAntigas,
        },
        depois: {
          perfilId: novoPerfil.id,
          ubsIds: ubsIdsDeduplicados,
        },
      },
    });

    const atualizado = await this.usuarioRepo.buscarPorId(alvoId);

    return {
      id: atualizado!.id,
      municipioId: atualizado!.municipioId,
      nomeCompleto: atualizado!.nomeCompleto,
      email: atualizado!.email,
      perfilId: atualizado!.perfilId,
      ativo: atualizado!.ativo,
      deveTrocarSenha: atualizado!.deveTrocarSenha,
      ubsIds: ubsIdsDeduplicados,
      atualizadoEm: atualizado!.atualizadoEm,
    };
  }
}

export type AtualizarAssociacoesUseCase = UpdateAssociationsUseCase;
