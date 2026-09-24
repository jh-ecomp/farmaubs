import { Inject, Injectable } from "@nestjs/common";
import {
  REPOSITORIO_USUARIO_PORT,
  type RepositorioUsuarioPort,
} from "../../domain/ports/user.repository.port";
import {
  GERADOR_HASH_SENHA_PORT,
  type GeradorHashSenhaPort,
} from "../../domain/ports/password-hasher.port";
import {
  AUDIT_REPOSITORY_PORT,
  type AuditRepositoryPort,
} from "../../domain/ports/audit.repository.port";
import {
  type TrocarSenhaResultado,
  TipoOperacaoAuditoria,
} from "@farmaubs/shared";
import {
  ConfirmacaoSenhaDivergenteException,
  NovaSenhaNaoPodeSerIgualProvisoriaException,
  SenhaFracaException,
} from "../../domain/errors/password.errors";
import { UsuarioNaoEncontradoException } from "../../domain/errors/user-management.errors";

const SENHA_COMPLEXA_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,}$/;

export interface ExecutarTrocaSenhaComando {
  usuarioId: string;
  novaSenha: string;
  confirmacaoSenha: string;
}

export type TrocarSenhaComando = ExecutarTrocaSenhaComando;

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(REPOSITORIO_USUARIO_PORT)
    private readonly usuarioRepo: RepositorioUsuarioPort,

    @Inject(GERADOR_HASH_SENHA_PORT)
    private readonly passwordHasher: GeradorHashSenhaPort,

    @Inject(AUDIT_REPOSITORY_PORT)
    private readonly auditRepo: AuditRepositoryPort,
  ) {}

  async executar(comando: ExecutarTrocaSenhaComando): Promise<TrocarSenhaResultado> {
    // 1. Confirmação deve bater
    if (comando.novaSenha !== comando.confirmacaoSenha) {
      throw new ConfirmacaoSenhaDivergenteException();
    }

    // 2. Complexidade mínima (NF011)
    if (!SENHA_COMPLEXA_REGEX.test(comando.novaSenha)) {
      throw new SenhaFracaException();
    }

    // 3. Verifica existência do usuário
    const usuario = await this.usuarioRepo.buscarPorId(comando.usuarioId);
    if (!usuario) {
      throw new UsuarioNaoEncontradoException(comando.usuarioId);
    }

    // 4. Nova senha não pode ser igual à provisória atual (anti-repetição)
    const senhaAtualHash = await this.usuarioRepo.buscarSenhaHashPorId(
      comando.usuarioId,
    );
    if (senhaAtualHash) {
      const igualProvisoria = await this.passwordHasher.comparar(
        comando.novaSenha,
        senhaAtualHash,
      );
      if (igualProvisoria) {
        throw new NovaSenhaNaoPodeSerIgualProvisoriaException();
      }
    }

    // 5. Persiste novo hash e desativa a flag deve_trocar_senha
    const novoHash = await this.passwordHasher.gerarHash(comando.novaSenha);
    await this.usuarioRepo.concluirTrocaDeSenha(
      comando.usuarioId,
      novoHash,
      new Date(),
    );

    // 6. Auditoria (RF028, NF018)
    await this.auditRepo.registrar({
      usuarioExecutorId: comando.usuarioId,
      usuarioAlvoId: comando.usuarioId,
      tipoOperacao: TipoOperacaoAuditoria.REDEFINICAO_SENHA_PROVISORIA,
      detalhes: {
        deveTrocarSenha: false,
        trocaRealizadaPeloProprioUsuario: true,
      },
    });

    return {
      sucesso: true,
      mensagem: "Senha alterada com sucesso.",
    };
  }
}
