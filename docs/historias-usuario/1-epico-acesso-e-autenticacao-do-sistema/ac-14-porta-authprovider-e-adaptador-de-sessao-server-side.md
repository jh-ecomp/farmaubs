# AC-14 Porta AuthProvider e adaptador de sessão server-side (ADR-006)

- **Épico**: Acesso e Autenticação do Sistema (RF001–RF004, NF009–NF012)
- **Requisitos Funcionais**: RF002 (Autenticação e Sessão Server-Side), RF004 (Revogação em Logout), RF025 (Revogação Administrativa)
- **Requisitos Não-Funcionais**: NF009 (Menor Privilégio e Snapshot de Escopo), NF011 (Geração Segura de Tokens e Hashing SHA-256), NF012 (Expiração Deslizante e Validade de Sessão), NF015 (Isolamento Multi-tenant)
- **ADRs Vinculadas**: ADR-002 (Multi-tenancy e Escopos), ADR-003 (Arquitetura Hexagonal), ADR-006 (Sessões Server-side Stateful no PostgreSQL), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes BDD), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de Usuário

> **Como** desenvolvedor/arquiteto do FarmaUBS,  
> **quero** que todo o ciclo de vida das sessões de usuário seja encapsulado atrás de uma porta de aplicação (`ISessionRepository`) com adaptador concreto no PostgreSQL (`SessionPgRepository`),  
> **para que** as regras de autenticação e os guards de autorização consumam um snapshot completo de escopo (perfil, município e UBSs) sem recalcular dados a cada requisição, mantendo as sessões 100% revogáveis no servidor, desacopladas do mecanismo de transporte do cliente (cookie `HttpOnly` no SPA web ou Bearer Token via Keystore no app mobile) e permitindo que provedores futuros (ex.: gov.br / OAuth2) pluguem-se à mesma estrutura sem alterar a lógica de autorização (ADR-003, ADR-006, ADR-034).

---

## 2. Regras de Negócio e Casos de Borda

1. **Isolamento Hexagonal e Clean Architecture (ADR-003, ADR-034)**:
   - Os casos de uso de autenticação (`LoginUseCase`, `LogoutUseCase`, etc.) e os Guards (`SessionAuthGuard`) dependem exclusivamente da interface da porta (`ISessionRepository` / símbolo de injeção `SESSION_REPOSITORY`), nunca de clientes SQL, queries TypeORM ou do driver do PostgreSQL diretamente.

2. **Segurança Criptográfica de Tokens e Hashing (NF011)**:
   - **Geração Segura**: O token de sessão entregue ao cliente é gerado via entropia criptográfica do sistema operacional com 256 bits (`crypto.randomBytes(32).toString('hex')` — 64 caracteres hexadecimais).
   - **Armazenamento Seguro**: O banco de dados **jamais armazena o token em texto puro**. O banco armazena exclusivamente o hash unidirecional rápido SHA-256 (`token_hash = sha256(token)`).
   - Apenas o cliente (navegador/cookie HttpOnly ou Keystore/Keychain mobile) possui o token em texto puro. Se a tabela `sessions` for exposta, nenhum invasor conseguirá forjar requisições ativas.

3. **Neutralidade de Transporte (Web SPA vs App Mobile)**:
   - A porta `ISessionRepository` é agnóstica em relação a como o token trafega na rede:
     - No cliente Web SPA (`apps/frontend`), o token é transportado via Cookie seguro `HttpOnly` (`AC-29`/`AC-30`).
     - No aplicativo móvel (`apps/mobile`), o token é armazenado no Hardware Keystore/Keychain (`expo-secure-store`) e trafega no cabeçalho `Authorization: Bearer <token>` (`AC-MOB-02`).
   - O adaptador `SessionPgRepository` consome unicamente o hash SHA-256 derivado do token recebido, servindo ambos os clientes sem duplicar regras de negócio.

4. **Snapshot de Escopo Completo em Consulta Única (ADR-006, NF009)**:
   - Para que o `SessionAuthGuard`, `RolesGuard` e `TenantScopeGuard` (AC-13) operem com latência mínima e sem queries N+1, o lookup por `token_hash` na porta de sessão deve retornar imediatamente o contexto de segurança completo:
     - Identificadores: `id`, `usuarioId`, `municipioId`.
     - Perfil RBAC: `perfilCodigo: PerfilCodigo` (via `JOIN perfis`).
     - Lotação territorial: `unidadeIds: string[]` (array com os IDs das UBSs associadas ao usuário em `user_units`).
     - Flags de controle: `deveTrocarSenha: boolean`.
     - Ciclo de vida: `status: SessionStatus`, `expiraEm: Date`, `criadoEm: Date`.

5. **Expiração e Renovação Deslizante (NF012, AC-10)**:
   - Sessões são válidas enquanto `status = 'ativa'` e `expira_em > now()`.
   - `renovarAtividade`: Atualiza `ultima_atividade_em = now()` e recalcula `expira_em = now() + SESSION_TTL_MINUTES` (padrão: 60 minutos).

6. **Revogação Cirúrgica e em Massa**:
   - `revogar(sessionId)`: Revoga a sessão informada (`status = 'revogada'`, `revogada_em = now()`). Usado no Logout (AC-06, `AC-MOB-05`).
   - `revogarTodas(usuarioId)`: Revoga atomicamente todas as sessões ativas do usuário. Usado na inativação de conta e redefinição de senha provisória (AC-08/AC-23).

7. **Limpeza de Sessões Expiradas (Garbage Collector)**:
   - A porta expõe a rotina `limparSessoesExpiradas(diasRetencao = 7)` para arquivar ou deletar registros com `expira_em < now() - interval '7 days'`, impedindo o crescimento infinito da tabela `sessions`.

8. **Ponto de Extensão para Provedores Externos (ADR-006)**:
   - Provedores externos (ex.: gov.br via OpenID Connect) atuarão como adaptadores de entrada que, após validarem as credenciais federadas, chamam a porta `criarSessao` gerando a mesma sessão server-side FarmaUBS. Os guards e os recursos downstream não sofrem impacto.

---

## 3. Contratos de Domínio e Tipos

### 3.1 Tipos de Snapshot no `@farmaubs/shared`

Arquivo: [`packages/shared/src/acesso/session.types.ts`](file:///c:/Users/jaohe/projetos/farmaubs/packages/shared/src/acesso/session.types.ts)

```typescript
import type { PerfilCodigo } from "./perfil.types";

export enum SessionStatus {
  ATIVA = "ativa",
  PENDENTE_2FA = "pendente_2fa",
  REVOGADA = "revogada",
}

// Snapshot completo retornado no lookup por token para consumo dos Guards
export interface SessaoUsuarioSnapshot {
  id: string;
  usuarioId: string;
  municipioId: string;
  perfilCodigo: PerfilCodigo;
  unidadeIds: string[];
  deveTrocarSenha: boolean;
  status: SessionStatus;
  expiraEm: Date;
  criadoEm: Date;
}
```

### 3.2 Interface da Porta no Domínio (`apps/backend/`)

Arquivo: [`apps/backend/src/modules/acesso/domain/ports/session.repository.port.ts`](file:///c:/Users/jaohe/projetos/farmaubs/apps/backend/src/modules/acesso/domain/ports/session.repository.port.ts)

```typescript
import type { SessaoUsuarioSnapshot } from "@farmaubs/shared";

export interface CriarSessaoParams {
  usuarioId: string;
  expiraEm: Date;
  ipOrigem?: string | null;
  userAgent?: string | null;
}

export interface RenovarSessaoParams {
  sessionId: string;
  expiraEm: Date;
}

export interface ISessionRepository {
  criarSessao(params: CriarSessaoParams): Promise<string>;
  buscarPorTokenHash(tokenHash: string): Promise<SessaoUsuarioSnapshot | null>;
  renovarAtividade(params: RenovarSessaoParams): Promise<void>;
  revogar(sessionId: string): Promise<void>;
  revogarTodas(usuarioId: string): Promise<void>;
  limparExpiradas(diasRetencao?: number): Promise<number>;
}

export const SESSION_REPOSITORY = Symbol("ISessionRepository");
```

---

## 4. Arquitetura no Backend (`apps/backend/`) — Clean Architecture

Conforme a [ADR-034](file:///c:/Users/jaohe/projetos/farmaubs/docs/adrs/adr-034-clean-architecture-fullstack.md) e o [CONTRIBUTING.md](file:///c:/Users/jaohe/projetos/farmaubs/CONTRIBUTING.md):

```text
apps/backend/src/modules/acesso/
├── domain/
│   ├── entities/
│   │   └── session.entity.ts               # Entidade de domínio representando a sessão ativa
│   └── ports/
│       └── session.repository.port.ts      # Porta canônica ISessionRepository e símbolo SESSION_REPOSITORY
└── infrastructure/
    ├── adapters/
    │   └── session-pg.repository.ts        # Implementação concreta executando via SECURITY DEFINER no Postgres
    └── persistence/
        ├── entities/
        │   └── session.entity.ts           # Mapeamento TypeORM da tabela sessions
        └── migrations/
            ├── ...create-sessions-table.ts # DDL da tabela sessions e índices
            └── ...CreateAuthFunctions.ts   # Stored functions otimizadas (auth_buscar_sessao_por_token, etc.)
```

---

## 5. Critérios de Aceite Detalhados

- [ ] **Desacoplamento e Injeção de Dependência**:
  - `SessionPgRepository` implementa `ISessionRepository`.
  - Registrado no `AcessoModule` como Custom Provider via `useFactory` vinculando a porta `ISessionRepository` (símbolo `SESSION_REPOSITORY`) à implementação concreta `SessionPgRepository` (conforme `CONTRIBUTING.md` Seção 1.1).
- [ ] **Geração e Hashing de Token**:
  - O método `criarSessao` gera token com 32 bytes aleatórios (`crypto.randomBytes(32).toString('hex')`).
  - O valor inserido na coluna `token_hash` é rigorosamente o hash SHA-256 do token em minúsculas (64 caracteres).
- [ ] **Lookup Otimizado com Escopo Completo**:
  - `buscarPorTokenHash` realiza a busca indexada em `sessions.token_hash`.
  - Retorna `null` imediatamente se o token não existir, se o status não for `'ativa'` ou se `expira_em <= now()`.
  - Quando a sessão é válida, preenche `SessaoUsuarioSnapshot` contendo o `perfilCodigo`, `municipioId` e o array `unidadeIds` agregados a partir de `user_units`.
- [ ] **Renovação Deslizante**:
  - `renovarAtividade` atualiza `ultima_atividade_em = now()` e o novo `expira_em`.
- [ ] **Revogação Unilateral e Coletiva**:
  - `revogar(sessionId)` altera o status para `'revogada'` e preenche `revogada_em = now()`.
  - `revogarTodas(usuarioId)` comuta todas as sessões ativas do usuário para `'revogada'`.
  - Consultas subsequentes a tokens revogados retornam `null`.
- [ ] **Limpeza de Expiradas**:
  - `limparExpiradas` remove ou arquiva sessões vencidas fora do período de retenção, retornando a quantidade de registros eliminados.

---

## 6. Cenários de Teste em BDD (Gherkin — ADR-030 e CONTRIBUTING.md Seção 5.2)

> **Nota de Governança de Testes:**  
> - **Camadas A e C (BDD / Cucumber.js + Chai)**: As regras de negócio e contratos de sessão são validados via especificação viva em `apps/backend/test/features/session-repository.feature` e `apps/backend/test/features/step_definitions/session-repository.steps.ts`, executados oficialmente por `moon run backend:test-bdd`.  
> - **Camada A (Unitários Jest)**: Testes unitários puros isolados via mocks em Jest (`session-pg.repository.unit.spec.ts`) via `moon run backend:test`.  
> - **Camada C (Integração Jest com PostgreSQL Real)**: Testes de integração do repositório físico executando contra banco real (`session.integration.ts` / `session-pg.repository.spec.ts`) via `moon run backend:test-integration`. *(A Camada B é reservada exclusivamente a testes de migrações e integridade de schema via `moon run backend:test-schema`).*

### 6.1 Especificação Comportamental BDD (`session-repository.feature`)

```gherkin
# language: pt
Funcionalidade: Porta de Sessão e Snapshot de Escopo (Camadas A e C)

  Cenário: Geração de token criptográfico e persistência de hash SHA-256
    Dado que o serviço solicita a criação de sessão para o usuário "user-uuid-1"
    Quando o método criarSessao for executado
    Então um token em texto puro de 64 caracteres hexadecimais deve ser retornado
    E o adaptador deve gravar o hash SHA-256 desse token na tabela sessions
    E o token em texto puro jamais deve ser gravado no banco

  Cenário: Lookup com mock da porta retorna snapshot completo de segurança
    Dado que existe uma sessão ativa registrada
    Quando o método buscarPorTokenHash for chamado com o hash válido
    Então o snapshot retornado deve conter o perfilCodigo "FARMACEUTICO_RESPONSAVEL"
    E a lista unidadeIds com as UBSs vinculadas ao usuário
    E o status "ativa"

  Cenário: Rejeição de sessão com tempo expirado
    Dado que o token apresentado pertence a uma sessão com expira_em no passado
    Quando o método buscarPorTokenHash for executado
    Então o retorno deve ser nulo
```

### 6.2 Testes de Integração com PostgreSQL Real (Camada C — `session.integration.ts`)

```gherkin
  Cenário: Lookup por token hash extrai relações no banco real
    Dado um usuário no banco com perfil "ADMINISTRADOR" e 2 UBSs na tabela user_units
    E uma sessão ativa criada para esse usuário
    Quando a query auth_buscar_sessao_por_token for executada com o token_hash correspondente
    Então o resultado deve conter os dados da sessão
    E o perfil_codigo "ADMINISTRADOR"
    E o array de unidade_ids preenchido corretamente

  Cenário: Revogação coletiva invalida todas as sessões do usuário
    Dado um usuário que possui 3 sessões com status "ativa" no banco
    Quando o método revogarTodas for executado para o ID desse usuário
    Então as 3 sessões devem estar com status "revogada"
    E o campo revogada_em deve estar preenchido em todas elas
```

---

## 7. Definition of Done (DoD) com Moonrepo

1. **Backend**:
   - Porta `ISessionRepository` atualizada em `session.repository.port.ts` contendo `criarSessao`, `buscarPorTokenHash`, `renovarAtividade`, `revogar`, `revogarTodas` e `limparExpiradas`.
   - `SessionPgRepository` implementando todos os métodos com SQL seguro (`SECURITY DEFINER` nas stored procedures).
   - Injeção configurada no `AcessoModule` via Custom Provider (`useFactory`) vinculando a porta `ISessionRepository` à implementação concreta.
   - Snapshot `SessaoUsuarioSnapshot` integrado a `packages/shared/src/acesso/session.types.ts`.
2. **Segurança e Criptografia**:
   - Hashing SHA-256 garantido sem persistência de texto puro.
   - Entropia de 32 bytes via `crypto.randomBytes`.
3. **Qualidade e Validação com Moonrepo**:
   - 100% dos testes unitários da Camada A (`*.unit.spec.ts`) passando com sucesso via `moon run backend:test`.
   - Especificação viva BDD com Cucumber.js + Chai aprovada via `moon run backend:test-bdd`.
   - Testes de integração com PostgreSQL real (Camada C — `session.integration.ts`) aprovados via `moon run backend:test-integration`.
   - Validação de compilação sem erros no backend (`moon run backend:build`) e no monorepo (`moon run :build`).
   - Linting e checagem de tipos estáticos sem erros (`moon run backend:lint` e `moon check --affected`).