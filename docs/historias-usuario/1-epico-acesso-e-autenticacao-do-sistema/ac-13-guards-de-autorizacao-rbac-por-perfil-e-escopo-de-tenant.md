# AC-13 Guards de autorização RBAC por perfil e escopo de tenant (ADR-006)

- **Épico**: Acesso e Autenticação do Sistema (RF001–RF004, NF009–NF012)
- **Requisitos Funcionais**: RF025 (RBAC e Gestão de Usuários), RF001 (Vínculo e Restrição por UBS)
- **Requisitos Não-Funcionais**: NF009 (Princípio do Menor Privilégio / RBAC), NF010 (Performance: zero queries redundantes por request), NF015 (Isolamento Multi-tenant e Acesso Interunidades Restrito), NF016 (Defesa em Profundidade)
- **ADRs Vinculadas**: ADR-002 (Isolamento Multi-tenancy e Escopos Globais), ADR-003 (Arquitetura Hexagonal), ADR-006 (Controle de Acesso Baseado em Perfis - RBAC), ADR-016 (Transações Atômicas e RLS), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes BDD), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de Usuário

> **Como** usuário autenticado do FarmaUBS,  
> **quero** que cada requisição à API seja autorizada automaticamente tanto pelo meu perfil de acesso (`RolesGuard`) quanto pelo meu escopo de tenant municipal e de UBSs (`TenantScopeGuard`),  
> **para que** eu tenha acesso estritamente aos recursos do meu perfil e da minha unidade de atuação, impedindo vazamento de dados ou operações cruzadas indevidas entre diferentes municípios ou unidades de saúde (NF009, NF015).

---

## 2. Regras de Negócio e Casos de Borda

1. **Separação Rígida entre Autenticação e Autorização (NF009)**:
   - A autenticação (validação do token/sessão server-side com retorno `401 Unauthorized`) já é tratada pelo `AuthGuard` / `SessionAuthGuard` (AC-05/AC-10/AC-29).
   - A autorização tratada nesta história responde exclusivamente a: *"O usuário autenticado tem permissão para esta rota e este recurso?"*. Falhas de autorização retornam invariavelmente **`403 Forbidden`**.

2. **Ordem Canônica de Execução dos Guards**:
   - `AuthGuard` (invalidação `401` se não autenticado)  
     → `RolesGuard` (invalidação `403` se perfil não autorizado)  
     → `TenantScopeGuard` (invalidação `403` se município/UBS fora do escopo).

3. **Matriz Declarativa de Perfis RBAC (`RolesGuard`)**:
   - As rotas declaram os perfis permitidos através do decorator `@Roles(...)`.
   - O FarmaUBS utiliza **perfil único** por usuário (`perfilCodigo: PerfilCodigo`).
   - Se o `@Roles()` for omitido na rota, a rota exige apenas autenticação. Se estiver presente, o `req.user.perfilCodigo` deve coincidir com um dos perfis anotados.

| Recurso / Domínio | Farmacêutico Residente | Farmacêutico Responsável | Gerente / Coordenador | Administrador |
| :--- | :---: | :---: | :---: | :---: |
| Dispensação e Estoque Local | ✅ | ✅ | ✅ | ✅ |
| Relatórios Locais de UBS | ❌ | ✅ | ✅ | ✅ |
| Gestão Municipal e Indicadores | ❌ | ❌ | ✅ | ✅ |
| Gestão de Usuários e Perfis | ❌ | ❌ | ❌ | ✅ |
| Gestão de Topologia de UBSs | ❌ | ❌ | ❌ | ✅ |

4. **Escopo Global do Administrador (ADR-002)**:
   - Usuários com perfil `ADMINISTRADOR` possuem **visão global e sistêmica**.
   - O `TenantScopeGuard` concede **bypass automático** para administradores em qualquer checagem de município ou UBS, permitindo auditar e gerenciar registros de qualquer cidade do FarmaUBS.

5. **Validação de Escopo de Tenant (`TenantScopeGuard`)**:
   - Para os perfis operacionais (`FARMACEUTICO_RESPONSAVEL`, `FARMACEUTICO_RESIDENTE`, `GERENTE`):
     - **Escopo Municipal**: Qualquer parâmetro de rota (`:municipioId`), query (`?municipioId=...`) ou corpo (`body.municipioId`) deve ser estritamente igual a `req.user.municipioId`.
     - **Escopo de UBS**: Qualquer parâmetro identificando uma unidade de saúde (`:unidadeId`, `:ubsId`, `body.unidadeId`) deve constar no array de UBSs vinculadas ao usuário (`req.user.unidadeIds`).
     - Se o recurso demandar uma unidade não vinculada ao usuário, a requisição é sumariamente rejeitada com `403 Forbidden`.

6. **Acesso Cruzado Autorizado (Exceção Explícita)**:
   - Um farmacêutico só pode acessar outra UBS se essa UBS tiver sido previamente e explicitamente associada ao seu usuário na tabela `user_units` pelo Administrador. Não existe "acesso cruzado implícito". Se a unidade consta em `req.user.unidadeIds`, é autorizada; se não consta, é rejeitada com `403 Forbidden`.

7. **Propagação do Escopo para o Contexto de Transação (ADR-016)**:
   - Após a validação com sucesso pelo `TenantScopeGuard`, o guard injeta o objeto consolidado `req.tenantScope` contendo `{ municipioId, unidadeIds, isGlobalAdmin }`.
   - O interceptor de transação utiliza `req.tenantScope.municipioId` para emitir o comando `SET LOCAL farmaubs.current_tenant_id = ...`, alinhando a segurança do NestJS com as políticas de RLS do PostgreSQL.

8. **Rotas Públicas (`@Public()`)**:
   - Rotas marcadas com `@Public()` (ex.: `POST /api/v1/acesso/login`) ignoram tanto o `AuthGuard` quanto os guards de autorização.

9. **Validação Instantânea via Snapshot de Sessão sem Queries Extras (NF010, ADR-006)**:
   - Para que os guards `RolesGuard` e `TenantScopeGuard` operem com latência zero e sem queries adicionais ao banco a cada requisição HTTP, a busca do token executada pelo `AuthGuard` utiliza a stored function `auth_buscar_sessao_por_token` no PostgreSQL.
   - Essa função consolida em **uma única query com joins**: dados cadastrais do usuário, seu `perfil_codigo` (join com `perfis`), a lista agregada de `unidade_ids` (agrupamento de `user_units`) e a flag `deve_trocar_senha`.
   - O `AuthGuard` mapeia esse retorno para a interface `SessionRecord` / `SessaoUsuarioSnapshot` e popula diretamente `req.user` e `req.tenantScope`, tornando toda a avaliação dos guards subsequentes uma checagem puramente em memória.

---

## 3. Contratos Compartilhados (`@farmaubs/shared`) e Paridade com App Mobile

Conforme a [ADR-034](file:///c:/Users/jaohe/projetos/farmaubs/docs/adrs/adr-034-clean-architecture-fullstack.md), as definições de perfis (`PerfilCodigo`), o contexto autenticado e a matriz RBAC residem em `@farmaubs/shared`. Essa estrutura garante que as regras de autorização validadas no backend sejam exatamente as mesmas consumidas pelo aplicativo móvel (`apps/mobile` — `AC-MOB-01`, `AC-MOB-03`) e pela aplicação web (`apps/frontend` — `AC-21`).

### 3.1 Contratos no `@farmaubs/shared`

Arquivo: [`packages/shared/src/acesso/auth-context.types.ts`](file:///c:/Users/jaohe/projetos/farmaubs/packages/shared/src/acesso/auth-context.types.ts) e [`packages/shared/src/acesso/session.types.ts`](file:///c:/Users/jaohe/projetos/farmaubs/packages/shared/src/acesso/session.types.ts)

```typescript
import type { PerfilCodigo } from "./perfil.types";

export interface TenantScopeContext {
  municipioId: string;
  unidadeIds: string[];
  isGlobalAdmin: boolean;
}

export interface AuthenticatedUserPayload {
  id: string;
  email: string;
  nomeCompleto: string;
  perfilCodigo: PerfilCodigo;
  municipioId: string;
  unidadeIds: string[];
  deveTrocarSenha: boolean;
}

// Snapshot consolidado retornado pelo repositório de sessões em busca única
export interface SessionRecord {
  id: string;
  usuarioId: string;
  email: string;
  nomeCompleto: string;
  municipioId: string;
  perfilCodigo: PerfilCodigo;
  deveTrocarSenha: boolean;
  unidadeIds: string[];
  status: string;
  expiraEm: Date;
  criadoEm: Date;
}

export type SessaoUsuarioSnapshot = SessionRecord;
```

### 3.2 Decorators no NestJS (`apps/backend/src/common/decorators/` e `src/common/guards/`)

```typescript
// 1. @Public() — Isenta de autenticação e guards de autorização
export const Public = () => SetMetadata('isPublic', true);

// 2. @Roles(...perfis) — Declara perfis autorizados
export const Roles = (...perfis: PerfilCodigo[]) => SetMetadata('roles', perfis);

// 3. @TenantScoped(options?) — Declara checagem estrita de município e/ou UBS
export interface TenantScopeOptions {
  checkUbs?: boolean; // Se true, valida se a UBS da requisição está em user.unidadeIds
  paramName?: string; // Nome do parâmetro de UBS (default: 'unidadeId' ou 'ubsId')
}
export const TenantScoped = (options: TenantScopeOptions = { checkUbs: false }) =>
  SetMetadata('tenantScopeOptions', options);

// 4. @CurrentUser() — Injeta o usuário autenticado no controller
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
```

### 3.3 Migration da Stored Function no PostgreSQL (`auth_buscar_sessao_por_token`)

Migration TypeORM em `apps/backend/src/modules/acesso/infrastructure/persistence/migrations/`:

```sql
CREATE OR REPLACE FUNCTION auth_buscar_sessao_por_token(p_token_hash text)
RETURNS TABLE(
  id uuid,
  usuario_id uuid,
  email text,
  nome_completo text,
  municipio_id uuid,
  perfil_codigo text,
  deve_trocar_senha boolean,
  unidade_ids uuid[],
  status character varying,
  expira_em timestamptz,
  criado_em timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT 
    s.id,
    s.usuario_id,
    u.email,
    u.nome_completo,
    u.municipio_id,
    p.codigo AS perfil_codigo,
    u.deve_trocar_senha,
    COALESCE(array_agg(uu.unidade_id) FILTER (WHERE uu.unidade_id IS NOT NULL), '{}') AS unidade_ids,
    s.status,
    s.expira_em,
    s.criado_em
  FROM sessions s
  JOIN users u ON u.id = s.usuario_id
  JOIN perfis p ON p.id = u.perfil_id
  LEFT JOIN user_units uu ON uu.usuario_id = u.id
  WHERE s.token_hash = p_token_hash::bpchar
    AND s.expira_em > now()
    AND s.status = 'ativa'
  GROUP BY s.id, u.id, p.codigo
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION auth_buscar_sessao_por_token(text) TO farmaubs_app;
```

---

## 4. Arquitetura no Backend (`apps/backend/`) — Clean Architecture

Conforme a [ADR-034](file:///c:/Users/jaohe/projetos/farmaubs/docs/adrs/adr-034-clean-architecture-fullstack.md) e [CONTRIBUTING.md](file:///c:/Users/jaohe/projetos/farmaubs/CONTRIBUTING.md):

```text
apps/backend/src/
├── common/
│   ├── decorators/
│   │   ├── public.decorator.ts
│   │   ├── roles.decorator.ts
│   │   ├── tenant-scoped.decorator.ts
│   │   └── current-user.decorator.ts
│   ├── guards/
│   │   ├── session-auth.guard.ts         # Consome SessionRecord consolidado e popula req.user
│   │   ├── roles.guard.ts                # Validação RBAC declarativa em memória (Borda HTTP)
│   │   └── tenant-scope.guard.ts         # Validação de isolamento municipal e UBS em memória (Borda HTTP)
│   └── interceptors/
│       └── transaction.interceptor.ts    # Consome req.tenantScope para SET LOCAL farmaubs.current_tenant_id
└── modules/acesso/
    ├── domain/
    │   └── ports/
    │       └── session.repository.port.ts # Interface da porta com snapshot enriquecido
    └── infrastructure/
        └── persistence/
            └── migrations/
                └── ...CreateAuthFunctions.ts # Migration com a stored function otimizada
```

---

## 5. Critérios de Aceite Detalhados

- [ ] **Decoração `@Roles`**:
  - Quando aplicada em um controller ou rota, apenas usuários cujo `req.user.perfilCodigo` corresponda a um dos perfis listados têm acesso permitido.
  - Perfil divergente retorna imediatamente `403 Forbidden` com mensagem canônica: `Acesso negado para o perfil do usuário`.
- [ ] **Bypass do Administrador**:
  - Se `req.user.perfilCodigo === PerfilCodigo.ADMINISTRADOR`, o `TenantScopeGuard` autoriza a requisição sem exigir que o ID da UBS pertença a uma lista prévia do administrador.
- [ ] **Validação de Município (`TenantScopeGuard`)**:
  - Se a requisição contiver `municipioId` em `params`, `query` ou `body`, e for diferente de `req.user.municipioId`, a requisição é rejeitada com `403 Forbidden`.
- [ ] **Validação de UBS (`TenantScopeGuard` com `checkUbs: true`)**:
  - Se a requisição contiver `unidadeId` (ou nome customizado configurado) que **não** conste no array `req.user.unidadeIds`, retorna `403 Forbidden`.
- [ ] **Injeção de Contexto de Transação**:
  - O `TenantScopeGuard` preenche `req.tenantScope` com os dados validados da sessão.
  - O `TransactionInterceptor` recupera `req.tenantScope.municipioId` e aplica `SET LOCAL farmaubs.current_tenant_id` na conexão do banco para a execução do RLS.
- [ ] **Rotas com `@Public`**:
  - Rotas com `@Public()` pulam a execução dos guards de autorização e autenticação.
- [ ] **Migration e Stored Function `auth_buscar_sessao_por_token`**:
  - Migration aplicada atualizando a função `auth_buscar_sessao_por_token` no PostgreSQL para agregar perfil, flag `deve_trocar_senha` e o array `unidade_ids` em um único lookup, com privilégio de execução concedido para `farmaubs_app`.
- [ ] **Validação Instantânea no `AuthGuard` via `SessionRecord`**:
  - O guard de autenticação utiliza o `SessionRecord` enriquecido para injetar `req.user` e `req.tenantScope`, permitindo que `RolesGuard` e `TenantScopeGuard` realizem todas as suas validações em memória sem queries secundárias.

---

## 6. Cenários de Teste em BDD (Gherkin — ADR-030 e CONTRIBUTING.md Seção 5.2)

> **Nota de Governança de Testes:**  
> - **Camadas A e C (BDD / Cucumber.js + Chai)**: As regras de negócio e fluxos de aceitação são especificados nos arquivos `apps/backend/test/features/autorizacao.feature` e `apps/backend/test/features/step_definitions/autorizacao.steps.ts`, executados oficialmente via `moon run backend:test-bdd`.  
> - **Camada A (Unitários Jest)**: Validação isolada dos guards (`roles.guard.spec.ts` e `tenant-scope.guard.spec.ts`) via `moon run backend:test`.  
> - **Camada C (Integração Jest com Banco Real e RLS)**: A validação de RLS e queries com PostgreSQL real (`test/integration/tenant-scope.guard.integration-spec.ts` e `authorization.e2e-spec.ts`) é executada via `moon run backend:test-integration`. *(A Camada B é reservada exclusivamente a testes de migrações e integridade de schema via `moon run backend:test-schema`).*

### 6.1 Especificação Comportamental BDD (`autorizacao.feature`)

```gherkin
# language: pt
Funcionalidade: Guards de Autorização RBAC e Tenant (Camadas A e C)

  Cenário: Usuário com perfil permitido acessa a rota
    Dado que a rota está anotada com @Roles(ADMINISTRADOR)
    E o usuário na requisição possui o perfil "ADMINISTRADOR"
    Quando o RolesGuard avaliar a execução
    Então o guard deve retornar verdadeiro

  Cenário: Usuário com perfil sem permissão recebe 403
    Dado que a rota está anotada com @Roles(ADMINISTRADOR)
    E o usuário na requisição possui o perfil "FARMACEUTICO_RESPONSAVEL"
    Quando o RolesGuard avaliar a execução
    Então o guard deve lançar ForbiddenException com status 403

  Cenário: Administrador possui bypass no TenantScopeGuard
    Dado que a rota possui @TenantScoped({ checkUbs: true })
    E a requisição aponta para a UBS "ubs-de-outro-municipio"
    E o usuário autenticado possui o perfil "ADMINISTRADOR"
    Quando o TenantScopeGuard avaliar a execução
    Então o acesso deve ser autorizado com sucesso

  Cenário: Farmacêutico acessando UBS vinculada no seu município
    Dado que o Farmacêutico pertence ao município "Santos"
    E possui as UBSs ["ubs-01", "ubs-02"] vinculadas
    E a requisição acessa a rota com o parâmetro unidadeId "ubs-01"
    Quando o TenantScopeGuard avaliar a execução
    Então a requisição é autorizada
    E o req.tenantScope deve ser preenchido com município "Santos" e unidades autorizadas

  Cenário: Farmacêutico tentando acessar UBS de outro município ou não vinculada
    Dado que o Farmacêutico possui apenas a UBS "ubs-01" vinculada
    Quando ele tentar enviar requisição para a rota com parâmetro unidadeId "ubs-99"
    Então o TenantScopeGuard deve lançar ForbiddenException com status 403

  Cenário: Farmacêutico Residente tenta acessar endpoint exclusivo de Gerente (E2E)
    Dado uma requisição GET para "/api/v1/relatorios/indicadores"
    E o header Authorization contém token válido de "FARMACEUTICO_RESIDENTE"
    Quando a API processar a requisição
    Então o status HTTP de resposta deve ser 403 Forbidden
```

### 6.2 Testes de Integração com RLS e Banco Real (Camada C — `tenant-scope.guard.integration-spec.ts`)

```gherkin
  Cenário: O TenantScopeGuard alimenta o SET LOCAL da transação
    Dado um Farmacêutico autenticado com município "Santos"
    Quando o fluxo passar pelo TenantScopeGuard e acionar o interceptor de transação
    Então o comando "SET LOCAL farmaubs.current_tenant_id" deve ser executado no PostgreSQL
    E qualquer tentativa de query direta em registros de outro município deve retornar vazio por RLS

  Cenário: Lookup de sessão carrega perfil e UBSs em consulta única no banco
    Dado um usuário no banco com perfil "FARMACEUTICO_RESPONSAVEL" e 2 UBSs na tabela user_units
    E uma sessão ativa criada para esse usuário
    Quando a função auth_buscar_sessao_por_token for executada no PostgreSQL
    Então o resultado deve retornar em consulta única o perfil_codigo "FARMACEUTICO_RESPONSAVEL"
    E o array unidade_ids com as 2 UBSs vinculadas
    E o AuthGuard preenche req.user sem emitir queries adicionais
```

---

## 7. Definition of Done (DoD) com Moonrepo

1. **Backend**:
   - `RolesGuard` e `TenantScopeGuard` implementados em `apps/backend/src/common/guards/`.
   - Decorators `@Roles()`, `@TenantScoped()`, `@Public()` e `@CurrentUser()` criados e tipados com os enums do `@farmaubs/shared`.
   - Objeto `req.tenantScope` padronizado e consumido pelo interceptor de transações TypeORM para disparar `SET LOCAL farmaubs.current_tenant_id`.
   - `AuthGuard` / `SessionAuthGuard` consome o `SessionRecord` enriquecido gerando o contexto em memória.
2. **Banco de Dados / Migration**:
   - Migration TypeORM aplicada no PostgreSQL atualizando `auth_buscar_sessao_por_token` com retorno consolidado de `perfil_codigo`, `deve_trocar_senha` e `unidade_ids`.
   - `GRANT EXECUTE` concedido à role `farmaubs_app`.
3. **Segurança e Defesa em Profundidade**:
   - Garantia de que Administradores operem globalmente sem bloqueio territorial indevido.
   - Garantia de que nenhum usuário acerte endpoints fora do seu município ou de UBSs não autorizadas.
4. **Qualidade e Validação com Moonrepo**:
   - 100% de aprovação nos testes unitários dos guards (Camada A) via `moon run backend:test`.
   - Especificação viva BDD com Cucumber.js + Chai aprovada via `moon run backend:test-bdd`.
   - Testes de integração de infraestrutura e RLS com PostgreSQL real (Camada C) aprovados via `moon run backend:test-integration`.
   - Verificação de integridade de schema (Camada B) mantida via `moon run backend:test-schema`.
   - Linting e checagem de tipos estáticos sem erros (`moon run backend:lint` e `moon check --affected`).
   - Compilação global do monorepo aprovada via Moonrepo (`moon run :build`).