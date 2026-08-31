import { getMetadataArgsStorage } from 'typeorm';
import { MunicipioEntity } from './municipio.entity';

describe('MunicipioEntity (unit)', () => {
  describe('Instanciação e valores de propriedades', () => {
    it('deve instanciar uma entidade MunicipioEntity com as propriedades corretas', () => {
      const municipio = new MunicipioEntity();
      const now = new Date();

      municipio.id = '01912345-6789-7abc-def0-123456789abc';
      municipio.nome = 'São Paulo';
      municipio.uf = 'SP';
      municipio.codigo_ibge = '3550308';
      municipio.ativo = true;
      municipio.created_at = now;
      municipio.updated_at = now;

      expect(municipio.id).toBe('01912345-6789-7abc-def0-123456789abc');
      expect(municipio.nome).toBe('São Paulo');
      expect(municipio.uf).toBe('SP');
      expect(municipio.codigo_ibge).toBe('3550308');
      expect(municipio.ativo).toBe(true);
      expect(municipio.created_at).toBe(now);
      expect(municipio.updated_at).toBe(now);
    });
  });

  describe('normalizeUf (hooks de ciclo de vida)', () => {
    it('deve converter UF com letras minúsculas para maiúsculas', () => {
      const municipio = new MunicipioEntity();
      municipio.uf = 'sp';

      municipio.normalizeUf();

      expect(municipio.uf).toBe('SP');
    });

    it('deve remover espaços em branco nas extremidades da UF', () => {
      const municipio = new MunicipioEntity();
      municipio.uf = '  mg  ';

      municipio.normalizeUf();

      expect(municipio.uf).toBe('MG');
    });

    it('deve converter para maiúsculas e remover espaços simultaneamente', () => {
      const municipio = new MunicipioEntity();
      municipio.uf = ' rj ';

      municipio.normalizeUf();

      expect(municipio.uf).toBe('RJ');
    });

    it('não deve alterar UF que já esteja em maiúsculas e sem espaços', () => {
      const municipio = new MunicipioEntity();
      municipio.uf = 'BA';

      municipio.normalizeUf();

      expect(municipio.uf).toBe('BA');
    });

    it('não deve lançar erro se uf for undefined ou vazia', () => {
      const municipio = new MunicipioEntity();

      expect(() => {
        municipio.normalizeUf();
      }).not.toThrow();

      municipio.uf = '';
      expect(() => {
        municipio.normalizeUf();
      }).not.toThrow();
      expect(municipio.uf).toBe('');
    });
  });

  describe('Metadados do TypeORM (mapeamento relacional)', () => {
    const storage = getMetadataArgsStorage();

    it('deve estar mapeada para a tabela "municipios"', () => {
      const table = storage.tables.find((t) => t.target === MunicipioEntity);

      expect(table).toBeDefined();
      expect(table?.name).toBe('municipios');
    });

    it('deve configurar a coluna de chave primária "id" do tipo uuid com default "uuidv7()"', () => {
      const col = storage.columns.find(
        (c) => c.target === MunicipioEntity && c.propertyName === 'id',
      );

      expect(col).toBeDefined();
      expect(col?.options.primary).toBe(true);
      expect(col?.options.type).toBe('uuid');

      const rawDefault = col?.options.default as unknown;
      const defaultValue: unknown =
        typeof rawDefault === 'function'
          ? (rawDefault as () => unknown)()
          : rawDefault;
      expect(defaultValue).toBe('uuidv7()');
    });

    it('deve configurar a coluna "nome" como varchar(150) obrigatória (não nula)', () => {
      const col = storage.columns.find(
        (c) => c.target === MunicipioEntity && c.propertyName === 'nome',
      );

      expect(col).toBeDefined();
      expect(col?.options.type).toBe('varchar');
      expect(col?.options.length).toBe(150);
      expect(col?.options.nullable).toBe(false);
    });

    it('deve configurar a coluna "uf" como char(2) obrigatória (não nula)', () => {
      const col = storage.columns.find(
        (c) => c.target === MunicipioEntity && c.propertyName === 'uf',
      );

      expect(col).toBeDefined();
      expect(col?.options.type).toBe('char');
      expect(col?.options.length).toBe(2);
      expect(col?.options.nullable).toBe(false);
    });

    it('deve configurar a coluna "codigo_ibge" como varchar(7), única e obrigatória', () => {
      const col = storage.columns.find(
        (c) => c.target === MunicipioEntity && c.propertyName === 'codigo_ibge',
      );

      expect(col).toBeDefined();
      expect(col?.options.type).toBe('varchar');
      expect(col?.options.length).toBe(7);
      expect(col?.options.unique).toBe(true);
      expect(col?.options.nullable).toBe(false);
    });

    it('deve configurar a coluna "ativo" como boolean com default true e obrigatória', () => {
      const col = storage.columns.find(
        (c) => c.target === MunicipioEntity && c.propertyName === 'ativo',
      );

      expect(col).toBeDefined();
      expect(col?.options.type).toBe('boolean');
      expect(col?.options.default).toBe(true);
      expect(col?.options.nullable).toBe(false);
    });

    it('deve configurar a coluna "created_at" como timestamptz com default "now()"', () => {
      const col = storage.columns.find(
        (c) => c.target === MunicipioEntity && c.propertyName === 'created_at',
      );

      expect(col).toBeDefined();
      expect(col?.mode).toBe('createDate');
      expect(col?.options.type).toBe('timestamptz');
      expect(col?.options.nullable).toBe(false);

      const rawDefault = col?.options.default as unknown;
      const defaultValue: unknown =
        typeof rawDefault === 'function'
          ? (rawDefault as () => unknown)()
          : rawDefault;
      expect(defaultValue).toBe('now()');
    });

    it('deve configurar a coluna "updated_at" como timestamptz com default "now()"', () => {
      const col = storage.columns.find(
        (c) => c.target === MunicipioEntity && c.propertyName === 'updated_at',
      );

      expect(col).toBeDefined();
      expect(col?.mode).toBe('updateDate');
      expect(col?.options.type).toBe('timestamptz');
      expect(col?.options.nullable).toBe(false);

      const rawDefault = col?.options.default as unknown;
      const defaultValue: unknown =
        typeof rawDefault === 'function'
          ? (rawDefault as () => unknown)()
          : rawDefault;
      expect(defaultValue).toBe('now()');
    });

    it('deve registrar os listeners @BeforeInsert e @BeforeUpdate para o método normalizeUf', () => {
      const listeners = storage.entityListeners.filter(
        (l) => l.target === MunicipioEntity && l.propertyName === 'normalizeUf',
      );

      const types = listeners.map((l) => l.type);
      expect(types).toContain('before-insert');
      expect(types).toContain('before-update');
      expect(listeners).toHaveLength(2);
    });
  });
});
