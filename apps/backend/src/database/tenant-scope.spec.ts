import { TABLE_SCOPES, TableScope } from './tenant-scope';

describe('tenant-scope manifest (unit)', () => {
  it('deve conter as tabelas obrigatórias de identidade e escopo', () => {
    const tableNames = TABLE_SCOPES.map((t: TableScope) => t.table);

    expect(tableNames).toContain('municipios');
    expect(tableNames).toContain('unidades_saude');
    expect(tableNames).toContain('perfis');
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('sessions');
    expect(tableNames).toContain('user_units');
  });

  it('deve ter escopo válido (municipio | global) e justificativa em todas as tabelas', () => {
    for (const entry of TABLE_SCOPES) {
      expect(['municipio', 'global']).toContain(entry.scope);
      expect(entry.justification).toBeDefined();
      expect(entry.justification.trim().length).toBeGreaterThan(0);
      expect(entry.table).toBeDefined();
      expect(entry.table.trim().length).toBeGreaterThan(0);
    }
  });

  it('deve registrar "perfis" com escopo "global" e referência ao ADR-006 / NF009', () => {
    const perfisScope = TABLE_SCOPES.find((t) => t.table === 'perfis');

    expect(perfisScope).toBeDefined();
    expect(perfisScope?.scope).toBe('global');
    expect(perfisScope?.justification).toContain('ADR-006');
    expect(perfisScope?.justification).toContain('NF009');
  });
});
