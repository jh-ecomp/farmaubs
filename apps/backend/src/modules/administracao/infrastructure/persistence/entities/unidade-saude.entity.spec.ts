import { getMetadataArgsStorage } from 'typeorm';
import { UnidadeSaudeEntity } from './unidade-saude.entity';
import { MunicipioEntity } from './municipio.entity';

describe('UnidadeSaudeEntity (unit)', () => {
  describe('Instanciação e valores de propriedades', () => {
    it('deve instanciar uma entidade UnidadeSaudeEntity com as propriedades corretas', () => {
      const unidade = new UnidadeSaudeEntity();
      const now = new Date();

      unidade.id = '01912345-6789-7abc-def0-123456789abc';
      unidade.municipio_id = '01912345-6789-7abc-def0-123456789def';
      unidade.nome = 'UBS Central';
      unidade.endereco = 'Rua Principal, 100';
      unidade.responsavel_tecnico = 'Dr. Silva';
      unidade.caf_lead_time_days = 15;
      unidade.created_at = now;
      unidade.updated_at = now;

      expect(unidade.id).toBe('01912345-6789-7abc-def0-123456789abc');
      expect(unidade.municipio_id).toBe('01912345-6789-7abc-def0-123456789def');
      expect(unidade.nome).toBe('UBS Central');
      expect(unidade.endereco).toBe('Rua Principal, 100');
      expect(unidade.responsavel_tecnico).toBe('Dr. Silva');
      expect(unidade.caf_lead_time_days).toBe(15);
      expect(unidade.created_at).toBe(now);
      expect(unidade.updated_at).toBe(now);
    });
  });

  describe('Metadados do TypeORM (mapeamento relacional)', () => {
    const storage = getMetadataArgsStorage();

    it('deve estar mapeada para a tabela "unidades_saude"', () => {
      const table = storage.tables.find((t) => t.target === UnidadeSaudeEntity);

      expect(table).toBeDefined();
      expect(table?.name).toBe('unidades_saude');
    });

    it('deve configurar a coluna de chave primária "id" do tipo uuid com default "gen_random_uuid()"', () => {
      const col = storage.columns.find(
        (c) => c.target === UnidadeSaudeEntity && c.propertyName === 'id',
      );

      expect(col).toBeDefined();
      expect(col?.options.primary).toBe(true);
      expect(col?.options.type).toBe('uuid');

      const rawDefault = col?.options.default as unknown;
      const defaultValue: unknown =
        typeof rawDefault === 'function'
          ? (rawDefault as () => unknown)()
          : rawDefault;
      expect(defaultValue).toBe('gen_random_uuid()');
    });

    it('deve configurar a coluna "municipio_id" como uuid obrigatória', () => {
      const col = storage.columns.find(
        (c) =>
          c.target === UnidadeSaudeEntity && c.propertyName === 'municipio_id',
      );

      expect(col).toBeDefined();
      expect(col?.options.type).toBe('uuid');
      expect(col?.options.nullable).toBe(false);
    });

    it('deve configurar a coluna "nome" como text obrigatória', () => {
      const col = storage.columns.find(
        (c) => c.target === UnidadeSaudeEntity && c.propertyName === 'nome',
      );

      expect(col).toBeDefined();
      expect(col?.options.type).toBe('text');
      expect(col?.options.nullable).toBe(false);
    });

    it('deve configurar a coluna "endereco" como text opcional (nullable)', () => {
      const col = storage.columns.find(
        (c) => c.target === UnidadeSaudeEntity && c.propertyName === 'endereco',
      );

      expect(col).toBeDefined();
      expect(col?.options.type).toBe('text');
      expect(col?.options.nullable).toBe(true);
    });

    it('deve configurar a coluna "responsavel_tecnico" como text opcional (nullable)', () => {
      const col = storage.columns.find(
        (c) =>
          c.target === UnidadeSaudeEntity &&
          c.propertyName === 'responsavel_tecnico',
      );

      expect(col).toBeDefined();
      expect(col?.options.type).toBe('text');
      expect(col?.options.nullable).toBe(true);
    });

    it('deve configurar a coluna "caf_lead_time_days" como integer com default 15', () => {
      const col = storage.columns.find(
        (c) =>
          c.target === UnidadeSaudeEntity &&
          c.propertyName === 'caf_lead_time_days',
      );

      expect(col).toBeDefined();
      expect(col?.options.type).toBe('integer');
      expect(col?.options.default).toBe(15);
      expect(col?.options.nullable).toBe(false);
    });

    it('deve configurar a coluna "created_at" como timestamptz', () => {
      const col = storage.columns.find(
        (c) =>
          c.target === UnidadeSaudeEntity && c.propertyName === 'created_at',
      );

      expect(col).toBeDefined();
      expect(col?.mode).toBe('createDate');
      expect(col?.options.type).toBe('timestamptz');
    });

    it('deve configurar a coluna "updated_at" como timestamptz', () => {
      const col = storage.columns.find(
        (c) =>
          c.target === UnidadeSaudeEntity && c.propertyName === 'updated_at',
      );

      expect(col).toBeDefined();
      expect(col?.mode).toBe('updateDate');
      expect(col?.options.type).toBe('timestamptz');
    });

    it('deve configurar relacionamento ManyToOne com MunicipioEntity', () => {
      const relation = storage.relations.find(
        (r) =>
          r.target === UnidadeSaudeEntity && r.propertyName === 'municipio',
      );

      const relType = relation?.type;
      const relTarget =
        typeof relType === 'function' ? (relType as () => unknown)() : relType;
      expect(relTarget).toBe(MunicipioEntity);
    });

    it('deve configurar o índice na coluna municipio_id', () => {
      const index = storage.indices.find(
        (i) =>
          i.target === UnidadeSaudeEntity &&
          i.name === 'idx_unidades_saude_municipio_id',
      );

      expect(index).toBeDefined();
    });
  });
});
