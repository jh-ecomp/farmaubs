# RL-06 feat(ci-cd): Workflows GitHub Actions para CI Completo, Build Imutável no `ghcr.io` e CD para HML e PROD

---

- **Épico**: Release 1 — Prontidão para Produção, CI/CD e Infraestrutura
- **Requisitos Não-Funcionais**: NF004 (Deploy previsível e rollback rápido), NF015 (Gate automático de RLS), ADR-030 (Gate automatizado de qualidade)
- **ADRs Vinculadas**: ADR-022 (Monorepo), ADR-024 (Pipeline CI/CD — Opção A), ADR-025 (Promoção `develop` → `release/*` → `main`), ADR-030 (Testes A, B, C, D), ADR-035 (`moon` / `pnpm` affected)

---

## 1. História de usuário

> **Como** equipe de desenvolvimento do FarmaUBS,  
> **quero** uma esteira automatizada no GitHub Actions que bloqueie Pull Requests com falhas de lint, tipos, testes unitários, integração/RLS ou E2E Playwright, construa imagens Docker imutáveis no `ghcr.io` ao cortar uma release para QA e permita promover exatamente a mesma imagem validada para Produção mediante aprovação manual,  
> **para que** nenhuma regressão de segurança ou estoque alcance o ambiente em produção e a equipe não dependa de builds manuais nem disciplina informal antes de cada entrega.

---

## 2. Regras de negócio e requisitos técnicos

1. **Padronização das Tasks do Moonrepo e Branch Base (`.moon/` e `moon.yml`)**:
   - Adicionar a task `typecheck` em `apps/backend/moon.yml` (`tsc --noEmit`), `apps/frontend/moon.yml` (`tsc -b --noEmit`) e `packages/shared/moon.yml` (`tsc --noEmit`), alinhando com `apps/mobile/moon.yml`.
   - Configurar `.moon/workspace.yml` e o checkout com `fetch-depth: 0` no CI para que `moon run :<task> --affected` compare corretamente contra a branch alvo do PR (`develop` ou `main`).
2. **Workflow de Integração Contínua (`.github/workflows/ci.yml`)**:
   - Disparado em `pull_request` para `develop` e `main`, e em `push` para `develop`.
   - **Job 1 — Qualidade Estática & Unitários:** Instala Node 22 + `pnpm` + cache, executa via `moon` (`--affected` em PRs, completo em `push`) `lint`, `typecheck`, `build` (`shared`, `backend`, `frontend`) e testes unitários/BDD sem banco (`backend:test`, `backend:test-bdd` Cucumber de domínio, `frontend:test`).
   - **Job 2 — Schema, Integração RLS e E2E de API Backend:** Sobe *Service Container* `postgres:18-alpine`, executa `infra/db/init/01-create-role-farmaubs-app.sh` (criando a role não-dona `farmaubs_app`), roda `jest --config test/schema/jest-schema.json --runInBand` diretamente contra o Postgres do job (sem invocar `docker compose`), seguido de `test:integration` (incluindo obrigatoriamente `rls-tenant-isolation` e `autorizacao-tenant-rls` + bloqueio pessimista `SELECT ... FOR UPDATE`) e `test:e2e` (`jest-e2e.json` contra NestJS + Postgres real).
   - **Job 3 — Sistema de Frontend e Contrato E2E UI (Playwright):** Instala Chromium headless (`playwright install --with-deps chromium`) e executa `frontend:test-bdd` (`sistema-frontend`) e `frontend:test-e2e` (`e2e-fullstack` com `e2e-api-server.ts` e auditoria WCAG `@axe-core/playwright`), salvando `playwright-report/` e `test-results/` como *artifacts* em caso de falha (`if: failure()`). *(A validação fim a fim contra a stack Docker real completa ocorre no Estágio 1 do CD em HML via `smoke-test.mjs`).*
3. **Workflow de Entrega Contínua e Promoção Imutável (`.github/workflows/cd.yml`)**:
   - **Estágio 1 — Cut para QA/HML (`push` em branch `release/v*` ou `workflow_dispatch`):**
     - Extrai a versão da branch (ex.: `release/v1.0.0` → tag candidata `v1.0.0-rc` + tag imutável `v1.0.0-rc.<run_number>` + `sha-<short>`), faz build multi-stage único das imagens `ghcr.io/<owner>/farmaubs-api` e `ghcr.io/<owner>/farmaubs-frontend` e publica no `ghcr.io`.
     - Sincroniza via SCP/SSH os arquivos de infraestrutura (`infra/docker-compose.yml`, `infra/docker-compose.prod.yml`, `infra/db/init/01-create-role-farmaubs-app.sh` e `infra/scripts/`) para `/opt/farmaubs/` na VPS StayCloud (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_PORT`).
     - Autentica no `ghcr.io` na VPS (`GITHUB_TOKEN` / `GHCR_READ_TOKEN`), faz `docker compose -p farmaubs-hml pull`, executa `node ./node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js` no banco de HML, garante o seed sintético (`node dist/database/seed-qa.js` com `ALLOW_QA_SEED=true` e `APP_ENV=hml`) e atualiza `farmaubs-hml`.
     - Executa automaticamente `node infra/scripts/smoke-test.mjs` (`RL-08`) contra `HML_URL` (`https://hml.<dominio>`), falhando o workflow se qualquer checagem falhar.
   - **Estágio 2 — Promoção para Produção (`push` de tag `v*.*.*` na `main` ou `workflow_dispatch` informando a tag validada, ex.: `v1.0.0-rc`):**
     - Vinculado ao **GitHub Environment `production`** com regra de **aprovação manual obrigatória** (*Required Reviewers*).
     - **Promoção sem rebuild (resolve mudança de SHA no merge PR):** localiza no `ghcr.io` a imagem candidata já aprovada em HML (`<versao>-rc` ou tag informada) e publica a tag final `<versao>` (ex.: `v1.0.0` e `prod-latest`) apontando para o **mesmo digest SHA256** (`docker buildx imagetools create`), sem jamais rodar `docker build` novamente.
     - Conecta via SSH na VPS, sincroniza `infra/`, executa backup pré-deploy (`backup-postgres-r2.sh`), aplica migrations (`node ./node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js`) em `farmaubs-prod`, sobe a stack com a imagem `v1.0.0` e executa verificação pós-deploy **somente leitura** (`GET ${PROD_URL}/api/v1/health` e `GET ${PROD_URL}/`) — mantendo a tag anterior registrada para rollback imediato.

---

## 3. Escopo de arquivos impactados

- `.github/workflows/ci.yml` (novo)
- `.github/workflows/cd.yml` (novo)
- `.moon/workspace.yml`, `apps/backend/moon.yml`, `apps/frontend/moon.yml`, `packages/shared/moon.yml` (`typecheck` padronizado e suporte ao CI)

---

## 4. Cenários de validação técnica (BDD)

```gherkin
# language: pt
Funcionalidade: Esteira de CI/CD Automatizada no GitHub Actions

  Cenário: Pull Request com quebra em teste de integração RLS é bloqueado no CI
    Dado que um desenvolvedor abre um Pull Request para "develop" alterando o backend
    E um teste de isolamento multi-tenant (RLS) falha contra o PostgreSQL efêmero
    Quando o workflow ".github/workflows/ci.yml" concluir a execução
    Então o status check do PR deve falhar impedindo o merge

  Cenário: Promoção para produção reutiliza a mesma imagem validada em QA mediante aprovação manual
    Dado que a imagem "v1.0.0-rc.1" foi publicada no "ghcr.io" e passou nos Smoke Tests em "farmaubs-hml"
    Quando uma release "v1.0.0" for acionada para o ambiente "production"
    Então o workflow deve pausar aguardando aprovação manual no GitHub Environment
    E após aprovado deve aplicar as migrations e subir a mesma imagem em "farmaubs-prod" sem novo docker build
```

---

## 5. Checklist de DoD e aceitação

- [x] `.github/workflows/ci.yml` validado em um Pull Request real (`#339`) com todos os 3 jobs verdes (`Lint, Typecheck, Build & Unit/BDD`, `Schema, Integração RLS & API E2E (Postgres 18)` e `Playwright BDD & E2E UI (Chromium + WCAG)`).
- [x] Upload automático de artifacts do Playwright configurado em caso de falha (`if: failure()`).
- [x] `.github/workflows/cd.yml` gera e publica imagens no `ghcr.io`, realiza deploy em `farmaubs-hml` e exige aprovação manual para `farmaubs-prod`.
- [x] Lista de Secrets necessários no GitHub documentada no cabeçalho do workflow (`VPS_HOST`, `VPS_PORT`, `VPS_USER`, `VPS_SSH_KEY`, `GHCR_READ_TOKEN`, `HML_URL`, `PROD_URL`, `QA_SMOKE_EMAIL`, `QA_SMOKE_PASSWORD`).
