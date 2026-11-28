# RL-04 feat(observabilidade): Logs JSON Estruturados com Pino, Sanitização de PII, Sentry Opcional e Healthcheck Enriquecido

---

- **Épico**: Release 1 — Prontidão para Produção, CI/CD e Infraestrutura
- **Requisitos Não-Funcionais**: NF004 (Disponibilidade e detecção rápida de falhas), NF010 (LGPD — não exposição de dados pessoais em logs)
- **ADRs Vinculadas**: ADR-026 (Observabilidade — Opção A: Pino + Sentry + Uptime externo), ADR-027 (Nenhum segredo exposto em log), ADR-030 (Testes camadas A e C)

---

## 1. História de usuário

> **Como** mantenedor do FarmaUBS em produção,  
> **quero** que o backend emita logs estruturados em JSON com redação automática de campos sensíveis, capture exceções não tratadas via Sentry (quando configurado) e exponha um endpoint `/api/v1/health` confiável para monitoramento externo,  
> **para que** seja possível diagnosticar falhas rapidamente sem jamais vazar senhas, cookies, tokens, CPF ou CNS nos logs do servidor.

---

## 2. Regras de negócio e requisitos técnicos

1. **Logs Estruturados com `nestjs-pino` (`ADR-026`)**:
   - Instalar `nestjs-pino`, `pino-http` (e `pino-pretty` apenas em `devDependencies` para leitura local).
   - Em `NODE_ENV=production`, emitir JSON puro em `stdout` contendo `timestamp`, `level`, `requestId` (`x-request-id`), método HTTP, rota, `statusCode` e `responseTime`.
   - Configurar `redact` obrigatório no Pino cobrindo:
     - `req.headers.authorization`, `req.headers.cookie`, `res.headers['set-cookie']`;
     - `*.password`, `*.senha`, `*.senhaAtual`, `*.novaSenha`, `*.senhaProvisoria`, `*.cpf`, `*.cns`, `*.token`.
   - **Nunca** logar corpos inteiros de requisição/resposta em rotas de login ou cadastro de pacientes (`ADR-027`).
2. **Integração Opcional com Sentry (`SENTRY_DSN`)**:
   - Inicializar `@sentry/nestjs` apenas se `SENTRY_DSN` estiver preenchida (se vazia, sistema roda normalmente sem erro — facilitando dev/CI).
   - Configurar `environment` (`NODE_ENV` / `APP_ENV`) e hook `beforeSend` removendo `cookies`, headers `Authorization` e campos de PII (`cpf`, `cns`, `senha`) antes de enviar eventos ao Sentry.
3. **Healthcheck Enriquecido (`GET /api/v1/health`)**:
   - Preservar integralmente o contrato existente de `HealthController` / `HealthService` (`status: 'ok' | 'degraded'`, `checks.database: 'up' | 'down'` com `SELECT 1` e timeout de 2s via `TypeOrmDatabaseHealthAdapter`, retornando `503 Service Unavailable` quando `degraded`) para não quebrar o `docker-compose.yml` nem `health.e2e-spec.ts`.
   - Enriquecer a resposta com `uptime` (em segundos) junto ao `timestamp` existente (sem expor versões internas sensíveis ou stack traces).

---

## 3. Escopo de arquivos impactados

- `apps/backend/package.json` (`nestjs-pino`, `pino-http`, `@sentry/nestjs`)
- `apps/backend/src/app.module.ts` (`LoggerModule.forRootAsync`)
- `apps/backend/src/main.ts` (`bufferLogs: true`, `app.useLogger(app.get(Logger))`)
- `apps/backend/src/health/health.service.ts` e `apps/backend/src/health/health.controller.ts` (inclusão de `uptime` mantendo contrato `ok`/`degraded` + `503`)
- `.env.example` (`LOG_LEVEL`, `SENTRY_DSN`, `APP_ENV`)

---

## 4. Cenários de teste em BDD (Gherkin — camadas A e C)

```gherkin
# language: pt
Funcionalidade: Observabilidade Estruturada e Proteção de Dados Sensíveis em Logs

  Cenário: Campos sensíveis são mascarados automaticamente pelo logger Pino
    Dado que uma entrada de log contém "headers.cookie", "senha", "cpf" e "cns"
    Quando o serializador/redator de log do Pino processar o objeto
    Então todos esses campos devem ser substituídos por "[Redacted]" na saída JSON

  Cenário: Endpoint de health retorna 200 quando PostgreSQL está acessível
    Dado que o banco de dados PostgreSQL está saudável
    Quando uma requisição GET for enviada para "/api/v1/health"
    Então a resposta deve retornar status HTTP 200 com o campo "status" igual a "ok" e "uptime" numérico

  Cenário: Endpoint de health retorna 503 quando o banco está indisponível
    Dado que a conexão com o banco de dados falhou
    Quando uma requisição GET for enviada para "/api/v1/health"
    Então a resposta deve retornar status HTTP 503 com o campo "status" igual a "degraded"
```

---

## 5. Checklist de DoD e aceitação

- [x] `nestjs-pino` configurado com redação testada para `cookie`, `authorization`, `senha`, `password`, `cpf` e `cns`.
- [x] Sentry inicializado condicionalmente via `SENTRY_DSN` com sanitização no `beforeSend`.
- [x] `GET /api/v1/health` testa consulta real ao Postgres e responde `200`/`503` corretamente, mantendo compatibilidade com o `docker-compose.yml`.
