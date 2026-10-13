# AC-29 feat(acesso): Transporte de sessão via cookie seguro (`HttpOnly`) no backend

---

- **Épico**: Autenticação e Controle de Acesso (RF001–RF004, NF009–NF012)
- **Requisitos Funcionais**: RF001 (Autenticação de Usuário), RF002 (Gestão de Sessão e Timeout), RF004 (Encerrar Sessão / Logout)
- **Requisitos Não-Funcionais**: NF009 (Menor Privilégio e Hardening), NF010 (Proteção de Dados em Trânsito e Repouso), NF011 (Autenticação Segura), NF012 (Sessão Segura e Anti-XSS)
- **ADRs Vinculadas**: ADR-003 (Arquitetura Hexagonal / Clean Architecture NestJS), ADR-005 (NestJS), ADR-006 (Sessão Server-Side em PostgreSQL), ADR-007 (Estratégia de API REST), ADR-027 (Gestão de Segredos e Configurações), ADR-030 (Pirâmide de Testes — Camadas A e C), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de Usuário

> **Como** arquiteto de segurança e desenvolvedor do FarmaUBS,  
> **quero** que o backend transmita o identificador de sessão através de um cookie HTTP com as diretivas `HttpOnly`, `SameSite=Lax` e `Secure`, e que os guards de autenticação extraiam as credenciais prioritariamente deste cookie (com suporte contínuo ao cabeçalho `Authorization: Bearer` para o aplicativo móvel e integrações),  
> **para que** o token de autenticação no navegador fique inacessível a scripts client-side (mitigando roubo de credenciais via XSS), enquanto o aplicativo mobile (`apps/mobile`) continua operando de forma nativa e segura com armazenamento em Hardware Keystore (ADR-034, `AC-MOB-02`).

---

## 2. Regras de Negócio e Casos de Borda

1. **Emissão de Cookie no Login (`POST /api/v1/acesso/login`)**:
   - Em caso de credenciais válidas, além de retornar os dados do usuário e metadados de sessão no corpo JSON, o backend **deve emitir o cabeçalho `Set-Cookie`** contendo o cookie `farmaubs_session`.
   - **Diretivas obrigatórias do cookie**:
     - `name`: `farmaubs_session`.
     - `httpOnly: true`: impede acesso via `document.cookie` no navegador.
     - `secure: true`: obrigatório em produção (`NODE_ENV === 'production'` ou protocolo HTTPS). Em desenvolvimento local HTTP, deve ser condicional para não inviabilizar testes em `localhost`.
     - `sameSite: 'lax'`: mitiga CSRF em navegação de topo enquanto permite requisições legítimas do frontend.
     - `path: '/api/v1'`: restringe o envio do cookie exclusivamente aos endpoints da API.
     - `maxAge`: calculado em milissegundos a partir de `SESSION_TTL_MINUTES * 60 * 1000`.

2. **Expurgo de Cookie no Logout (`POST /api/v1/acesso/logout`)**:
   - O backend deve invalidar a sessão no banco PostgreSQL (`status = 'revogada'`).
   - O backend **deve emitir `Set-Cookie` de expurgo** (`res.clearCookie('farmaubs_session', { path: '/api/v1' })` ou com `maxAge: 0` e `expires` no passado).

3. **Renovação Deslizante (`POST /api/v1/acesso/renovar`)**:
   - Ao renovar a sessão com sucesso, o backend deve reemitir o cookie com o novo timestamp de expiração atualizado.

4. **Resolução de Credenciais no `SessionAuthGuard` (Web SPA vs App Mobile)**:
   - O guard deve inspecionar a requisição na seguinte ordem de precedência:
     1. Cookie `req.cookies['farmaubs_session']` (utilizado pelo SPA web em `apps/frontend`).
     2. Cabeçalho `Authorization: Bearer <token>` (utilizado de forma canônica pelo aplicativo `apps/mobile` via `AC-MOB-02`, scripts de teste, Swagger e automações sem navegador).
   - Se nenhuma das origens contiver um token válido, responder com `401 Unauthorized`.

5. **Configuração de CORS e Credenciais**:
   - A configuração de CORS em `main.ts` deve definir `credentials: true`.
   - A origem permitida (`origin`) não pode ser wildcard (`*`) quando `credentials: true` está ativo; deve espelhar as origens autorizadas configuradas via `FRONTEND_URL` / `CORS_ORIGINS`.

---

## 3. Contratos de Dados e Protocolo HTTP

### Cabeçalhos de Resposta no Login (`POST /api/v1/acesso/login`)
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Set-Cookie: farmaubs_session=a1b2c3d4e5...64hex; Path=/api/v1; HttpOnly; SameSite=Lax; Max-Age=3600
X-Session-Expires-At: 2026-09-28T14:14:23.000Z
```

### Cabeçalhos de Resposta no Logout (`POST /api/v1/acesso/logout`)
```http
HTTP/1.1 204 No Content
Set-Cookie: farmaubs_session=; Path=/api/v1; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax
```

---

## 4. Escopo Técnico da Implementação — Clean Architecture

Conforme a [ADR-034](file:///c:/Users/jaohe/projetos/farmaubs/docs/adrs/adr-034-clean-architecture-fullstack.md) e o [CONTRIBUTING.md](file:///c:/Users/jaohe/projetos/farmaubs/CONTRIBUTING.md) (Seções 1.1 e 2.2):

### Backend (`apps/backend/`)
- **`package.json`**: Adicionar dependências `cookie-parser` e `@types/cookie-parser`.
- **`src/main.ts`**:
  - Registrar middleware global `app.use(cookieParser())`.
  - Ajustar configuração de CORS para suportar `credentials: true` com validação de origem segura.
- **`src/modules/acesso/api/controllers/acesso.controller.ts` (Adaptador de Entrada / Driving)**:
  - Injetar objeto `@Res({ passthrough: true }) res: Response`.
  - Definir cookie `farmaubs_session` nos métodos `login` e `renovar`.
  - Limpar cookie no método `logout`.
  - *Regra Fundamental de Clean Architecture*: Os Casos de Uso (`LoginUseCase`, `RenewSessionUseCase`, `LogoutUseCase`) em `application/use-cases/` permanecem **100% agnósticos de framework/HTTP/cookies**, manipulando exclusivamente dados puros e portas de domínio. A manipulação de cookies reside estritamente no controller HTTP.
- **`src/common/guards/session-auth.guard.ts`**:
  - Extrair o token prioritariamente via `req.cookies?.['farmaubs_session']` com fallback transparente para o header `Authorization: Bearer <token>`.
- **Testes**:
  - `acesso.controller.spec.ts` (Camada A): validar chamadas de `res.cookie` e `res.clearCookie`.
  - `session-auth.guard.spec.ts` (Camada A): validar autenticação via cookie e fallback via header.
  - `apps/backend/test/features/session-cookie.feature` + `step_definitions/session-cookie.steps.ts` (Camadas A e C — BDD): validação comportamental viva com Cucumber.js + Chai via `moon run backend:test-bdd`.
  - `acesso.e2e.spec.ts` (Camada C — Integração): asserções nos headers `set-cookie` e fluxo completo HTTP via Supertest (`moon run backend:test-integration`).

---

## 5. Cenários de Teste em BDD (Gherkin — Camadas A e C)

Conforme a [ADR-030](file:///c:/Users/jaohe/projetos/farmaubs/docs/adrs/adr-030-piramide-de-testes.md) e [CONTRIBUTING.md](file:///c:/Users/jaohe/projetos/farmaubs/CONTRIBUTING.md) (Seção 5.2):
- **Especificação Gherkin**: `apps/backend/test/features/session-cookie.feature`
- **Step Definitions**: `apps/backend/test/features/step_definitions/session-cookie.steps.ts`
- **Comando de Execução Moonrepo**: `moon run backend:test-bdd`

```gherkin
# language: pt
Funcionalidade: Transporte de Sessão via Cookie Seguro HttpOnly (AC-29)

  Cenário: Emissão bem-sucedida de cookie HttpOnly no login
    Dado que o usuário envia credenciais válidas para "POST /api/v1/acesso/login"
    Quando a requisição é processada com sucesso
    Então a resposta deve retornar status 200 OK
    E o cabeçalho "Set-Cookie" deve conter "farmaubs_session="
    E o cookie deve conter a diretiva "HttpOnly"
    E o cookie deve conter a diretiva "Path=/api/v1"
    E o cookie deve conter a diretiva "SameSite=Lax"

  Cenário: Autenticação em rota protegida utilizando apenas o cookie
    Dado que a requisição para "GET /api/v1/acesso/me" possui o cookie "farmaubs_session" com token válido
    E a requisição não possui cabeçalho "Authorization"
    Quando a requisição passa pelo SessionAuthGuard
    Então a requisição deve ser autorizada
    E o usuário autenticado deve ser injetado no contexto

  Cenário: Autenticação em rota protegida via cabeçalho Authorization (App Mobile)
    Dado que a requisição para "GET /api/v1/acesso/me" não possui cookie
    E a requisição possui cabeçalho "Authorization: Bearer <token_valido>"
    Quando a requisição passa pelo SessionAuthGuard
    Então a requisição deve ser autorizada
    E o usuário autenticado deve ser injetado no contexto

  Cenário: Rejeição de requisição sem cookie e sem cabeçalho Authorization
    Dado que a requisição para "GET /api/v1/acesso/me" não possui cookie "farmaubs_session"
    E a requisição não possui cabeçalho "Authorization"
    Quando a requisição passa pelo SessionAuthGuard
    Então a resposta deve ser 401 Unauthorized com mensagem "Token de autenticação ausente ou inválido"

  Cenário: Expurgo de cookie no logout
    Dado que o usuário possui sessão ativa informada via cookie "farmaubs_session"
    Quando o usuário executa "POST /api/v1/acesso/logout"
    Então a sessão deve ser marcada como revogada no banco de dados
    E a resposta deve retornar status 204 No Content
    E o cabeçalho "Set-Cookie" deve invalidar "farmaubs_session" com Max-Age zerado
```

---

## 6. Definition of Done (DoD) com Moonrepo

1. [x] `cookie-parser` instalado e habilitado no bootstrap do NestJS (`main.ts` / `app.setup.ts`).
2. [x] `POST /api/v1/acesso/login` emite cookie `farmaubs_session` com `HttpOnly`, `Path=/api/v1`, `SameSite=Lax` e `Secure` (em produção/HTTPS).
3. [x] `POST /api/v1/acesso/logout` remove o cookie via `Set-Cookie` com expiração no passado (`Max-Age=0`).
4. [x] `POST /api/v1/acesso/renovar` atualiza a validade do cookie em renovação deslizante.
5. [x] `SessionAuthGuard` aceita credenciais originadas de `req.cookies['farmaubs_session']` com fallback transparente para `Authorization: Bearer` (compatível com mobile `AC-MOB-02`).
6. [x] CORS devidamente configurado com `credentials: true` e origens explícitas.
7. [x] Testes unitários (Camada A) implementados e aprovados via `moon run backend:test`.
8. [x] Especificação viva BDD com Cucumber.js + Chai aprovada via `moon run backend:test-bdd`.
9. [x] Testes de integração/API (Camada C) e schema (Camada B) validados no backend.
10. [x] Build do backend finalizado sem erros (`moon run backend:build`).
11. [x] Build global do monorepo concluído com sucesso (`moon run :build`).
