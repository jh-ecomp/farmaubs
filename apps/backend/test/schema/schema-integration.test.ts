import { DataSource } from 'typeorm';
import {
  createTestDataSource,
  resetTestDatabase,
  revertAllMigrations,
  tableExists,
  getColumns,
  getConstraints,
  getIndexes,
} from './schema-harness';

// Escopo atual da AC-01: 6 tabelas. password_reset_tokens e totp_secrets
// foram adiadas (decisão do Principal Engineer) — fora deste teste.
const TABELAS = [
  'municipios',
  'unidades_saude',
  'users',
  'perfis',
  'user_units',
  'sessions',
];

// Tabelas que possuem coluna `id` própria .
const TABELAS_COM_ID = TABELAS;

const COLUNAS_ESPERADAS: Record<string, Record<string, string>> = {
  municipios: {
    id: 'uuid',
    nome: 'text',
    uf: 'bpchar',
    ibge_code: 'bpchar',
    created_at: 'timestamptz',
    updated_at: 'timestamptz',
  },
  perfis: {
    id: 'uuid',
    codigo: 'varchar',
    nome: 'varchar',
    descricao: 'text',
    ativo: 'bool',
    created_at: 'timestamptz',
    updated_at: 'timestamptz',
  },
  unidades_saude: {
    id: 'uuid',
    municipio_id: 'uuid',
    nome: 'text',
    endereco: 'text',
    responsavel_tecnico: 'text',
    caf_lead_time_days: 'int4',
    created_at: 'timestamptz',
    updated_at: 'timestamptz',
  },
  users: {
    id: 'uuid',
    municipio_id: 'uuid',
    nome_completo: 'varchar',
    email: 'varchar',
    senha_hash: 'varchar',
    perfil_id: 'uuid',
    ativo: 'bool',
    deve_trocar_senha: 'bool',
    tentativas_login_falhas: 'int2',
    bloqueado_ate: 'timestamptz',
    senha_atualizada_em: 'timestamptz',
    ultimo_login_em: 'timestamptz',
    created_at: 'timestamptz',
    updated_at: 'timestamptz',
  },
  user_units: {
    id: 'uuid',
    usuario_id: 'uuid',
    unidade_id: 'uuid',
    ativo: 'bool',
    created_at: 'timestamptz',
    updated_at: 'timestamptz',
  },
  sessions: {
    id: 'uuid',
    usuario_id: 'uuid',
    token_hash: 'bpchar',
    status: 'varchar',
    totp_verificado_em: 'timestamptz',
    ip_origem: 'inet',
    user_agent: 'text',
    criado_em: 'timestamptz',
    ultima_atividade_em: 'timestamptz',
    expira_em: 'timestamptz',
    revogada_em: 'timestamptz',
  },
};

const NOT_NULL_ESPERADAS: Record<string, string[]> = {
  municipios: ['id', 'nome', 'uf', 'created_at', 'updated_at'],
  perfis: ['id', 'codigo', 'nome', 'ativo', 'created_at', 'updated_at'],
  unidades_saude: [
    'id',
    'municipio_id',
    'nome',
    'caf_lead_time_days',
    'created_at',
    'updated_at',
  ],
  users: [
    'id',
    'municipio_id',
    'nome_completo',
    'email',
    'senha_hash',
    'perfil_id',
    'ativo',
    'deve_trocar_senha',
    'tentativas_login_falhas',
    'created_at',
    'updated_at',
  ],
  user_units: [
    'id',
    'usuario_id',
    'unidade_id',
    'ativo',
    'created_at',
    'updated_at',
  ],
  sessions: [
    'id',
    'usuario_id',
    'token_hash',
    'status',
    'criado_em',
    'ultima_atividade_em',
    'expira_em',
  ],
};

describe('TAREFA-13 — Testes de integração de schema (AC-01)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    await resetTestDatabase();
    ds = createTestDataSource();
    await ds.initialize();
    await ds.runMigrations();
  });

  afterAll(async () => {
    await ds?.destroy();
  });

  it('TC-01 — migrations aplicam do zero em banco limpo sem erro', async () => {
    const rows = await ds.query(
      `SELECT count(*)::int AS total FROM migrations`,
    );
    expect(rows[0].total).toBeGreaterThan(0);
    // Nenhuma pendente: todas as migrations carregadas foram aplicadas
    expect(rows[0].total).toBe(ds.migrations.length);
  });

  it('TC-02 — as 6 tabelas do schema de acesso existem', async () => {
    for (const tabela of TABELAS) {
      expect(await tableExists(ds, tabela)).toBe(true);
    }
  });

  it('TC-03 — colunas e tipos corretos', async () => {
    for (const [tabela, colunas] of Object.entries(COLUNAS_ESPERADAS)) {
      const reais = await getColumns(ds, tabela);
      const porNome = new Map(reais.map((c) => [c.column_name, c]));
      for (const [coluna, tipo] of Object.entries(colunas)) {
        const real = porNome.get(coluna);
        expect(real).toBeDefined();
        expect(real!.udt_name).toBe(tipo);
      }
    }
  });

  it('TC-04 — constraints NOT NULL verificadas', async () => {
    for (const [tabela, colunas] of Object.entries(NOT_NULL_ESPERADAS)) {
      const reais = await getColumns(ds, tabela);
      const porNome = new Map(reais.map((c) => [c.column_name, c]));
      for (const coluna of colunas) {
        expect(porNome.get(coluna)?.is_nullable).toBe('NO');
      }
    }
  });

  it('TC-05 — chaves primárias verificadas', async () => {
    for (const tabela of TABELAS) {
      const constraints = await getConstraints(ds, tabela);
      const pks = constraints.filter((c) => c.contype === 'p');
      expect(pks.length).toBeGreaterThan(0);
    }
  });

  it('TC-06 — chaves estrangeiras verificadas', async () => {
    const fksEsperadas: Record<string, string[]> = {
      unidades_saude: ['FOREIGN KEY (municipio_id) REFERENCES municipios(id)'],
      users: [
        'FOREIGN KEY (municipio_id) REFERENCES municipios(id)',
        'FOREIGN KEY (perfil_id) REFERENCES perfis(id)',
      ],
      user_units: [
        'FOREIGN KEY (usuario_id) REFERENCES users(id)',
        'FOREIGN KEY (unidade_id) REFERENCES unidades_saude(id)',
      ],
      sessions: ['FOREIGN KEY (usuario_id) REFERENCES users(id)'],
    };
    for (const [tabela, esperadas] of Object.entries(fksEsperadas)) {
      const reais = (await getConstraints(ds, tabela))
        .filter((c) => c.contype === 'f')
        .map((c) => c.definition);
      for (const esperada of esperadas) {
        expect(reais.some((d) => d.includes(esperada))).toBe(true);
      }
    }
  });

  it('TC-07 — constraints UNIQUE verificadas', async () => {
    const perfis = await getConstraints(ds, 'perfis');
    expect(
      perfis.some(
        (c) => c.contype === 'u' && c.definition.includes('(codigo)'),
      ),
    ).toBe(true);

    const municipios = await getConstraints(ds, 'municipios');
    expect(
      municipios.some(
        (c) => c.contype === 'u' && c.definition.includes('(ibge_code)'),
      ),
    ).toBe(true);

    const usersIdx = await getIndexes(ds, 'users');
    expect(
      usersIdx.some(
        (i) =>
          i.indexdef.includes('UNIQUE') && i.indexdef.includes('lower((email)'),
      ),
    ).toBe(true);

    const userUnits = await getConstraints(ds, 'user_units');
    expect(
      userUnits.some(
        (c) =>
          c.contype === 'u' &&
          c.definition.includes('(usuario_id, unidade_id)'),
      ),
    ).toBe(true);

    const sessions = await getConstraints(ds, 'sessions');
    expect(
      sessions.some(
        (c) => c.contype === 'u' && c.definition.includes('(token_hash)'),
      ),
    ).toBe(true);
  });

  it('TC-08 — defaults verificados', async () => {
    // id: uuidv7() em todas as tabelas (todas têm id próprio)
    for (const tabela of TABELAS) {
      const cols = await getColumns(ds, tabela);
      const id = cols.find((c) => c.column_name === 'id');
      expect(id?.column_default).toContain('uuidv7()');
    }
    // created_at / updated_at: now() ou CURRENT_TIMESTAMP (mesma função)
    for (const tabela of [
      'municipios',
      'perfis',
      'unidades_saude',
      'users',
      'user_units',
    ]) {
      const cols = await getColumns(ds, tabela);
      for (const c of ['created_at', 'updated_at']) {
        const col = cols.find((x) => x.column_name === c);
        expect(col).toBeDefined();
        const defaultVal = col!.column_default ?? '';
        expect(
          defaultVal.includes('now()') ||
            defaultVal.includes('CURRENT_TIMESTAMP'),
        ).toBe(true);
      }
    }
    // sessions usa criado_em / ultima_atividade_em
    const sessions = await getColumns(ds, 'sessions');
    for (const c of ['criado_em', 'ultima_atividade_em']) {
      const col = sessions.find((x) => x.column_name === c);
      expect(col?.column_default).toContain('now()');
    }
    // perfis.ativo: true
    const perfis = await getColumns(ds, 'perfis');
    expect(
      perfis.find((c) => c.column_name === 'ativo')?.column_default,
    ).toContain('true');
  });

  it('TC-09 — índices verificados', async () => {
    // Índice de expiração de sessão (expurgo — NF012): coluna expira_em
    const sessions = await getIndexes(ds, 'sessions');
    expect(sessions.some((i) => i.indexdef.includes('expira_em'))).toBe(true);

    const unidades = await getIndexes(ds, 'unidades_saude');
    expect(unidades.some((i) => i.indexdef.includes('municipio_id'))).toBe(
      true,
    );
    const usersIdx = await getIndexes(ds, 'users');
    expect(usersIdx.some((i) => i.indexdef.includes('municipio_id'))).toBe(
      true,
    );
  });

  it('TC-10 — down() remove os objetos na ordem correta', async () => {
    await revertAllMigrations(ds);
    for (const tabela of TABELAS) {
      expect(await tableExists(ds, tabela)).toBe(false);
    }
  });

  it('TC-11 — up → down → up é idempotente', async () => {
    await ds.runMigrations(); // up (após TC-10 o banco está vazio)
    for (const tabela of TABELAS) {
      expect(await tableExists(ds, tabela)).toBe(true);
    }
    await revertAllMigrations(ds);
    for (const tabela of TABELAS) {
      expect(await tableExists(ds, tabela)).toBe(false);
    }
    await ds.runMigrations(); // up final — deixa o banco migrado para TC-12/13
    for (const tabela of TABELAS) {
      expect(await tableExists(ds, tabela)).toBe(true);
    }
  });

  it('TC-12 — unicidade de e-mail com normalização de caixa', async () => {
    const [municipio] = await ds.query(
      `INSERT INTO municipios (nome, uf, ibge_code) VALUES ('Teste TC12', 'TE', '9999999') RETURNING id`,
    );
    const [perfil] = await ds.query(
      `INSERT INTO perfis (codigo, nome) VALUES ('TESTE_TC12', 'Perfil TC-12') RETURNING id`,
    );
    const inserirUsuario = (email: string) =>
      ds.query(
        `INSERT INTO users
           (id, municipio_id, nome_completo, email, senha_hash, perfil_id,
            ativo, deve_trocar_senha, tentativas_login_falhas, bloqueado_ate,
            senha_atualizada_em, ultimo_login_em)
         VALUES (uuidv7(), $1, 'Usuário TC-12', $2, 'hash-teste', $3, true, false, 0, NULL, now(), NULL)`,
        [municipio.id, email, perfil.id],
      );
    await inserirUsuario('Teste@Farmaubs.dev');
    await expect(inserirUsuario('teste@farmaubs.dev')).rejects.toThrow(
      /duplicate key|unique/i,
    );
  });

  it('TC-13 — associação user_units duplicada rejeitada', async () => {
    const [municipio] = await ds.query(
      `INSERT INTO municipios (nome, uf, ibge_code) VALUES ('Teste TC13', 'TE', '9999998') RETURNING id`,
    );
    const [perfil] = await ds.query(
      `INSERT INTO perfis (codigo, nome) VALUES ('TESTE_TC13', 'Perfil TC-13') RETURNING id`,
    );
    const [usuario] = await ds.query(
      `INSERT INTO users
         (id, municipio_id, nome_completo, email, senha_hash, perfil_id,
          ativo, deve_trocar_senha, tentativas_login_falhas, bloqueado_ate,
          senha_atualizada_em, ultimo_login_em)
       VALUES (uuidv7(), $1, 'Usuário TC-13', 'tc13@farmaubs.dev', 'hash-teste', $2, true, false, 0, NULL, now(), NULL)
       RETURNING id`,
      [municipio.id, perfil.id],
    );
    const [unidade] = await ds.query(
      `INSERT INTO unidades_saude
         (id, municipio_id, nome, endereco, responsavel_tecnico, caf_lead_time_days)
       VALUES (uuidv7(), $1, 'UBS TC-13', 'Rua X, 1', 'Resp TC-13', 15)
       RETURNING id`,
      [municipio.id],
    );
    await ds.query(
      `INSERT INTO user_units (usuario_id, unidade_id, ativo) VALUES ($1, $2, true)`,
      [usuario.id, unidade.id],
    );
    await expect(
      ds.query(
        `INSERT INTO user_units (usuario_id, unidade_id, ativo) VALUES ($1, $2, true)`,
        [usuario.id, unidade.id],
      ),
    ).rejects.toThrow(/duplicate key|unique/i);
  });
});
