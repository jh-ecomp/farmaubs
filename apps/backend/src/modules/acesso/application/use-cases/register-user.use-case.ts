import {
  DadosUsuarioInvalidosException,
  UnidadeSaudeInvalidaException,
  PerfilNaoEncontradoException,
  UsuarioEmailJaExisteException,
} from '../../domain/errors/user-registration.errors';
import { RepositorioUsuarioPort } from '../../domain/ports/user.repository.port';
import { RepositorioPerfilPort } from '../../domain/ports/profile.repository.port';
import { RepositorioUnidadeSaudePort } from '../../domain/ports/health-unit.repository.port';
import { GeradorHashSenhaPort } from '../../domain/ports/password-hasher.port';
import { ServicoEmailPort } from '../../domain/ports/email-service.port';
import { CadastrarUsuarioComando } from '../dto/register-user.command';
import { CadastrarUsuarioResultado } from '../dto/register-user.result';

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class CadastrarUsuarioUseCase {
  constructor(
    private readonly repositorioUsuario: RepositorioUsuarioPort,
    private readonly repositorioPerfil: RepositorioPerfilPort,
    private readonly geradorHashSenha: GeradorHashSenhaPort,
    private readonly repositorioUnidadeSaude?: RepositorioUnidadeSaudePort,
    private readonly servicoEmail?: ServicoEmailPort,
  ) {}

  async executar(
    comando: CadastrarUsuarioComando,
  ): Promise<CadastrarUsuarioResultado> {
    this.validarComando(comando);

    const emailNormalizado = comando.email.trim().toLowerCase();

    // 1. Unicidade de e-mail com normalização de caixa (AC-03, RF001)
    const emailExiste =
      await this.repositorioUsuario.existePorEmail(emailNormalizado);
    if (emailExiste) {
      throw new UsuarioEmailJaExisteException(emailNormalizado);
    }

    // 2. Validação do perfil no catálogo (ADR-006)
    let perfil = await this.repositorioPerfil.buscarPorCodigoOuNome(
      comando.perfil,
    );

    if (!perfil) {
      perfil = await this.repositorioPerfil.buscarPorId(comando.perfil);
    }

    if (!perfil || !perfil.ativo) {
      throw new PerfilNaoEncontradoException(comando.perfil);
    }

    // 3. Validação das unidades de saúde (UBSs)
    const unidadesIdsUnicas = Array.from(new Set(comando.ubsIds));
    if (this.repositorioUnidadeSaude) {
      const unidadesExistentes =
        await this.repositorioUnidadeSaude.buscarIdsExistentes(
          unidadesIdsUnicas,
          comando.municipioId,
        );
      if (unidadesExistentes.length !== unidadesIdsUnicas.length) {
        throw new UnidadeSaudeInvalidaException(
          'Uma ou mais Unidades Básicas de Saúde (UBSs) informadas não foram encontradas no município.',
        );
      }
    }

    // 4. Hash bcrypt da senha (NF011) — texto puro nunca é persistido nem logado
    const senhaHash = await this.geradorHashSenha.gerarHash(comando.senha);

    // 5. Persistência do usuário e das associações user_units
    const usuarioCriado = await this.repositorioUsuario.salvar(
      {
        municipioId: comando.municipioId,
        nomeCompleto: comando.nomeCompleto.trim(),
        email: emailNormalizado,
        senhaHash,
        perfilId: perfil.id,
        ativo: true,
        deveTrocarSenha: true,
        tentativasLoginFalhas: 0,
        bloqueadoAte: null,
        senhaAtualizadaEm: null,
      },
      unidadesIdsUnicas,
    );

    // 6. E-mail de confirmação transacional (RF001)
    if (this.servicoEmail) {
      await this.servicoEmail
        .enviarConfirmacaoCadastro(
          usuarioCriado.email,
          usuarioCriado.nomeCompleto,
        )
        .catch(() => {
          // Falha no envio de e-mail não deve abortar o cadastro com sucesso
        });
    }

    // 7. Retorno seguro sem expor senha ou hash
    const dataCriacao =
      usuarioCriado.criadoEm ?? usuarioCriado.createdAt ?? new Date();

    return {
      id: usuarioCriado.id,
      municipioId: usuarioCriado.municipioId,
      nomeCompleto: usuarioCriado.nomeCompleto,
      email: usuarioCriado.email,
      perfilId: usuarioCriado.perfilId,
      ativo: usuarioCriado.ativo,
      deveTrocarSenha: usuarioCriado.deveTrocarSenha,
      ubsIds: unidadesIdsUnicas,
      criadoEm: dataCriacao,
      createdAt: dataCriacao,
    };
  }

  // Método de compatibilidade
  execute(
    comando: CadastrarUsuarioComando,
  ): Promise<CadastrarUsuarioResultado> {
    return this.executar(comando);
  }

  private validarComando(comando: CadastrarUsuarioComando): void {
    if (!comando) {
      throw new DadosUsuarioInvalidosException(
        'Os dados do usuário são obrigatórios.',
      );
    }

    if (!comando.nomeCompleto || comando.nomeCompleto.trim().length === 0) {
      throw new DadosUsuarioInvalidosException(
        'O nome completo é obrigatório e não pode ser vazio.',
      );
    }

    if (!comando.email || comando.email.trim().length === 0) {
      throw new DadosUsuarioInvalidosException('O e-mail é obrigatório.');
    }

    if (!REGEX_EMAIL.test(comando.email.trim())) {
      throw new DadosUsuarioInvalidosException(
        'O e-mail informado possui formato inválido.',
      );
    }

    if (!comando.senha || comando.senha.trim().length === 0) {
      throw new DadosUsuarioInvalidosException('A senha é obrigatória.');
    }

    if (comando.senha.length < 8) {
      throw new DadosUsuarioInvalidosException(
        'A senha deve conter no mínimo 8 caracteres.',
      );
    }

    if (!comando.perfil || comando.perfil.trim().length === 0) {
      throw new DadosUsuarioInvalidosException(
        'O perfil de acesso é obrigatório.',
      );
    }

    if (
      !comando.ubsIds ||
      !Array.isArray(comando.ubsIds) ||
      comando.ubsIds.length === 0
    ) {
      throw new DadosUsuarioInvalidosException(
        'Pelo menos uma UBS deve ser vinculada ao usuário.',
      );
    }

    if (!comando.municipioId || comando.municipioId.trim().length === 0) {
      throw new DadosUsuarioInvalidosException('O município é obrigatório.');
    }
  }
}

// Alias para compatibilidade
export { CadastrarUsuarioUseCase as RegisterUserUseCase };
