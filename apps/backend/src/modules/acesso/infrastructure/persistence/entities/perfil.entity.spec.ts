import { getMetadataArgsStorage } from 'typeorm';
import { PerfilEntity } from './perfil.entity';

describe('PerfilEntity (unit)', () => {
  describe('Instanciação e valores de propriedades', () => {
    it('deve instanciar uma entidade PerfilEntity com as propriedades corretas', () => {
      const perfil = new PerfilEntity();
      const now = new Date();

      perfil.id = '01912345-6789-7abc-def0-123456789abc';
      perfil.codigo = 'ADMINISTRADOR';
      perfil.nome = 'Administrador';
      perfil.descricao = 'Acesso total ao sistema';
      perfil.ativo = true;
      perfil.created_at = now;
      perfil.updated_at = now;

      expect(perfil.id).toBe('01912345-6789-7abc-def0-123456789abc');
      expect(perfil.codigo).toBe('ADMINISTRADOR');
      expect(perfil.nome).toBe('Administrador');
      expect(perfil.descricao).toBe('Acesso total ao sistema');
      expect(perfil.ativo).toBe(true);
      expect(perfil.created_at).toBe(now);
      expect(perfil.updated_at).toBe(now);
    });
  });

  describe('normalizeCodigo (hooks de ciclo de vida)', () => {
    it('deve converter código com letras minúsculas para maiúsculas', () => {
      const perfil = new PerfilEntity();
      perfil.codigo = 'farmaceutico_responsavel';

      perfil.normalizeCodigo();

      expect(perfil.codigo).toBe('FARMACEUTICO_RESPONSAVEL');
    });

    it('deve remover espaços em branco nas extremidades do código', () => {
      const perfil = new PerfilEntity();
      perfil.codigo = '  gestor  ';

      perfil.normalizeCodigo();

      expect(perfil.codigo).toBe('GESTOR');
    });

    it('deve converter para maiúsculas e remover espaços simultaneamente', () => {
      const perfil = new PerfilEntity();
      perfil.codigo = ' farmaceutico_residente ';

      perfil.normalizeCodigo();

      expect(perfil.codigo).toBe('FARMACEUTICO_RESIDENTE');
    });

    it('não deve alterar código que já esteja em maiúsculas e sem espaços', () => {
      const perfil = new PerfilEntity();
      perfil.codigo = 'ADMINISTRADOR';

      perfil.normalizeCodigo();

      expect(perfil.codigo).toBe('ADMINISTRADOR');
    });

    it('não deve lançar erro se codigo for undefined ou vazio', () => {
      const perfil = new PerfilEntity();

      expect(() => {
        perfil.normalizeCodigo();
      }).not.toThrow();

      perfil.codigo = '';
      expect(() => {
        perfil.normalizeCodigo();
      }).not.toThrow();
      expect(perfil.codigo).toBe('');
    });
  });

  describe('Metadados do TypeORM (mapeamento relacional)', () => {
    const storage = getMetadataArgsStorage();

    it('deve estar mapeada para a tabela "perfis"', () => {
      const table = storage.tables.find((t) => t.target === PerfilEntity);

      expect(table).toBeDefined();
      expect(table?.name).toBe('perfis');
    });

    it('deve configurar a coluna de chave primária "id" do tipo uuid com default "uuidv7()"', () => {
      const col = storage.columns.find(
        (c) => c.target === PerfilEntity && c.propertyName === 'id',
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

    it('deve configurar a coluna "codigo" como varchar(50), única e obrigatória', () => {
      const col = storage.columns.find(
        (c) => c.target === PerfilEntity && c.propertyName === 'codigo',
      );

      expect(col).toBeDefined();
      expect(col?.options.type).toBe('varchar');
      expect(col?.options.length).toBe(50);
      expect(col?.options.unique).toBe(true);
      expect(col?.options.nullable).toBe(false);
    });

    it('deve configurar a coluna "nome" como varchar(100) obrigatória (não nula)', () => {
      const col = storage.columns.find(
        (c) => c.target === PerfilEntity && c.propertyName === 'nome',
      );

      expect(col).toBeDefined();
      expect(col?.options.type).toBe('varchar');
      expect(col?.options.length).toBe(100);
      expect(col?.options.nullable).toBe(false);
    });

    it('deve configurar a coluna "descricao" como text opcional (nullable)', () => {
      const col = storage.columns.find(
        (c) => c.target === PerfilEntity && c.propertyName === 'descricao',
      );

      expect(col).toBeDefined();
      expect(col?.options.type).toBe('text');
      expect(col?.options.nullable).toBe(true);
    });

    it('deve configurar a coluna "ativo" como boolean com default true e obrigatória', () => {
      const col = storage.columns.find(
        (c) => c.target === PerfilEntity && c.propertyName === 'ativo',
      );

      expect(col).toBeDefined();
      expect(col?.options.type).toBe('boolean');
      expect(col?.options.default).toBe(true);
      expect(col?.options.nullable).toBe(false);
    });

    it('deve configurar a coluna "created_at" como timestamptz com default "now()"', () => {
      const col = storage.columns.find(
        (c) => c.target === PerfilEntity && c.propertyName === 'created_at',
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
        (c) => c.target === PerfilEntity && c.propertyName === 'updated_at',
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

    it('deve registrar os listeners @BeforeInsert e @BeforeUpdate para o método normalizeCodigo', () => {
      const listeners = storage.entityListeners.filter(
        (l) =>
          l.target === PerfilEntity && l.propertyName === 'normalizeCodigo',
      );

      const types = listeners.map((l) => l.type);
      expect(types).toContain('before-insert');
      expect(types).toContain('before-update');
      expect(listeners).toHaveLength(2);
    });
  });
});
