# AC-06 Logout com encerramento da sessão (RF004)

- **Épico**: Autenticação e Controle de Acesso (ADR-006)
- **Requisitos Funcionais**: RF004 (Encerrar Sessão / Logout)
- **Requisitos Não-Funcionais**: NF009 (Menor Privilégio e Segurança), NF012 (Sessão Segura e Controle de Inatividade)
- **ADRs Vinculadas**: ADR-003 (Arquitetura Hexagonal), ADR-006 (Sessão Server-Side em PostgreSQL), ADR-016 (Segurança e RLS), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes)

---

### 1. História de Usuário

> **Como** usuário autenticado do FarmaUBS (qualquer perfil),  
> **quero** que ao solicitar logout minha credencial seja revogada imediatamente no servidor,  
> **para que** o token deixe de ser válido em qualquer requisição subsequente, impedindo acessos indevidos mesmo que o token seja interceptado (RF004, NF012).

---

### 2. Regras de Negócio e Casos de Borda

1. **Revogação Efetiva no Servidor (ADR-006)**:
   - A sessão física correspondente na tabela `sessions` deve ser invalidada no PostgreSQL (`status = 'revogada'`, `revogada_em = now()`).
   - O hash do token (`token_hash = SHA-256(token)`) torna-se permanentemente inutilizável; qualquer requisição subsequente com este token deve ser rejeitada com `401 Unauthorized`.

2. **Idempotência (Resiliência Operacional)**:
   - Se o usuário solicitar logout com um token já revogado ou expirado por inatividade (NF012), o endpoint deve responder com sucesso (`204 No Content`).
   - **Anti-Enumeração / Segurança**: A resposta nunca deve expor se a sessão existia ou se já estava expirada.

3. **Isolamento de Sessões Concorrentes**:
   - O logout padrão revoga **exclusivamente a sessão associada ao token enviado no cabeçalho `Authorization`**.
   - Outras sessões ativas do mesmo usuário em outros dispositivos ou navegadores permanecem intactas.

---

### 3. Contrato da API (`@farmaubs/shared`)

#### `POST /api/v1/acesso/logout`

- **Rota Canônica**: `API_ROUTES.ACESSO.LOGOUT` (`/api/v1/acesso/logout`)
- **Cabeçalho Obrigatório**: `Authorization: Bearer <token_plain>`
- **Corpo da Requisição**: Vazio.
- **Códigos de Resposta HTTP**:
  - `204 No Content`: Sessão revogada com sucesso (ou já inexistente — idempotência).
  - `401 Unauthorized`: Cabeçalho `Authorization` ausente ou formato inválido.

---

### 4. Arquitetura e Estrutura de Pastas

Conforme o [CONTRIBUTING.md](file:///c:/Users/jaohe/projetos/farmaubs/CONTRIBUTING.md):

```text
apps/backend/src/modules/acesso/
├── api/
│   └── controllers/
│       └── acesso.controller.ts            # Endpoint POST /acesso/logout (@SkipTransaction)
├── application/
│   └── use-cases/
│       ├── logout.use-case.ts              # Regra de negócio: SHA-256 → localizar → revogar
│       └── logout.use-case.spec.ts         # Testes unitários (Camada A)
└── domain/
    └── ports/
        └── session.repository.port.ts      # ISessionRepository.revogar() (já existente)
```

> **Atenção Arquitetural**: O controller deve aplicar o decorator `@SkipTransaction()` na rota de logout, pois a revogação utiliza a procedure `auth_revogar_sessao(p_session_id)` e atua sobre uma tabela de escopo global antes/durante o término da sessão (ADR-016).

---

### 5. Critérios de Aceite Detalhados

- [x] **Revogação no Servidor**: Ao receber um token válido no header `Authorization`, o backend calcula o SHA-256, localiza a sessão ativa e invoca `ISessionRepository.revogar(session.id)`.
- [x] **Rejeição Pós-Logout**: Qualquer tentativa posterior de usar o mesmo token em endpoints autenticados (ex: `GET /api/v1/acesso/me`) retorna `401 Unauthorized`.
- [x] **Idempotência**: Se a sessão já estiver revogada ou expirada, o endpoint retorna `204 No Content`, sem lançar exceções 500 nem expor detalhes do banco.
- [x] **Isolamento de Sessões**: O logout revoga apenas a sessão do token utilizado; outras sessões do mesmo usuário em outros navegadores permanecem ativas na tabela `sessions`.

---

### 6. Cenários de Teste em BDD (Gherkin — ADR-030)

#### Camada A — Teste Unitário de Domínio (`logout.use-case.spec.ts`)
```gherkin
# language: pt
Funcionalidade: Caso de Uso de Logout (Camada A)

  Cenário: Revogação de sessão ativa com sucesso
    Dado que recebo um token de sessão válido "token-secreto-123"
    E o repositório encontra uma sessão ativa para o hash SHA-256 do token
    Quando o caso de uso de logout for executado
    Então o método revogar do repositório de sessões deve ser chamado com o ID da sessão
    E o caso de uso conclui com sucesso

  Cenário: Idempotência para sessão inexistente ou já revogada
    Dado que recebo um token cujo hash não corresponde a nenhuma sessão ativa
    Quando o caso de uso de logout for executado
    Então nenhum erro deve ser lançado
    E o método revogar não deve falhar
```

#### Camada B — Integração de Adaptador (`session-pg.repository.spec.ts`)
```gherkin
  Cenário: Revogação no banco PostgreSQL real
    Dado que existe um registro de sessão ativo na tabela "sessions"
    Quando o método revogar do SessionPgRepository for invocado com o ID da sessão
    Então a procedure "auth_revogar_sessao" deve atualizar o status para "revogada"
    E consultas subsequentes por esse token_hash não devem retornar sessão ativa
```

#### Camada C — Teste E2E da API (`acesso.e2e.spec.ts`)
```gherkin
  Cenário: Fluxo completo de logout via API
    Dado que um usuário realiza login com sucesso e obtém um Bearer token
    Quando ele enviar uma requisição POST para "/api/v1/acesso/logout" com o token
    Então a API deve responder com status 204 No Content
    Quando ele tentar acessar "/api/v1/acesso/me" usando o mesmo token
    Então a API deve responder com status 401 Unauthorized
```

---

### 7. Definition of Done (DoD) & Pré-requisitos

#### Pré-requisitos Técnicos
- [x] Tabela `sessions` com migration aplicada e procedure `auth_revogar_sessao` operante.
- [x] Interface `ISessionRepository` e classe `SessionPgRepository` disponíveis no módulo de acesso.

#### Critérios de Conclusão (DoD)
- [x] `LogoutUseCase` criado em `apps/backend/src/modules/acesso/application/use-cases/logout.use-case.ts`.
- [x] Endpoint `POST /api/v1/acesso/logout` exposto em `AcessoController` com decorator `@SkipTransaction()` e documentado no Swagger com respostas 204 e 401.
- [x] Testes unitários do caso de uso (Camada A) com cobertura de 100% das branches.
- [x] Teste de integração do `SessionPgRepository` (Camada B) e teste E2E do controller (Camada C) passando.
- [x] `pnpm build` passando em `@farmaubs/shared` e `@farmaubs/backend`.
