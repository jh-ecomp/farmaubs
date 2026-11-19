# RL-01 feat(infra/backend): Hardening da API NestJS, Validação de Ambiente, Pool PostgreSQL e Graceful Shutdown

---

- **Épico**: Release 1 — Prontidão para Produção, CI/CD e Infraestrutura
- **Requisitos Não-Funcionais**: NF004 (Disponibilidade 99,5%), NF007 (Tempo de resposta < 2s), NF009/NF010 (Segurança HTTP e Proteção de Dados), NF014 (Suporte >= 50 usuários simultâneos)
- **ADRs Vinculadas**: ADR-005 (NestJS), ADR-006 (Cookie `HttpOnly`/`Secure`), ADR-015 (PostgreSQL), ADR-027 (Gestão de configuração e segredos), ADR-030 (Testes camadas A e C)

---

## 1. História de usuário

> **Como** administrador de infraestrutura do FarmaUBS,  
> **quero** que a API NestJS valide suas variáveis de ambiente no boot, aplique cabeçalhos de segurança HTTP (`helmet`), reconheça corretamente o proxy reverso (`trust proxy`), limite requisições abusivas (*rate limiting*), desabilite o Swagger em produção, dimensione o pool de conexões do PostgreSQL e encerre conexões graciosamente ao receber `SIGTERM`,  
> **para que** o backend suporte o tráfego de produção atrás da Cloudflare e do proxy reverso sem vazar documentação interna, sem perder transações ACID de estoque durante deploys e sem subir com configurações inválidas.

---

## 2. Regras de negócio e requisitos técnicos

1. **Validação *fail-fast* de variáveis de ambiente (`ConfigModule`)**:
   - Utilizar `zod` na função `validate` do `ConfigModule.forRoot` em `apps/backend/src/app.module.ts`.
   - Em `NODE_ENV=production`, a aplicação deve **recusar iniciar** (lançando erro claro e encerrando o processo) caso faltem ou estejam vazias variáveis críticas: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `POSTGRES_DB`, `CORS_ORIGIN`.
   - Em `NODE_ENV=production`, definir `ignoreEnvFile: true` quando variáveis já forem injetadas pelo container (`docker compose env_file`), mantendo a leitura de `../../.env` apenas em desenvolvimento/teste local.
2. **Trust Proxy e CORS Multi-Origem (`apps/backend/src/app.setup.ts`)**:
   - Configurar `app.getHttpAdapter().getInstance().set('trust proxy', 1)` para que `req.ip` reflita o IP real do cliente encaminhado pelo proxy reverso/Cloudflare (essencial para `log_auditoria` e *rate limiting*) e cookies `Secure` funcionem corretamente atrás de terminação TLS.
   - Alterar `CORS_ORIGIN` para aceitar lista de origens separadas por vírgula (ex.: `https://app.farmaubs.com.br,https://hml.farmaubs.com.br`), rejeitando origens não autorizadas.
3. **Hardening HTTP e Restrição do Swagger**:
   - Aplicar middleware `helmet()` com configuração compatível com API REST JSON.
   - Habilitar o Swagger (`/api/v1/docs`) **somente** quando `NODE_ENV !== 'production'` ou quando `SWAGGER_ENABLED === 'true'` estiver explicitamente definido.
4. **Rate Limiting em Camada de Aplicação (`@nestjs/throttler`)**:
   - Configurar limite global razoável (ex.: 120 req/min por IP) e limite restrito na rota `POST /api/v1/auth/login` (ex.: 10 req/min por IP), atuando em defesa em profundidade junto à Cloudflare e ao bloqueio de 5 tentativas (`RF002`).
5. **Graceful Shutdown e Pool de Conexões PostgreSQL**:
   - Chamar `app.enableShutdownHooks()` em `apps/backend/src/main.ts` para aguardar requisições e transações em curso finalizarem antes de fechar conexões no `SIGTERM`/`SIGINT`.
   - Configurar pool do driver `pg` no `TypeOrmModule.forRootAsync`: `extra: { max: Number(config.get('DB_POOL_MAX', 25)), idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 }`, suportando >= 50 usuários simultâneos (`NF014`) sem esgotar o limite padrão de 10 conexões.

---

## 3. Escopo de arquivos impactados

- `apps/backend/package.json` (adicionar `helmet`, `@nestjs/throttler`, `zod` se necessário)
- `apps/backend/src/main.ts` (`enableShutdownHooks()`)
- `apps/backend/src/app.setup.ts` (`trust proxy`, `helmet`, CORS multi-origem, Swagger condicional)
- `apps/backend/src/app.module.ts` (`ConfigModule` com validação Zod, `ThrottlerModule`, pool `extra` no TypeORM)
- `apps/backend/src/config/env.validation.ts` (novo arquivo com schema Zod)
- `.env.example` (documentar `CORS_ORIGIN`, `SWAGGER_ENABLED`, `DB_POOL_MAX` e remover/documentar status de `SESSION_SECRET`)

---

## 4. Cenários de teste em BDD (Gherkin — camadas A e C)

```gherkin
# language: pt
Funcionalidade: Hardening e Validação de Inicialização da API em Produção

  Cenário: Impedir inicialização em produção quando variável obrigatória estiver ausente
    Dado que "NODE_ENV" é "production" e "DB_PASSWORD" está vazio
    Quando a validação de variáveis de ambiente for executada no boot
    Então a aplicação deve lançar erro de validação indicando o campo "DB_PASSWORD"

  Cenário: Swagger indisponível por padrão em produção
    Dado que a aplicação foi inicializada com "NODE_ENV=production" e sem "SWAGGER_ENABLED=true"
    Quando uma requisição GET for feita para "/api/v1/docs"
    Então a API deve responder com status HTTP 404

  Cenário: Cabeçalhos de segurança Helmet presentes nas respostas da API
    Dado que a API está em execução
    Quando uma requisição GET for feita para "/api/v1/health"
    Então a resposta deve conter os cabeçalhos "x-content-type-options: nosniff" e "x-frame-options"

  Cenário: Limite de requisições bloqueia excesso de chamadas no endpoint de login
    Dado que um mesmo IP realiza 11 requisições consecutivas em menos de 1 minuto para "POST /api/v1/auth/login"
    Então a 11ª requisição deve retornar status HTTP 429 (Too Many Requests)
```

---

## 5. Checklist de DoD e aceitação

- [ ] Schema Zod de validação de ambiente implementado e coberto por testes unitários (Camada A).
- [ ] `helmet`, `trust proxy`, CORS multi-origem, Swagger condicional e `enableShutdownHooks()` configurados.
- [ ] `@nestjs/throttler` ativo e verificado sem quebrar suítes E2E existentes (desabilitável ou limite ajustado em `NODE_ENV=test`).
- [ ] Pool do PostgreSQL parametrizável via `DB_POOL_MAX` (padrão `25`).
- [ ] `.env.example` atualizado refletindo exatamente todas as variáveis utilizadas pela aplicação.
