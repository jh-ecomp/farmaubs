import { DataSource } from "typeorm";
import {
  createTestDataSource,
  resetTestDatabase,
  tableExists,
} from "./schema-harness";

const TABELAS_DISPENSACAO = [
  "pacientes",
  "dispensacoes",
  "dispensacao_itens",
] as const;

describe("DI-01 — Integridade do Schema de Dispensação (Camada B)", () => {
  let ds: DataSource;
  let municipioParnaibaId: string;
  let municipioOutroId: string;
  let unidadePrimaveraId: string;
  let dispensadorId: string;

  beforeAll(async () => {
    await resetTestDatabase();
    ds = createTestDataSource();
    await ds.initialize();
    await ds.runMigrations();

    const [parnaiba] = await ds.query(
      `INSERT INTO municipios (nome, uf, codigo_ibge) VALUES ('Parnaíba', 'PI', '2207702') RETURNING id`,
    );
    const [outro] = await ds.query(
      `INSERT INTO municipios (nome, uf, codigo_ibge) VALUES ('Teresina', 'PI', '2211001') RETURNING id`,
    );
    municipioParnaibaId = parnaiba.id;
    municipioOutroId = outro.id;

    const [unidade] = await ds.query(
      `INSERT INTO unidades_saude (municipio_id, nome, endereco, responsavel_tecnico, caf_lead_time_days)
       VALUES ($1, 'UBS Jardim Primavera', 'Rua A, 10', 'Dra. Maria', 15) RETURNING id`,
      [municipioParnaibaId],
    );
    unidadePrimaveraId = unidade.id;

    const [perfil] = await ds.query(
      `INSERT INTO perfis (codigo, nome) VALUES ('FARMACEUTICO_RESPONSAVEL', 'Farmacêutico Responsável')
       ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome RETURNING id`,
    );

    const [user] = await ds.query(
      `INSERT INTO users (municipio_id, nome_completo, email, senha_hash, perfil_id, ativo, deve_trocar_senha, tentativas_login_falhas)
       VALUES ($1, 'Farmacêutico DI01', 'farma.di01@farmaubs.test', 'hash', $2, true, false, 0) RETURNING id`,
      [municipioParnaibaId, perfil.id],
    );
    dispensadorId = user.id;
  });

  afterAll(async () => {
    await ds?.destroy();
  });

  it("cria as tabelas pacientes, dispensacoes e dispensacao_itens", async () => {
    for (const tabela of TABELAS_DISPENSACAO) {
      expect(await tableExists(ds, tabela)).toBe(true);
    }
  });

  it("Cenário: Tentativa de inserção de paciente sem CNS ou CPF válido", async () => {
    await expect(
      ds.query(
        `INSERT INTO pacientes (municipio_id, cns, cpf, nome_completo, data_nascimento)
         VALUES ($1, '123456789012345', '1234567890', 'Paciente CPF Curto', '1990-05-10')`,
        [municipioParnaibaId],
      ),
    ).rejects.toThrow(/chk_pacientes_cpf_length/);

    await expect(
      ds.query(
        `INSERT INTO pacientes (municipio_id, cns, cpf, nome_completo, data_nascimento)
         VALUES ($1, '12345678901234', '12345678901', 'Paciente CNS Curto', '1990-05-10')`,
        [municipioParnaibaId],
      ),
    ).rejects.toThrow(/chk_pacientes_cns_length/);
  });

  it("Cenário: Rejeição de paciente duplicado no mesmo município", async () => {
    await ds.query(
      `INSERT INTO pacientes (municipio_id, cns, cpf, nome_completo, data_nascimento)
       VALUES ($1, '700000000000001', '12345678901', 'João da Silva', '1985-03-20')`,
      [municipioParnaibaId],
    );

    await expect(
      ds.query(
        `INSERT INTO pacientes (municipio_id, cns, cpf, nome_completo, data_nascimento)
         VALUES ($1, '700000000000002', '12345678901', 'Outro Nome', '1992-07-15')`,
        [municipioParnaibaId],
      ),
    ).rejects.toThrow(/idx_pacientes_municipio_cpf/);

    // Permite o mesmo CPF em município distinto
    await expect(
      ds.query(
        `INSERT INTO pacientes (municipio_id, cns, cpf, nome_completo, data_nascimento)
         VALUES ($1, '700000000000001', '12345678901', 'João da Silva', '1985-03-20')`,
        [municipioOutroId],
      ),
    ).resolves.toBeDefined();
  });

  it("Cenário: Garantia de isolamento multi-tenancy e integridade de dispensação", async () => {
    const [paciente] = await ds.query(
      `SELECT id FROM pacientes WHERE municipio_id = $1 AND cpf = '12345678901'`,
      [municipioParnaibaId],
    );

    const [dispensacao] = await ds.query(
      `INSERT INTO dispensacoes (municipio_id, unidade_id, paciente_id, dispensador_id, numero_atendimento, status)
       VALUES ($1, $2, $3, $4, 'DSP-2026-0001', 'concluida') RETURNING id`,
      [
        municipioParnaibaId,
        unidadePrimaveraId,
        paciente.id,
        dispensadorId,
      ],
    );

    await ds.query(
      `INSERT INTO dispensacao_itens (municipio_id, dispensacao_id, medicamento_id, lote_id, quantidade_dispensada, posologia)
       VALUES ($1, $2, uuidv7(), uuidv7(), 30, '1 cp 12/12h')`,
      [municipioParnaibaId, dispensacao.id],
    );

    // Consulta como farmaubs_app no município incorreto -> 0 registros via RLS
    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.query(`SET LOCAL ROLE farmaubs_app`);
      await qr.query(`SELECT set_config('app.municipio_id', $1, true)`, [
        municipioOutroId,
      ]);
      const rowsOutro = await qr.query(`SELECT * FROM dispensacoes`);
      expect(rowsOutro).toHaveLength(0);

      // Consulta no município correto -> 1 registro
      await qr.query(`SELECT set_config('app.municipio_id', $1, true)`, [
        municipioParnaibaId,
      ]);
      const rowsParnaiba = await qr.query(`SELECT * FROM dispensacoes`);
      expect(rowsParnaiba).toHaveLength(1);

      // Tentativa de DELETE permanente bloqueada para farmaubs_app
      await expect(
        qr.query(`DELETE FROM dispensacoes WHERE id = $1`, [dispensacao.id]),
      ).rejects.toThrow(/permission denied/i);
    } finally {
      await qr.rollbackTransaction().catch(() => undefined);
      await qr.release();
    }
  });
});

