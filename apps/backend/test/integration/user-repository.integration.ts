import { defineFeature, loadFeature } from 'jest-cucumber';
import * as path from 'node:path';
import { DataSource } from 'typeorm';
import { adminDatabaseUrl, appDatabaseUrl } from '../test-db';
import { TypeOrmUserRepository } from '../../src/modules/acesso/infrastructure/adapters/typeorm-user.repository';
import { TransactionContext } from '../../src/common/transaction/transaction-context.service';
import { User } from '../../src/modules/administracao/infrastructure/persistence/entities/user.entity';
import { UserUnit } from '../../src/modules/administracao/infrastructure/persistence/entities/UserUnit.entity';
import { PerfilEntity } from '../../src/modules/acesso/infrastructure/persistence/entities/perfil.entity';
import { UnidadeSaudeEntity } from '../../src/modules/administracao/infrastructure/persistence/entities/unidade-saude.entity';
import { MunicipioEntity } from '../../src/modules/administracao/infrastructure/persistence/entities/municipio.entity';
import {
  DadosCriacaoUsuario,
  UsuarioModeloDominio,
} from '../../src/modules/acesso/domain/models/user-registration.model';

const feature = loadFeature(
  path.resolve(__dirname, 'user-repository.integration.feature'),
);

const MUNICIPIO_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PERFIL_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const UNIDADE_1_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const UNIDADE_2_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

defineFeature(feature, (test) => {
  let admin: DataSource;
  let app: DataSource;
  let transactionContext: TransactionContext;
  let repositorio: TypeOrmUserRepository;

  let dadosCriacaoRoberto: DadosCriacaoUsuario;
  let ubsIdsRoberto: string[];
  let usuarioSalvoRoberto: UsuarioModeloDominio | null = null;

  let usuarioBuscado: UsuarioModeloDominio | null = null;
  let existeRetornado: boolean | null = null;
  let naoExisteRetornado: boolean | null = null;

  let erroRollback: Error | null = null;

  beforeAll(async () => {
    admin = new DataSource({
      type: 'postgres',
      url: adminDatabaseUrl(),
    });

    app = new DataSource({
      type: 'postgres',
      url: appDatabaseUrl(),
      entities: [
        User,
        UserUnit,
        PerfilEntity,
        UnidadeSaudeEntity,
        MunicipioEntity,
      ],
    });

    await admin.initialize();
    await app.initialize();

    // Limpeza idempotente
    await admin.query(
      `DELETE FROM users WHERE email LIKE '%@repo-integration.test'`,
    );
    await admin.query(`DELETE FROM unidades_saude WHERE id IN ($1, $2)`, [
      UNIDADE_1_ID,
      UNIDADE_2_ID,
    ]);

    // Seed dos pré-requisitos reais (município, perfil e unidades de saúde)
    await admin.query(
      `INSERT INTO municipios (id, nome, uf) VALUES ($1, 'Município Repo Test', 'SP') ON CONFLICT (id) DO NOTHING`,
      [MUNICIPIO_ID],
    );
    await admin.query(
      `INSERT INTO perfis (id, codigo, nome) VALUES ($1, 'FARMACEUTICO_REPO', 'Farmacêutico Repo Test') ON CONFLICT (id) DO NOTHING`,
      [PERFIL_ID],
    );
    await admin.query(
      `INSERT INTO unidades_saude (id, municipio_id, nome) VALUES ($1, $2, 'UBS Repo Test 1') ON CONFLICT (id) DO NOTHING`,
      [UNIDADE_1_ID, MUNICIPIO_ID],
    );
    await admin.query(
      `INSERT INTO unidades_saude (id, municipio_id, nome) VALUES ($1, $2, 'UBS Repo Test 2') ON CONFLICT (id) DO NOTHING`,
      [UNIDADE_2_ID, MUNICIPIO_ID],
    );

    transactionContext = new TransactionContext(app);
    repositorio = new TypeOrmUserRepository(transactionContext);
  });

  async function executarNoTenant<T>(
    municipioId: string,
    operacao: () => Promise<T>,
  ): Promise<T> {
    const qr = app.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.query(`SELECT set_config('app.municipio_id', $1, true)`, [
        municipioId,
      ]);
      const resultado = await transactionContext.run(qr, operacao);
      await qr.commitTransaction();
      return resultado;
    } catch (error) {
      await qr.rollbackTransaction().catch(() => undefined);
      throw error;
    } finally {
      await qr.release();
    }
  }

  afterAll(async () => {
    if (admin?.isInitialized) {
      await admin.query(
        `DELETE FROM users WHERE email LIKE '%@repo-integration.test'`,
      );
      await admin.query(`DELETE FROM unidades_saude WHERE id IN ($1, $2)`, [
        UNIDADE_1_ID,
        UNIDADE_2_ID,
      ]);
      await admin.destroy();
    }
    if (app?.isInitialized) {
      await app.destroy();
    }
  });

  test('Persistência real de usuário e vínculos user_units no PostgreSQL', ({
    given,
    and,
    when,
    then,
  }) => {
    given(
      'que o banco PostgreSQL está operacional com município, perfil e UBSs previamente semeados',
      () => {
        expect(admin.isInitialized).toBe(true);
        expect(app.isInitialized).toBe(true);
      },
    );

    and(
      /^que recebo os dados de criação para o usuário "(.*)" com e-mail "(.*)" e senha hash "(.*)"$/,
      (nome: string, email: string, hash: string) => {
        dadosCriacaoRoberto = {
          municipioId: MUNICIPIO_ID,
          nomeCompleto: nome,
          email,
          senhaHash: hash,
          perfilId: PERFIL_ID,
          ativo: true,
          deveTrocarSenha: true,
          tentativasLoginFalhas: 0,
        };
      },
    );

    and('que informo as UBSs cadastradas para o vínculo', () => {
      ubsIdsRoberto = [UNIDADE_1_ID, UNIDADE_2_ID];
    });

    when(
      'eu executo o método salvar do TypeOrmUserRepository conectado ao banco real',
      async () => {
        usuarioSalvoRoberto = await repositorio.salvar(
          dadosCriacaoRoberto,
          ubsIdsRoberto,
        );
      },
    );

    then(
      'o usuário deve ser persistido fisicamente na tabela users com status ativo',
      async () => {
        expect(usuarioSalvoRoberto).toBeDefined();

        interface LinhaUser {
          id: string;
          nome_completo: string;
          email: string;
          senha_hash: string;
          perfil_id: string;
          ativo: boolean;
        }

        // Consulta direta via conexão admin (ground truth)
        const linhasUser = await admin.query<LinhaUser[]>(
          `SELECT id, nome_completo, email, senha_hash, perfil_id, ativo FROM users WHERE id = $1`,
          [usuarioSalvoRoberto?.id],
        );

        expect(linhasUser).toHaveLength(1);
        expect(linhasUser[0].nome_completo).toBe('Roberto Martins');
        expect(linhasUser[0].email).toBe('roberto@repo-integration.test');
        expect(linhasUser[0].senha_hash).toBe(
          '$2b$12$hashedPasswordExampleValue',
        );
        expect(linhasUser[0].perfil_id).toBe(PERFIL_ID);
        expect(linhasUser[0].ativo).toBe(true);
      },
    );

    and(
      'as associações correspondentes devem ser persistidas fisicamente na tabela user_units com ativo verdadeiro',
      async () => {
        interface LinhaUnit {
          usuario_id: string;
          unidade_id: string;
          ativo: boolean;
        }

        const linhasUnits = await admin.query<LinhaUnit[]>(
          `SELECT usuario_id, unidade_id, ativo FROM user_units WHERE usuario_id = $1 ORDER BY unidade_id ASC`,
          [usuarioSalvoRoberto?.id],
        );

        expect(linhasUnits).toHaveLength(2);
        expect(linhasUnits[0].usuario_id).toBe(usuarioSalvoRoberto?.id);
        expect(linhasUnits[0].ativo).toBe(true);
        expect(linhasUnits[1].usuario_id).toBe(usuarioSalvoRoberto?.id);
        expect(linhasUnits[1].ativo).toBe(true);

        const unidadesPersistidas = linhasUnits.map((l) => l.unidade_id);
        expect(unidadesPersistidas).toContain(UNIDADE_1_ID);
        expect(unidadesPersistidas).toContain(UNIDADE_2_ID);
      },
    );
  });

  test('Busca de usuário por e-mail com case-insensitivity contra índice real do banco', ({
    given,
    when,
    then,
  }) => {
    given(
      'que o banco PostgreSQL está operacional com município, perfil e UBSs previamente semeados',
      () => {
        expect(admin.isInitialized).toBe(true);
        expect(app.isInitialized).toBe(true);
      },
    );

    given(
      /^que o usuário com e-mail "(.*)" está persistido no PostgreSQL$/,
      async (email: string) => {
        const existe = await executarNoTenant(MUNICIPIO_ID, () =>
          repositorio.existePorEmail(email),
        );
        expect(existe).toBe(true);
      },
    );

    when(
      /^eu busco pelo e-mail em maiúsculas "(.*)"$/,
      async (emailMaiusculo: string) => {
        usuarioBuscado = await executarNoTenant(MUNICIPIO_ID, () =>
          repositorio.buscarPorEmail(emailMaiusculo),
        );
      },
    );

    then(
      'o usuário correspondente deve ser retornado pelo repositório com o e-mail em minúsculas',
      () => {
        expect(usuarioBuscado).not.toBeNull();
        expect(usuarioBuscado?.id).toBe(usuarioSalvoRoberto?.id);
        expect(usuarioBuscado?.email).toBe('roberto@repo-integration.test');
        expect(usuarioBuscado?.nomeCompleto).toBe('Roberto Martins');
      },
    );
  });

  test('Verificação de existência de e-mail no banco real', ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      'que o banco PostgreSQL está operacional com município, perfil e UBSs previamente semeados',
      () => {
        expect(admin.isInitialized).toBe(true);
        expect(app.isInitialized).toBe(true);
      },
    );

    given(
      /^que o usuário com e-mail "(.*)" está persistido no PostgreSQL$/,
      async (email: string) => {
        const existe = await executarNoTenant(MUNICIPIO_ID, () =>
          repositorio.existePorEmail(email),
        );
        expect(existe).toBe(true);
      },
    );

    when(
      /^eu verifico a existência do e-mail "(.*)"$/,
      async (email: string) => {
        existeRetornado = await executarNoTenant(MUNICIPIO_ID, () =>
          repositorio.existePorEmail(email),
        );
      },
    );

    then('a verificação no repositório deve retornar verdadeiro', () => {
      expect(existeRetornado).toBe(true);
    });

    and(
      /^a verificação para o e-mail "(.*)" deve retornar falso$/,
      async (emailInexistente: string) => {
        naoExisteRetornado = await executarNoTenant(MUNICIPIO_ID, () =>
          repositorio.existePorEmail(emailInexistente),
        );
        expect(naoExisteRetornado).toBe(false);
      },
    );
  });

  test('Garantia de rollback transacional real ao tentar associar uma UBS inexistente', ({
    given,
    and,
    but,
    when,
    then,
  }) => {
    let dadosCriacaoJuliana: DadosCriacaoUsuario;
    let ubsIdsComInvalida: string[];

    given(
      'que o banco PostgreSQL está operacional com município, perfil e UBSs previamente semeados',
      () => {
        expect(admin.isInitialized).toBe(true);
        expect(app.isInitialized).toBe(true);
      },
    );

    given(
      /^que recebo os dados de criação para o usuário "(.*)" com e-mail "(.*)"$/,
      (nome: string, email: string) => {
        dadosCriacaoJuliana = {
          municipioId: MUNICIPIO_ID,
          nomeCompleto: nome,
          email,
          senhaHash: '$2b$12$hashedPasswordExampleValue',
          perfilId: PERFIL_ID,
          ativo: true,
          deveTrocarSenha: true,
          tentativasLoginFalhas: 0,
        };
      },
    );

    but(
      /^a lista de UBSs contém um identificador inexistente "(.*)"$/,
      (ubsInexistente: string) => {
        // Primeira UBS válida, segunda inexistente (provoca erro de integridade/FK/RLS em user_units)
        ubsIdsComInvalida = [UNIDADE_1_ID, ubsInexistente];
      },
    );

    when(
      'eu tento executar o método salvar do TypeOrmUserRepository',
      async () => {
        erroRollback = null;
        try {
          await repositorio.salvar(dadosCriacaoJuliana, ubsIdsComInvalida);
        } catch (error) {
          erroRollback = error as Error;
        }
      },
    );

    then('o salvamento deve falhar com violação de chave estrangeira', () => {
      expect(erroRollback).toBeDefined();
      // Código 23503 é foreign_key_violation; 42501 é restrição de integridade via RLS policy em user_units
      const err = erroRollback as { code?: string; message?: string };
      expect(
        err.code === '23503' ||
          err.code === '42501' ||
          err.message?.includes('violates foreign key constraint') ||
          err.message?.includes('foreign key') ||
          err.message?.includes('violates row-level security policy'),
      ).toBe(true);
    });

    and(
      /^o usuário "(.*)" não deve existir fisicamente na tabela users devido ao rollback$/,
      async (email: string) => {
        interface LinhaTotal {
          total: number;
        }

        const linhasUsers = await admin.query<LinhaTotal[]>(
          `SELECT count(*)::int AS total FROM users WHERE email = $1`,
          [email],
        );

        expect(linhasUsers[0].total).toBe(0);
      },
    );
  });
});
