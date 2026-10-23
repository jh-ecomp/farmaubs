import { DataSource } from "typeorm";
import {
  createTestDataSource,
  resetTestDatabase,
  tableExists,
} from "./schema-harness";

const TABELAS_RECEBIMENTO = [
  "produtos",
  "fabricantes",
  "documentos_entrada",
  "lotes",
  "recebimento_itens",
  "movimentacoes_estoque",
] as const;

describe("RE-01 — Integridade do Schema de Recebimento e Estoque (Camada B)", () => {
  let ds: DataSource;
  let municipioParnaibaId: string;
  let municipioOutroId: string;
  let ubsCentroId: string;
  let ubsOutraId: string;
  let usuarioId: string;
  let produtoId: string;
  let fabricanteId: string;

  beforeAll(async () => {
    await resetTestDatabase();
    ds = createTestDataSource();
    await ds.initialize();
    await ds.runMigrations();

    // 1. Setup de Municípios e Unidades
    const [parnaiba] = await ds.query(
      `INSERT INTO municipios (nome, uf, codigo_ibge) VALUES ('Parnaíba', 'PI', '2207702') RETURNING id`,
    );
    const [outro] = await ds.query(
      `INSERT INTO municipios (nome, uf, codigo_ibge) VALUES ('Teresina', 'PI', '2211001') RETURNING id`,
    );
    municipioParnaibaId = parnaiba.id;
    municipioOutroId = outro.id;

    const [ubsCentro] = await ds.query(
      `INSERT INTO unidades_saude (municipio_id, nome, endereco, responsavel_tecnico, caf_lead_time_days)
       VALUES ($1, 'UBS Centro', 'Praça da Graça, 100', 'Dra. Ana', 10) RETURNING id`,
      [municipioParnaibaId],
    );
    const [ubsOutra] = await ds.query(
      `INSERT INTO unidades_saude (municipio_id, nome, endereco, responsavel_tecnico, caf_lead_time_days)
       VALUES ($1, 'UBS Teresina Norte', 'Av. Central, 50', 'Dr. Marcos', 10) RETURNING id`,
      [municipioOutroId],
    );
    ubsCentroId = ubsCentro.id;
    ubsOutraId = ubsOutra.id;

    const [perfil] = await ds.query(
      `INSERT INTO perfis (codigo, nome) VALUES ('FARMACEUTICO_RESPONSAVEL', 'Farmacêutico Responsável')
       ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome RETURNING id`,
    );

    const [user] = await ds.query(
      `INSERT INTO users (municipio_id, nome_completo, email, senha_hash, perfil_id, ativo, deve_trocar_senha, tentativas_login_falhas)
       VALUES ($1, 'Farmacêutico RE01', 'farma.re01@farmaubs.test', 'hash', $2, true, false, 0) RETURNING id`,
      [municipioParnaibaId, perfil.id],
    );
    usuarioId = user.id;

    // 2. Setup de Produto e Fabricante
    const [prod] = await ds.query(
      `INSERT INTO produtos (nome_comercial, principio_ativo, dosagem, apresentacao, categoria)
       VALUES ('Amato', 'Topiramato', '50mg', 'Comprimido Revestido', 'CONTROLADOS') RETURNING id`,
    );
    produtoId = prod.id;

    const [fab] = await ds.query(
      `INSERT INTO fabricantes (razao_social, nome_fantasia, cnpj)
       VALUES ('Eurofarma Laboratórios S.A.', 'Eurofarma', '61190096000192') RETURNING id`,
    );
    fabricanteId = fab.id;
  });

  afterAll(async () => {
    await ds?.destroy();
  });

  it("cria todas as tabelas do schema de recebimento e estoque", async () => {
    for (const tabela of TABELAS_RECEBIMENTO) {
      expect(await tableExists(ds, tabela)).toBe(true);
    }
  });

  it("rejeita criação de lote com saldo negativo via constraint", async () => {
    await expect(
      ds.query(
        `INSERT INTO lotes (municipio_id, ubs_id, produto_id, fabricante_id, numero_lote, data_validade, saldo_atual)
         VALUES ($1, $2, $3, $4, 'LOT-NEGATIVO', '2027-12-31', -5)`,
        [municipioParnaibaId, ubsCentroId, produtoId, fabricanteId],
      ),
    ).rejects.toThrow(/chk_lotes_saldo_nao_negativo/);
  });

  it("rejeita duplicidade de lote na mesma UBS, produto e fabricante", async () => {
    await ds.query(
      `INSERT INTO lotes (municipio_id, ubs_id, produto_id, fabricante_id, numero_lote, data_validade, saldo_atual)
       VALUES ($1, $2, $3, $4, 'LOT-UNICO-01', '2027-06-30', 100)`,
      [municipioParnaibaId, ubsCentroId, produtoId, fabricanteId],
    );

    await expect(
      ds.query(
        `INSERT INTO lotes (municipio_id, ubs_id, produto_id, fabricante_id, numero_lote, data_validade, saldo_atual)
         VALUES ($1, $2, $3, $4, 'LOT-UNICO-01', '2027-06-30', 50)`,
        [municipioParnaibaId, ubsCentroId, produtoId, fabricanteId],
      ),
    ).rejects.toThrow(/uq_lotes_ubs_produto_lote_fabricante/);

    // Permite o mesmo lote em UBS distinta
    await expect(
      ds.query(
        `INSERT INTO lotes (municipio_id, ubs_id, produto_id, fabricante_id, numero_lote, data_validade, saldo_atual)
         VALUES ($1, $2, $3, $4, 'LOT-UNICO-01', '2027-06-30', 50)`,
        [municipioOutroId, ubsOutraId, produtoId, fabricanteId],
      ),
    ).resolves.toBeDefined();
  });

  it("rejeita documento de entrada com número inválido ou status incorreto", async () => {
    await expect(
      ds.query(
        `INSERT INTO documentos_entrada (municipio_id, ubs_id, numero_documento, fornecedor_origem, usuario_recebedor_id)
         VALUES ($1, $2, ' ', 'CAF Central', $3)`,
        [municipioParnaibaId, ubsCentroId, usuarioId],
      ),
    ).rejects.toThrow(/chk_documentos_entrada_numero/);

    await expect(
      ds.query(
        `INSERT INTO documentos_entrada (municipio_id, ubs_id, numero_documento, fornecedor_origem, usuario_recebedor_id, status)
         VALUES ($1, $2, 'GUIA-123', 'CAF Central', $3, 'STATUS_INVALIDO')`,
        [municipioParnaibaId, ubsCentroId, usuarioId],
      ),
    ).rejects.toThrow(/chk_documentos_entrada_status/);
  });

  it("garante isolamento multi-tenancy com Row-Level Security (RLS) e bloqueio de DELETE", async () => {
    // 1. Inserir guia em Parnaíba
    const [guiaParnaiba] = await ds.query(
      `INSERT INTO documentos_entrada (municipio_id, ubs_id, numero_documento, fornecedor_origem, usuario_recebedor_id, status)
       VALUES ($1, $2, 'GUIA-PARNAIBA-100', 'CAF Central', $3, 'CONCLUIDO') RETURNING id`,
      [municipioParnaibaId, ubsCentroId, usuarioId],
    );

    // 2. Inserir guia em Teresina
    await ds.query(
      `INSERT INTO documentos_entrada (municipio_id, ubs_id, numero_documento, fornecedor_origem, usuario_recebedor_id, status)
       VALUES ($1, $2, 'GUIA-TERESINA-200', 'SESAPI', $3, 'CONCLUIDO') RETURNING id`,
      [municipioOutroId, ubsOutraId, usuarioId],
    );

    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      await qr.query(`SET LOCAL ROLE farmaubs_app`);

      // Consulta no escopo de Parnaíba
      await qr.query(`SELECT set_config('app.municipio_id', $1, true)`, [
        municipioParnaibaId,
      ]);
      const docsParnaiba = await qr.query(
        `SELECT * FROM documentos_entrada WHERE id = $1`,
        [guiaParnaiba.id],
      );
      expect(docsParnaiba).toHaveLength(1);

      // Consulta no escopo de outro município (Teresina) -> Não pode enxergar a guia de Parnaíba
      await qr.query(`SELECT set_config('app.municipio_id', $1, true)`, [
        municipioOutroId,
      ]);
      const docsInvisivel = await qr.query(
        `SELECT * FROM documentos_entrada WHERE id = $1`,
        [guiaParnaiba.id],
      );
      expect(docsInvisivel).toHaveLength(0);

      // DELETE permanente bloqueado para farmaubs_app
      await expect(
        qr.query(`DELETE FROM documentos_entrada WHERE id = $1`, [
          guiaParnaiba.id,
        ]),
      ).rejects.toThrow(/permission denied/i);
    } finally {
      await qr.rollbackTransaction().catch(() => undefined);
      await qr.release();
    }
  });
});
