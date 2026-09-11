import { defineFeature, loadFeature } from 'jest-cucumber';
import * as path from 'path';
import { TypeOrmUserRepository } from './typeorm-user.repository';
import { TransactionContext } from '../../../../common/transaction/transaction-context.service';
import {
  DadosCriacaoUsuario,
  UsuarioModeloDominio,
} from '../../domain/entities/user-registration.entity';
import { User } from '../../../administracao/infrastructure/persistence/entities/user.entity';
import { UserUnit } from '../../../administracao/infrastructure/persistence/entities/UserUnit.entity';

const feature = loadFeature(
  path.resolve(__dirname, 'typeorm-user.repository.feature'),
);

defineFeature(feature, (test) => {
  let repositorio: TypeOrmUserRepository;
  let mockEntityManager: {
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
    transaction: jest.Mock;
    queryRunner?: { isTransactionActive?: boolean };
  };
  let mockQueryBuilder: {
    where: jest.Mock;
    getOne: jest.Mock;
    getCount: jest.Mock;
  };
  let mockTransactionContext: {
    getManager: jest.Mock;
  };

  let dadosCriacao: DadosCriacaoUsuario;
  let ubsIdsInformados: string[];
  let usuarioRetornado: UsuarioModeloDominio | null = null;
  let existeRetornado: boolean | null = null;
  let erroCapturado: Error | null = null;

  const entidadeUserFalsa = (): User => {
    const u = new User();
    u.id = 'c1a2b3c4-0000-0000-0000-000000000001';
    u.municipio_id = 'm1m1m1m1-0000-0000-0000-000000000001';
    u.nome_completo = 'Carlos Eduardo';
    u.email = 'carlos@ubs.gov.br';
    u.senha_hash = '$2b$12$hashedPasswordExampleValue';
    u.perfil_id = 'p1p1p1p1-0000-0000-0000-000000000001';
    u.ativo = true;
    u.deve_trocar_senha = true;
    u.tentativas_login_falhas = 0;
    u.bloqueado_ate = null;
    u.senha_atualizada_em = null;
    u.ultimo_login_em = null;
    u.created_at = new Date('2026-09-08T00:00:00Z');
    u.updated_at = new Date('2026-09-08T00:00:00Z');
    return u;
  };

  const configurarAmbiente = () => {
    usuarioRetornado = null;
    existeRetornado = null;
    erroCapturado = null;
    ubsIdsInformados = [];

    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
      getCount: jest.fn().mockResolvedValue(0),
    };

    mockEntityManager = {
      save: jest
        .fn()
        .mockImplementation((_entityClass, entityOrEntities: unknown) => {
          if (Array.isArray(entityOrEntities)) {
            return Promise.resolve(entityOrEntities);
          }
          const item = entityOrEntities as Record<string, unknown>;
          return Promise.resolve({
            ...item,
            created_at: item.created_at ?? new Date('2026-09-08T00:00:00Z'),
            updated_at: item.updated_at ?? new Date('2026-09-08T00:00:00Z'),
          });
        }),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      transaction: jest
        .fn()
        .mockImplementation(
          <T>(
            callback: (em: typeof mockEntityManager) => Promise<T>,
          ): Promise<T> => callback(mockEntityManager),
        ),
      queryRunner: undefined,
    };

    mockTransactionContext = {
      getManager: jest.fn().mockReturnValue(mockEntityManager),
    };

    repositorio = new TypeOrmUserRepository(
      mockTransactionContext as unknown as TransactionContext,
    );
  };

  test('Salvar novo usuário com perfil e múltiplas UBSs com sucesso', ({
    given,
    and,
    when,
    then,
  }) => {
    given(
      'que o adaptador de repositório TypeOrmUserRepository está inicializado',
      configurarAmbiente,
    );

    and(
      /^que recebo dados válidos de criação para o usuário "(.*)" com e-mail "(.*)"$/,
      (nome: string, email: string) => {
        dadosCriacao = {
          municipioId: 'm1m1m1m1-0000-0000-0000-000000000001',
          nomeCompleto: nome,
          email,
          senhaHash: '$2b$12$hashedPasswordExampleValue',
          perfilId: 'p1p1p1p1-0000-0000-0000-000000000001',
          ativo: true,
          deveTrocarSenha: true,
          tentativasLoginFalhas: 0,
        };
      },
    );

    and(
      /^que associo o usuário às UBSs "(.*)" e "(.*)"$/,
      (ubs1: string, ubs2: string) => {
        ubsIdsInformados = [ubs1, ubs2];
      },
    );

    when('eu invoco o método salvar do repositório', async () => {
      usuarioRetornado = await repositorio.salvar(
        dadosCriacao,
        ubsIdsInformados,
      );
    });

    then('a entidade User deve ser salva com os dados normalizados', () => {
      expect(mockEntityManager.save).toHaveBeenCalledWith(
        User,
        expect.objectContaining({
          nome_completo: 'Carlos Eduardo',
          email: 'carlos@ubs.gov.br',
          perfil_id: 'p1p1p1p1-0000-0000-0000-000000000001',
          senha_hash: '$2b$12$hashedPasswordExampleValue',
          ativo: true,
        }),
      );
    });

    and(
      'os registros de UserUnit devem ser salvos vinculando o usuário a cada UBS',
      () => {
        expect(mockEntityManager.save).toHaveBeenCalledWith(
          UserUnit,
          expect.arrayContaining([
            expect.objectContaining({
              usuarioId: usuarioRetornado?.id,
              unidadeId: '11111111-1111-1111-1111-111111111111',
              ativo: true,
            }),
            expect.objectContaining({
              usuarioId: usuarioRetornado?.id,
              unidadeId: '22222222-2222-2222-2222-222222222222',
              ativo: true,
            }),
          ]),
        );
      },
    );

    and('o modelo de domínio do usuário criado deve ser retornado', () => {
      expect(usuarioRetornado).toBeDefined();
      expect(usuarioRetornado?.nomeCompleto).toBe('Carlos Eduardo');
      expect(usuarioRetornado?.email).toBe('carlos@ubs.gov.br');
      expect(usuarioRetornado?.perfilId).toBe(
        'p1p1p1p1-0000-0000-0000-000000000001',
      );
      expect(usuarioRetornado?.ativo).toBe(true);
    });
  });

  test('Salvar usuário deduplicando IDs de UBS duplicadas', ({
    given,
    and,
    when,
    then,
  }) => {
    given(
      'que o adaptador de repositório TypeOrmUserRepository está inicializado',
      configurarAmbiente,
    );

    and(
      /^que recebo dados válidos de criação para o usuário "(.*)" com e-mail "(.*)"$/,
      (nome: string, email: string) => {
        dadosCriacao = {
          municipioId: 'm1m1m1m1-0000-0000-0000-000000000001',
          nomeCompleto: nome,
          email,
          senhaHash: '$2b$12$hashedPasswordExampleValue',
          perfilId: 'p1p1p1p1-0000-0000-0000-000000000001',
          ativo: true,
          deveTrocarSenha: true,
          tentativasLoginFalhas: 0,
        };
      },
    );

    and(
      /^que a lista de UBSs contém IDs repetidos "(.*)"$/,
      (ubsId: string) => {
        ubsIdsInformados = [ubsId, ubsId, ubsId];
      },
    );

    when('eu invoco o método salvar do repositório', async () => {
      usuarioRetornado = await repositorio.salvar(
        dadosCriacao,
        ubsIdsInformados,
      );
    });

    then('apenas registros únicos devem ser persistidos em UserUnit', () => {
      const chamadas = mockEntityManager.save.mock.calls as unknown as [
        unknown,
        unknown,
      ][];
      const chamadasUserUnit = chamadas.filter((call) => call[0] === UserUnit);
      expect(chamadasUserUnit).toHaveLength(1);
      const listaSalva = chamadasUserUnit[0][1] as UserUnit[];
      expect(listaSalva).toHaveLength(1);
      expect(listaSalva[0].unidadeId).toBe(
        '11111111-1111-1111-1111-111111111111',
      );
    });
  });

  test('Buscar usuário existente por e-mail com sucesso', ({
    given,
    and,
    when,
    then,
  }) => {
    given(
      'que o adaptador de repositório TypeOrmUserRepository está inicializado',
      configurarAmbiente,
    );

    and(
      /^que existe um registro de usuário com e-mail "(.*)" no banco$/,
      () => {
        mockQueryBuilder.getOne.mockResolvedValue(entidadeUserFalsa());
      },
    );

    when(/^eu busco o usuário pelo e-mail "(.*)"$/, async (email: string) => {
      usuarioRetornado = await repositorio.buscarPorEmail(email);
    });

    then('o modelo de domínio correspondente deve ser retornado', () => {
      expect(usuarioRetornado).not.toBeNull();
      expect(usuarioRetornado?.email).toBe('carlos@ubs.gov.br');
      expect(usuarioRetornado?.nomeCompleto).toBe('Carlos Eduardo');
    });
  });

  test('Buscar usuário por e-mail com variação de caixa (case-insensitive)', ({
    given,
    and,
    when,
    then,
  }) => {
    given(
      'que o adaptador de repositório TypeOrmUserRepository está inicializado',
      configurarAmbiente,
    );

    and(
      /^que existe um registro de usuário com e-mail "(.*)" no banco$/,
      () => {
        mockQueryBuilder.getOne.mockResolvedValue(entidadeUserFalsa());
      },
    );

    when(/^eu busco o usuário pelo e-mail "(.*)"$/, async (email: string) => {
      usuarioRetornado = await repositorio.buscarPorEmail(email);
    });

    then(
      'a consulta deve ser executada em caixa baixa e retornar o usuário',
      () => {
        expect(mockQueryBuilder.where).toHaveBeenCalledWith(
          'LOWER(u.email) = LOWER(:email)',
          { email: 'carlos@ubs.gov.br' },
        );
        expect(usuarioRetornado).not.toBeNull();
      },
    );
  });

  test('Buscar usuário por e-mail inexistente retornando nulo', ({
    given,
    and,
    when,
    then,
  }) => {
    given(
      'que o adaptador de repositório TypeOrmUserRepository está inicializado',
      configurarAmbiente,
    );

    and(
      /^que não existe nenhum usuário cadastrado com o e-mail "(.*)"$/,
      () => {
        mockQueryBuilder.getOne.mockResolvedValue(null);
      },
    );

    when(/^eu busco o usuário pelo e-mail "(.*)"$/, async (email: string) => {
      usuarioRetornado = await repositorio.buscarPorEmail(email);
    });

    then('o resultado retornado deve ser nulo', () => {
      expect(usuarioRetornado).toBeNull();
    });
  });

  test('Verificar existência de usuário por e-mail retornando verdadeiro', ({
    given,
    and,
    when,
    then,
  }) => {
    given(
      'que o adaptador de repositório TypeOrmUserRepository está inicializado',
      configurarAmbiente,
    );

    and(
      /^que existe um registro de usuário com e-mail "(.*)" no banco$/,
      () => {
        mockQueryBuilder.getCount.mockResolvedValue(1);
      },
    );

    when(
      /^eu verifico a existência do e-mail "(.*)"$/,
      async (email: string) => {
        existeRetornado = await repositorio.existePorEmail(email);
      },
    );

    then('a verificação deve retornar verdadeiro', () => {
      expect(existeRetornado).toBe(true);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'LOWER(u.email) = LOWER(:email)',
        { email: 'carlos@ubs.gov.br' },
      );
    });
  });

  test('Verificar existência por e-mail inexistente retornando falso', ({
    given,
    and,
    when,
    then,
  }) => {
    given(
      'que o adaptador de repositório TypeOrmUserRepository está inicializado',
      configurarAmbiente,
    );

    and(
      /^que não existe nenhum usuário cadastrado com o e-mail "(.*)"$/,
      () => {
        mockQueryBuilder.getCount.mockResolvedValue(0);
      },
    );

    when(
      /^eu verifico a existência do e-mail "(.*)"$/,
      async (email: string) => {
        existeRetornado = await repositorio.existePorEmail(email);
      },
    );

    then('a verificação deve retornar falso', () => {
      expect(existeRetornado).toBe(false);
    });
  });

  test('Reversão transacional (rollback) caso ocorra erro ao salvar user_units', ({
    given,
    and,
    when,
    then,
  }) => {
    given(
      'que o adaptador de repositório TypeOrmUserRepository está inicializado',
      configurarAmbiente,
    );

    and(
      /^que recebo dados de criação para o usuário "(.*)"$/,
      (nome: string) => {
        dadosCriacao = {
          municipioId: 'm1m1m1m1-0000-0000-0000-000000000001',
          nomeCompleto: nome,
          email: 'lucas@ubs.gov.br',
          senhaHash: '$2b$12$hashedPasswordExampleValue',
          perfilId: 'p1p1p1p1-0000-0000-0000-000000000001',
          ativo: true,
          deveTrocarSenha: true,
          tentativasLoginFalhas: 0,
        };
        ubsIdsInformados = ['11111111-1111-1111-1111-111111111111'];
      },
    );

    and(
      'ocorre um erro de banco ao tentar salvar os registros de UserUnit',
      () => {
        mockEntityManager.save.mockImplementation((entityClass) => {
          if (entityClass === UserUnit) {
            return Promise.reject(new Error('Falha de conexão com o banco'));
          }
          return Promise.resolve(entidadeUserFalsa());
        });
      },
    );

    when('eu invoco o método salvar do repositório', async () => {
      try {
        await repositorio.salvar(dadosCriacao, ubsIdsInformados);
      } catch (err) {
        erroCapturado = err as Error;
      }
    });

    then('a exceção deve ser lançada e a transação deve ser abortada', () => {
      expect(erroCapturado).toBeDefined();
      expect(erroCapturado?.message).toBe('Falha de conexão com o banco');
      expect(mockEntityManager.transaction).toHaveBeenCalled();
    });
  });
});
