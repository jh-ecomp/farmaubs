export type TenantScope = 'municipio' | 'global';

export interface TableScope {
  table: string; // nome da tabela no schema public
  scope: TenantScope;
  justification: string; // por que global ou tenant, com referência a ADR/RF
}

/**
 * Fonte de verdade do escopo de tenant (ADR-002/ADR-016).
 * Toda tabela de domínio DEVE ser declarada aqui. O teste de guarda
 * (test/integration/tenant-scope.guard.integration-spec.ts) valida o
 * schema real do banco contra esta lista: tabela não declarada, ou
 * schema divergente, quebra o teste.
 */
export const TABLE_SCOPES: TableScope[] = [
  // Módulo de acesso (ADR-006): globais, pois definem identidade e escopo
  {
    table: 'municipios',
    scope: 'global',
    justification:
      'Registro de tenants (fronteira primária ADR-002). Necessária ao bootstrap de qualquer contexto.',
  },
  {
    table: 'unidades_saude',
    scope: 'global',
    justification:
      'Topologia (RF026). Lida no bootstrap de sessão pré-auth; RLS quebraria o login. municipio_id é FK, não escopo de RLS.',
  },
  {
    table: 'users',
    scope: 'global',
    justification: 'Identidade do usuário, multi-UBS (RF001).',
  },
  {
    table: 'sessions',
    scope: 'global',
    justification: 'Sessão server-side (ADR-006).',
  },
  {
    table: 'user_units',
    scope: 'global',
    justification:
      'Associação usuário-UBS (RF001); define o escopo, não é escopada.',
  },
  {
    table: 'profiles',
    scope: 'global',
    justification: 'Catálogo de perfis RBAC (NF009).',
  },

  // Épicos futuros (padrão a seguir quando entrarem):
  // { table: 'medicamentos', scope: 'municipio', justification: 'Catálogo local REMUME (ADR-016, NF016).' },
  // { table: 'lotes', scope: 'municipio', justification: 'Estoque por UBS (RF008, NF015).' },
];
