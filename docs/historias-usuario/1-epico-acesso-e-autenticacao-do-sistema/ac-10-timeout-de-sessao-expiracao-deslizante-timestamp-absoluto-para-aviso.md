# AC-10 Timeout de sessão: expiração deslizante + timestamp absoluto para aviso (NF012)

- **Épico**: Acesso e Autenticação do Sistema (RF001–RF004, NF009–NF012)
- **Requisitos Funcionais**: RF002 (Autenticação e Sessão), RF004 (Encerramento de Sessão)
- **Requisitos Não-Funcionais**: NF009 (Menor Privilégio), NF012 (Sessão Segura: TTL de 60 min)
- **ADRs Vinculadas**: ADR-003 (Arquitetura Hexagonal), ADR-006 (Sessão Server-Side em PostgreSQL), ADR-016 (Transações e RLS), ADR-022 (`@farmaubs/shared`), ADR-027 (Variáveis de Ambiente), ADR-030 (Pirâmide de Testes)

---

## 1. História de Usuário

> **Como** servidor da API do FarmaUBS,  
> **quero** validar ativamente o token de sessão a cada requisição, renovando o tempo de vida da sessão (*sliding expiration*) caso ela esteja ativa e rejeitando-a caso tenha excedido 60 minutos de inatividade,  
> **para que** o acesso seja mantido durante o uso contínuo e revogado de forma estrita em caso de abandono de terminal (NF012, NF009).

---

## 2. Regras de Negócio e Casos de Borda

1. **Validação Contínua de Sessão (`SessionAuthGuard`)**:
   - Cada requisição a rotas protegidas deve conter o cabeçalho `Authorization: Bearer <token>`.
   - O backend extrai o token, gera o hash SHA-256 (`token_hash`) e busca a sessão na tabela `sessions` utilizando a procedure `auth_buscar_sessao_por_token(tokenHash)`.
   - Se a sessão não for encontrada, se `status !== 'ativa'` ou se `expira_em <= now()`, a requisição é rejeitada com `401 Unauthorized` (`SessaoExpiradaException`).

2. **Renovação Deslizante (*Sliding Expiration*)**:
   - Para sessões válidas, o backend recalcula:
     `expira_em = now() + SESSION_TTL_MINUTES` (padrão de 60 minutos lido de `process.env.SESSION_TTL_MINUTES`).
   - Invoca a procedure `auth_renovar_sessao(sessionId, novoExpiraEm)`.
   - **Throttling de Gravação em Banco**: Para não sobrecarregar o PostgreSQL com múltiplos `UPDATE` consecutivos em requisições paralelas do mesmo usuário, a atualização no banco só é disparada se tiverem se passado mais de 30 segundos desde a última gravação de atividade (`ultima_atividade_em`).

3. **Exposição do Cabeçalho de Expiração (`X-Session-Expires-At`)**:
   - Em todas as respostas HTTP 2xx de requisições autenticadas, o backend deve injetar o cabeçalho:
     ```http
     X-Session-Expires-At: 2026-09-13T12:52:46.000Z
     ```
   - O CORS da aplicação deve obrigatoriamente expor este cabeçalho:
     `Access-Control-Expose-Headers: Authorization, X-Session-Expires-At`.

4. **Endpoint de Renovação Explícita (`POST /api/v1/acesso/renovar`)**:
   - Disponibiliza uma rota dedicada para quando o cliente solicitar explicitamente a extensão de sessão sem precisar navegar entre telas.
   - Atualiza `expira_em` e retorna um payload com os novos valores de `expiresAt`, `ttlSeconds` e `warningSeconds`.
   - Utiliza `@SkipTransaction()` por ser uma operação de infraestrutura de sessão global.

5. **Expurgo Periódico de Sessões Mortas (Garbage Collection)**:
   - Uma tarefa agendada ou expurgo sob demanda deve remover do banco registros antigos onde `status = 'revogada'` ou `expira_em < now() - interval '24 hours'`.
   - A operação deve utilizar o índice já existente `idx_sessions_expira_em` para garantir performance sem travar a tabela.

---

## 3. Contratos de API (`@farmaubs/shared`)

### 3.1 Cabeçalho nas Respostas da API
```http
X-Session-Expires-At: 2026-09-13T12:52:46.000Z
```

### 3.2 Endpoint: `POST /api/v1/acesso/renovar`
- **Autenticação**: `Authorization: Bearer <token>`
- **Resposta 200 OK**:
```json
{
  "expiresAt": "2026-09-13T12:52:46.000Z",
  "ttlSeconds": 3600,
  "warningSeconds": 300
}
```

```typescript
// packages/shared/src/acesso/session.types.ts
export interface RenovarSessaoResponse {
  expiresAt: string;
  ttlSeconds: number;
  warningSeconds: number;
}
```

---

## 4. Arquitetura e Estrutura de Pastas (Backend)

Conforme o [CONTRIBUTING.md](file:///c:/Users/jaohe/projetos/farmaubs/CONTRIBUTING.md):

```text
apps/backend/src/
├── common/
│   ├── guards/
│   │   └── session-auth.guard.ts           # Intercepta rotas, valida token e renova no banco
│   └── interceptors/
│       └── session-header.interceptor.ts   # Injeta X-Session-Expires-At na resposta
├── modules/acesso/
│   ├── api/
│   │   └── controllers/
│   │       └── acesso.controller.ts        # Rota POST /api/v1/acesso/renovar
│   ├── application/
│   │   └── use-cases/
│   │       ├── renew-session.use-case.ts   # Caso de uso de renovação explícita
│   │       └── renew-session.steps.ts      # Testes BDD Camada A
│   └── infrastructure/
│       └── adapters/
│           └── session-pg.repository.ts    # Executa auth_renovar_sessao no PostgreSQL
└── database/
    └── tasks/
        └── purge-expired-sessions.task.ts  # Expurgo de sessões com expira_em < now() - 24h
```

---

## 5. Critérios de Aceite Detalhados (Backend)

- [x] **Guarda de Autenticação Ativo**: `SessionAuthGuard` aplicado globalmente ou nos módulos protegidos, rejeitando tokens inválidos ou expirados com `401 Unauthorized`.
- [x] **Renovação Deslizante em Banco**: Toda chamada válida atualiza `expira_em = now() + SESSION_TTL_MINUTES` via `auth_renovar_sessao`.
- [x] **Throttling de 30 Segundos**: Não executa query de UPDATE no banco se a última atualização da sessão ocorreu há menos de 30 segundos.
- [x] **Cabeçalho `X-Session-Expires-At`**: Injetado em todas as respostas HTTP de sucesso para requisições autenticadas e liberado na configuração de CORS.
- [x] **Endpoint `/acesso/renovar`**: Responde com status 200 contendo `expiresAt`, `ttlSeconds` e `warningSeconds`.
- [x] **Bloqueio Pós-Timeout**: Qualquer requisição disparada após o instante `expira_em` é bloqueada imediatamente.
- [x] **Expurgo de Sessões**: Rotina que deleta registros de sessões expiradas há mais de 24 horas sem degradação de performance.

---

## 6. Cenários de Teste em BDD (Gherkin — ADR-030)

### Camada A — Use Case e Guard (`renew-session.steps.ts`)
```gherkin
# language: pt
Funcionalidade: Renovação Deslizante e Timeout no Backend (Camada A)

  Cenário: Requisição autenticada prorroga o prazo da sessão
    Dado que existe uma sessão ativa com expira_em para daqui a 20 minutos
    Quando o SessionAuthGuard processar a requisição com o token correspondente
    Então o método renovarAtividade do repositório deve ser acionado
    E o novo expira_em deve ser postergado para 60 minutos à frente
    E a requisição prossegue com sucesso

  Cenário: Sessão expirada é barrada pelo guard
    Dado que existe uma sessão com expira_em no passado (expirada há 1 minuto)
    Quando o SessionAuthGuard interceptar a requisição
    Então deve interromper a execução e retornar status HTTP 401 Unauthorized
```

### Camada B — Integração com PostgreSQL Real (`session-pg.repository.spec.ts`)
```gherkin
  Cenário: Renovação no banco atualiza colunas corretamente
    Dado uma sessão criada na tabela "sessions"
    Quando o método renovarAtividade for chamado com um timestamp futuro
    Então a procedure "auth_renovar_sessao" deve atualizar ultima_atividade_em e expira_em
    E o status deve permanecer "ativa"
```

### Camada C — Teste E2E da API (`session-timeout.e2e.spec.ts`)
```gherkin
  Cenário: Header X-Session-Expires-At presente em resposta protegida
    Dado um usuário autenticado com token válido
    Quando ele realizar GET em "/api/v1/acesso/me"
    Então a API deve retornar 200 OK
    E o cabeçalho "X-Session-Expires-At" deve conter a nova data de expiração ISO 8601
```

---

## 7. Definition of Done (DoD - Backend)

- [ ] `SessionAuthGuard` e `SessionHeaderInterceptor` integrados ao NestJS.
- [ ] `POST /api/v1/acesso/renovar` documentado no Swagger.
- [ ] Configurações no `.env`: `SESSION_TTL_MINUTES=60` e `SESSION_WARNING_MINUTES=5`.
- [ ] 100% dos testes unitários (Camada A), integração (Camada B) e E2E (Camada C) passando.