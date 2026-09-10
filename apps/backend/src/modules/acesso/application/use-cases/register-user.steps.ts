import { defineFeature, loadFeature } from 'jest-cucumber';
import * as path from 'path';
import { CadastrarUsuarioUseCase } from './register-user.use-case';
import { RepositorioUsuarioPort } from '../../domain/ports/user.repository.port';
import { RepositorioPerfilPort } from '../../domain/ports/profile.repository.port';
import { RepositorioUnidadeSaudePort } from '../../domain/ports/health-unit.repository.port';
import { GeradorHashSenhaPort } from '../../domain/ports/password-hasher.port';
import { ServicoEmailPort } from '../../domain/ports/email-service.port';
import {
  UsuarioEmailJaExisteException,
  PerfilNaoEncontradoException,
  UnidadeSaudeInvalidaException,
  DadosUsuarioInvalidosException,
} from '../../domain/errors/user-registration.errors';
import {
  CadastrarUsuarioComando,
  ResultadoCadastroUsuario,
} from '@farmaubs/shared';
import { DadosCriacaoUsuario } from '../../domain/models/user-registration.model';

const feature = loadFeature(path.resolve(__dirname, 'register-user.feature'));

defineFeature(feature, (test) => {
  let casoDeUso: CadastrarUsuarioUseCase;
  let repositorioUsuarioMock: jest.Mocked<RepositorioUsuarioPort>;
  let repositorioPerfilMock: jest.Mocked<RepositorioPerfilPort>;
  let geradorHashSenhaMock: jest.Mocked<GeradorHashSenhaPort>;
  let repositorioUnidadeSaudeMock: jest.Mocked<RepositorioUnidadeSaudePort>;
  let servicoEmailMock: jest.Mocked<ServicoEmailPort>;

  let resultado: ResultadoCadastroUsuario | null = null;
  let erroCapturado: Error | null = null;

  const perfilPadrao = {
    id: '33333333-3333-3333-3333-333333333333',
    codigo: 'FARMACEUTICO_RESPONSAVEL',
    nome: 'Farmacêutico Responsável',
    descricao: 'Responsável técnico',
    ativo: true,
  };

  const comandoBase: CadastrarUsuarioComando = {
    municipioId: '11111111-1111-1111-1111-111111111111',
    nomeCompleto: 'Ana Souza',
    email: 'ana.souza@farmaubs.local',
    senha: 'SenhaForte@2026',
    perfil: 'Farmacêutico Responsável',
    ubsIds: ['22222222-2222-2222-2222-222222222222'],
  };

  const configurarAmbiente = () => {
    resultado = null;
    erroCapturado = null;

    repositorioUsuarioMock = {
      buscarPorEmail: jest.fn().mockResolvedValue(null),
      existePorEmail: jest.fn().mockResolvedValue(false),
      salvar: jest
        .fn()
        .mockImplementation((dadosUsuario: DadosCriacaoUsuario) =>
          Promise.resolve({
            id: 'user-generated-uuid',
            municipioId: dadosUsuario.municipioId,
            nomeCompleto: dadosUsuario.nomeCompleto,
            email: dadosUsuario.email,
            perfilId: dadosUsuario.perfilId,
            ativo: dadosUsuario.ativo,
            deveTrocarSenha: dadosUsuario.deveTrocarSenha,
            tentativasLoginFalhas: dadosUsuario.tentativasLoginFalhas,
            bloqueadoAte: dadosUsuario.bloqueadoAte ?? null,
            senhaAtualizadaEm: dadosUsuario.senhaAtualizadaEm ?? null,
            ultimoLoginEm: null,
            criadoEm: new Date(),
            atualizadoEm: new Date(),
          }),
        ),
    };

    repositorioPerfilMock = {
      buscarPorId: jest.fn().mockResolvedValue(null),
      buscarPorCodigoOuNome: jest.fn().mockResolvedValue(perfilPadrao),
    };

    geradorHashSenhaMock = {
      gerarHash: jest
        .fn()
        .mockResolvedValue('$2b$12$mockedBcryptHashedPasswordResult'),
      comparar: jest.fn().mockResolvedValue(true),
    };

    repositorioUnidadeSaudeMock = {
      buscarIdsExistentes: jest
        .fn()
        .mockImplementation((ids: string[]) => Promise.resolve([...ids])),
    };

    servicoEmailMock = {
      enviarConfirmacaoCadastro: jest.fn().mockResolvedValue(undefined),
    };

    casoDeUso = new CadastrarUsuarioUseCase(
      repositorioUsuarioMock,
      repositorioPerfilMock,
      geradorHashSenhaMock,
      repositorioUnidadeSaudeMock,
      servicoEmailMock,
    );
  };

  const executarComando = async (cmd: CadastrarUsuarioComando | null) => {
    try {
      resultado = await casoDeUso.executar(
        cmd as unknown as CadastrarUsuarioComando,
      );
    } catch (error) {
      erroCapturado = error as Error;
    }
  };

  test('Cadastro de usuário com sucesso com hash bcrypt custo 12 e envio de e-mail', ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      'que os repositórios e serviços de apoio estão operacionais',
      configurarAmbiente,
    );

    given(/^que o repositório de usuários não possui o e-mail "(.*)"$/, () => {
      repositorioUsuarioMock.existePorEmail.mockResolvedValue(false);
    });

    and(/^que o perfil "(.*)" existe e está ativo no catálogo$/, () => {
      repositorioPerfilMock.buscarPorCodigoOuNome.mockResolvedValue(
        perfilPadrao,
      );
    });

    and('que as UBSs informadas existem no sistema', () => {
      repositorioUnidadeSaudeMock.buscarIdsExistentes.mockImplementation(
        (ids: string[]) => Promise.resolve([...ids]),
      );
    });

    when(
      'eu submeto o comando de cadastro com os seguintes dados:',
      async (tabela: Array<{ campo: string; valor: string }>) => {
        const dados: Record<string, string> = {};
        for (const linha of tabela) {
          dados[linha.campo] = linha.valor;
        }

        const comando: CadastrarUsuarioComando = {
          municipioId: dados.municipioId,
          nomeCompleto: dados.nomeCompleto,
          email: dados.email,
          senha: dados.senha,
          perfil: dados.perfil,
          ubsIds: dados.ubsIds ? [dados.ubsIds] : [],
        };

        await executarComando(comando);
      },
    );

    then(
      'o usuário deve ser salvo com status ativo e troca de senha obrigatória',
      () => {
        expect(erroCapturado).toBeNull();
        expect(resultado).toBeDefined();
        expect(resultado?.ativo).toBe(true);
        expect(resultado?.deveTrocarSenha).toBe(true);
        expect(repositorioUsuarioMock.salvar).toHaveBeenCalledWith(
          expect.objectContaining({
            nomeCompleto: 'Ana Souza',
            email: 'ana.souza@farmaubs.local',
            perfilId: perfilPadrao.id,
            ativo: true,
            deveTrocarSenha: true,
            tentativasLoginFalhas: 0,
          }),
          ['22222222-2222-2222-2222-222222222222'],
        );
      },
    );

    and(
      'a senha deve ser transformada em hash bcrypt com custo mínimo 12',
      () => {
        expect(geradorHashSenhaMock.gerarHash).toHaveBeenCalledWith(
          'SenhaForte@2026',
        );
        expect(repositorioUsuarioMock.salvar).toHaveBeenCalledWith(
          expect.objectContaining({
            senhaHash: '$2b$12$mockedBcryptHashedPasswordResult',
          }),
          expect.any(Array),
        );
      },
    );

    and('a senha em texto puro não deve ser retornada nem persistida', () => {
      expect(
        (resultado as unknown as Record<string, unknown>).senha,
      ).toBeUndefined();
      expect(
        (resultado as unknown as Record<string, unknown>).senhaHash,
      ).toBeUndefined();
    });

    and(
      /^o e-mail de confirmação de cadastro deve ser enviado para "(.*)"$/,
      (email: string) => {
        expect(servicoEmailMock.enviarConfirmacaoCadastro).toHaveBeenCalledWith(
          email,
          'Ana Souza',
        );
      },
    );
  });

  test('Localização do perfil de acesso por identificador UUID direto', ({
    given,
    when,
    then,
  }) => {
    given(
      'que os repositórios e serviços de apoio estão operacionais',
      configurarAmbiente,
    );

    given(
      /^que o perfil com ID "(.*)" existe e está ativo$/,
      (idPerfil: string) => {
        repositorioPerfilMock.buscarPorCodigoOuNome.mockResolvedValue(null);
        repositorioPerfilMock.buscarPorId.mockResolvedValue({
          ...perfilPadrao,
          id: idPerfil,
        });
      },
    );

    when(
      /^eu submeto o comando de cadastro informando o ID do perfil "(.*)"$/,
      async (idPerfil: string) => {
        await executarComando({
          ...comandoBase,
          perfil: idPerfil,
        });
      },
    );

    then(
      /^o usuário deve ser vinculado ao perfil com ID "(.*)"$/,
      (idPerfil: string) => {
        expect(erroCapturado).toBeNull();
        expect(resultado?.perfilId).toBe(idPerfil);
        expect(repositorioPerfilMock.buscarPorId).toHaveBeenCalledWith(
          idPerfil,
        );
      },
    );
  });

  test('Resiliência do cadastro caso o serviço de envio de e-mail falhe', ({
    given,
    when,
    then,
  }) => {
    given(
      'que os repositórios e serviços de apoio estão operacionais',
      configurarAmbiente,
    );

    given('que o serviço de e-mail está indisponível ou falha', () => {
      servicoEmailMock.enviarConfirmacaoCadastro.mockRejectedValue(
        new Error('SMTP unreachable'),
      );
    });

    when('eu submeto um comando de cadastro válido', async () => {
      await executarComando(comandoBase);
    });

    then(
      'o usuário deve ser cadastrado com sucesso sem que a falha de e-mail interrompa o fluxo',
      () => {
        expect(erroCapturado).toBeNull();
        expect(resultado).toBeDefined();
        expect(resultado?.id).toBe('user-generated-uuid');
      },
    );
  });

  test('Rejeição de cadastro quando o e-mail já existe', ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      'que os repositórios e serviços de apoio estão operacionais',
      configurarAmbiente,
    );

    given(/^que já existe um usuário cadastrado com o e-mail "(.*)"$/, () => {
      repositorioUsuarioMock.existePorEmail.mockResolvedValue(true);
    });

    when(
      /^eu submeto um comando de cadastro com o e-mail "(.*)"$/,
      async (email: string) => {
        await executarComando({
          ...comandoBase,
          email,
        });
      },
    );

    then(
      'o cadastro deve ser rejeitado com erro indicando que o e-mail já existe',
      () => {
        expect(erroCapturado).toBeInstanceOf(UsuarioEmailJaExisteException);
      },
    );

    and('o usuário não deve ser persistido', () => {
      expect(repositorioUsuarioMock.salvar).not.toHaveBeenCalled();
    });

    and('a senha não deve ter hash gerado', () => {
      expect(geradorHashSenhaMock.gerarHash).not.toHaveBeenCalled();
    });

    and('nenhum e-mail de confirmação deve ser enviado', () => {
      expect(servicoEmailMock.enviarConfirmacaoCadastro).not.toHaveBeenCalled();
    });
  });

  test('Rejeição de cadastro com e-mail duplicado em caixa alta ou mista (normalização AC-03)', ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      'que os repositórios e serviços de apoio estão operacionais',
      configurarAmbiente,
    );

    given(/^que já existe um usuário cadastrado com o e-mail "(.*)"$/, () => {
      repositorioUsuarioMock.existePorEmail.mockResolvedValue(true);
    });

    when(
      /^eu submeto um comando de cadastro com o e-mail "(.*)"$/,
      async (email: string) => {
        await executarComando({
          ...comandoBase,
          email,
        });
      },
    );

    then(
      'a unicidade deve ser validada após normalização em caixa baixa',
      () => {
        expect(repositorioUsuarioMock.existePorEmail).toHaveBeenCalledWith(
          'ana.souza@farmaubs.local',
        );
      },
    );

    and(
      'o cadastro deve ser rejeitado com erro indicando que o e-mail já existe',
      () => {
        expect(erroCapturado).toBeInstanceOf(UsuarioEmailJaExisteException);
      },
    );
  });

  test('Rejeição de cadastro quando o perfil não for encontrado no catálogo', ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      'que os repositórios e serviços de apoio estão operacionais',
      configurarAmbiente,
    );

    given(/^que o perfil "(.*)" não existe no catálogo$/, () => {
      repositorioPerfilMock.buscarPorCodigoOuNome.mockResolvedValue(null);
      repositorioPerfilMock.buscarPorId.mockResolvedValue(null);
    });

    when(
      /^eu submeto um comando de cadastro informando o perfil "(.*)"$/,
      async (perfil: string) => {
        await executarComando({
          ...comandoBase,
          perfil,
        });
      },
    );

    then(
      'o cadastro deve ser rejeitado com erro de perfil não encontrado',
      () => {
        expect(erroCapturado).toBeInstanceOf(PerfilNaoEncontradoException);
      },
    );

    and('o usuário não deve ser persistido', () => {
      expect(repositorioUsuarioMock.salvar).not.toHaveBeenCalled();
    });
  });

  test('Rejeição de cadastro quando o perfil existe mas está inativo', ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      'que os repositórios e serviços de apoio estão operacionais',
      configurarAmbiente,
    );

    given(/^que o perfil "(.*)" existe mas está inativo$/, () => {
      repositorioPerfilMock.buscarPorCodigoOuNome.mockResolvedValue({
        ...perfilPadrao,
        ativo: false,
      });
    });

    when(
      /^eu submeto um comando de cadastro informando o perfil "(.*)"$/,
      async (perfil: string) => {
        await executarComando({
          ...comandoBase,
          perfil,
        });
      },
    );

    then(
      'o cadastro deve ser rejeitado com erro de perfil não encontrado ou inativo',
      () => {
        expect(erroCapturado).toBeInstanceOf(PerfilNaoEncontradoException);
      },
    );

    and('o usuário não deve ser persistido', () => {
      expect(repositorioUsuarioMock.salvar).not.toHaveBeenCalled();
    });
  });

  test('Rejeição por campos obrigatórios ausentes ou inválidos', ({
    given,
    when,
    then,
  }) => {
    given(
      'que os repositórios e serviços de apoio estão operacionais',
      configurarAmbiente,
    );

    when(
      /^eu submeto um comando com dados inválidos contendo "(.*)" igual a "(.*)"$/,
      async (campo: string, valor: string) => {
        if (campo === 'comando' && valor === 'nulo') {
          await executarComando(null);
          return;
        }

        const comandoInvalido: CadastrarUsuarioComando = { ...comandoBase };

        if (campo === 'nomeCompleto' && valor === 'espacos') {
          comandoInvalido.nomeCompleto = '   ';
        } else if (campo === 'email' && valor === 'vazio') {
          comandoInvalido.email = '';
        } else if (campo === 'email' && valor === 'formato-invalido') {
          comandoInvalido.email = 'email-sem-arroba';
        } else if (campo === 'senha' && valor === 'vazia') {
          comandoInvalido.senha = '';
        } else if (campo === 'senha' && valor === 'curta') {
          comandoInvalido.senha = '1234567';
        } else if (campo === 'perfil' && valor === 'vazio') {
          comandoInvalido.perfil = '';
        } else if (campo === 'ubsIds' && valor === 'vazia') {
          comandoInvalido.ubsIds = [];
        } else if (campo === 'municipioId' && valor === 'vazio') {
          comandoInvalido.municipioId = '';
        }

        await executarComando(comandoInvalido);
      },
    );

    then('o cadastro deve ser rejeitado com erro de validação de dados', () => {
      expect(erroCapturado).toBeInstanceOf(DadosUsuarioInvalidosException);
      expect(repositorioUsuarioMock.salvar).not.toHaveBeenCalled();
    });
  });

  test('Rejeição quando uma das UBSs informadas não existe no sistema', ({
    given,
    when,
    then,
  }) => {
    given(
      'que os repositórios e serviços de apoio estão operacionais',
      configurarAmbiente,
    );

    given('que uma das UBSs informadas não existe no sistema', () => {
      repositorioUnidadeSaudeMock.buscarIdsExistentes.mockResolvedValue([]);
    });

    when(
      'eu submeto um comando de cadastro com uma UBS inexistente',
      async () => {
        await executarComando(comandoBase);
      },
    );

    then(
      'o cadastro deve ser rejeitado com erro de unidade de saúde inválida',
      () => {
        expect(erroCapturado).toBeInstanceOf(UnidadeSaudeInvalidaException);
        expect(repositorioUsuarioMock.salvar).not.toHaveBeenCalled();
      },
    );
  });

  test('Deduplicação de IDs de UBS duplicadas na mesma requisição', ({
    given,
    when,
    then,
  }) => {
    given(
      'que os repositórios e serviços de apoio estão operacionais',
      configurarAmbiente,
    );

    when(
      'eu submeto o comando de cadastro informando IDs de UBS duplicados',
      async () => {
        const idRepetido = '22222222-2222-2222-2222-222222222222';
        await executarComando({
          ...comandoBase,
          ubsIds: [idRepetido, idRepetido, idRepetido],
        });
      },
    );

    then('as UBSs associadas ao usuário salvo devem ser deduplicadas', () => {
      expect(erroCapturado).toBeNull();
      expect(resultado?.ubsIds).toEqual([
        '22222222-2222-2222-2222-222222222222',
      ]);
      expect(repositorioUsuarioMock.salvar).toHaveBeenCalledWith(
        expect.anything(),
        ['22222222-2222-2222-2222-222222222222'],
      );
    });
  });
});
