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

1. **Workflow de Integração Contínua (`.github/workflows/ci.yml`)**:
   - Disparado em `pull_request` para `develop` e `main`, e em `push` para `develop`.
   - **Job 1 — Qualidade Estática & Unitários:** Instala `pnpm` + cache, executa via `moon` (`--affected` em PRs) `lint`, `typecheck`, `build` (`shared`, `backend`, `frontend`) e testes unitários (`backend:test`, `frontend:test`).
   - **Job 2 — Integração, Schema e BDD Backend:** Sobe *Service Container* `postgres:18-alpine`, executa `01-create-role-farmaubs-app.sh`, aplica migrations e executa `test:schema`, `test:integration` (incluindo o **teste obrigatório de RLS** e bloqueio `SELECT ... FOR UPDATE`) e `test:bdd` (Cucumber).
   - **Job 3 — Sistema de Frontend e E2E Full-Stack (Playwright):** Instala Chromium headless (`playwright install --with-deps chromium`), executa `frontend:test-bdd` e, quando houver alteração relevante, sobe `postgres` + `api` + `frontend` com seed sintético para rodar `frontend:test-e2e`, fazendo upload de `playwright-report/` e traces como *artifacts* em caso de falha.
2. **Workflow de Entrega Contínua (`.github/workflows/cd.yml`)**:
   - **Estágio 1 — Cut para QA/HML (`push` em branch `release/*` ou disparo manual `workflow_dispatch`):**
     - Faz build multi-stage das imagens `ghcr.io/<owner>/farmaubs-api:<tag>` e `ghcr.io/<owner>/farmaubs-frontend:<tag>` (tagueadas com o SHA/versão, ex.: `v1.0.0-rc.1`).
     - Conecta via SSH na VPS (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` em GitHub Secrets), faz `docker compose -p farmaubs-hml pull`, aplica `migration:run:prod` no banco de HML e sobe a stack `farmaubs-hml`.
     - Executa o script de *Smoke Tests* (`RL-08`) contra `https://hml.<dominio>`.
   - **Estágio 2 — Promoção para Produção (`push` de tag `v*.*.*` na `main` ou `workflow_dispatch` com tag já validada):**
     - Vinculado ao **GitHub Environment `production`** com regra de **aprovação manual obrigatória** (*Required Reviewers*).
     - **Não recompila o código:** reutiliza a exata imagem imutável já validada em QA (re-tagueando ou referenciando o mesmo digest/tag).
     - Conecta via SSH na VPS, executa backup pré-deploy rápido, roda `migration:run:prod` no banco de produção, atualiza a stack `farmaubs-prod` e valida `GET /api/v1/health` (com instrução/rotina simples de rollback para a tag anterior em caso de falha).

---

## 3. Escopo de arquivos impactados

- `.github/workflows/ci.yml` (novo)
- `.github/workflows/cd.yml` (novo)
- `.moon/workspace.yml` / `moon.yml` (garantir aderência dos nomes de tasks chamadas pelo CI, se necessário)

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

- [ ] `.github/workflows/ci.yml` validado em um Pull Request real com todos os jobs verdes (Unit, Integração/RLS/Cucumber e Playwright).
- [ ] Upload automático de artifacts do Playwright configurado em caso de falha (`if: failure()`).
- [ ] `.github/workflows/cd.yml` gera e publica imagens no `ghcr.io`, realiza deploy em `farmaubs-hml` e exige aprovação manual para `farmaubs-prod`.
- [ ] Lista de Secrets necessários no GitHub documentada no cabeçalho do workflow (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `HML_URL`, `PROD_URL`).
