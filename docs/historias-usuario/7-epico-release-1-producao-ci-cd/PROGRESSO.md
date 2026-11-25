# Progresso — Épico 7: Release 1 (Prontidão para Produção, CI/CD e Infraestrutura)

Última atualização: 19/11/2026

## Resumo Executivo

| Métrica | Valor |
| --- | --- |
| **Total de Histórias Mapeadas** | 8 |
| **Entregues** | 0 (0%) |
| **Em Andamento** | 0 (0%) |
| **Pendentes** | 8 (100%) |

```
Progresso: [░░░░░░░░░░░░░░░░░░░░] 0% (0/8 concluídas)
```

---

## Histórias do Épico 7 (Release 1 — Entrega em Produção)

| Código | Camada | Título | Especificação | Status Redação | Status Implementação |
| --- | --- | --- | --- | --- | --- |
| **RL-01** | Backend | Hardening da API NestJS: `helmet`, `trust proxy`, rate limit, validação de env com Zod, pool Postgres e *graceful shutdown* | [rl-01-backend-hardening-api-validacao-env-graceful-shutdown.md](./rl-01-backend-hardening-api-validacao-env-graceful-shutdown.md) | ✅ Redigida | ⏳ Não iniciada |
| **RL-02** | Backend | Migrations de runtime em `dist/`, Bootstrap de Produção, Seed sintético de QA (`seed-qa`) e fuso `America/Sao_Paulo` | [rl-02-backend-migrations-runtime-bootstrap-prod-timezone.md](./rl-02-backend-migrations-runtime-bootstrap-prod-timezone.md) | ✅ Redigida | ⏳ Não iniciada |
| **RL-03** | Backend | Adaptador real de e-mail transacional (SMTP/Resend com timeout) e limpeza periódica de sessões expiradas e relatórios antigos | [rl-03-backend-adaptador-email-transacional-limpeza-sessoes-relatorios.md](./rl-03-backend-adaptador-email-transacional-limpeza-sessoes-relatorios.md) | ✅ Redigida | ⏳ Não iniciada |
| **RL-04** | Backend | Observabilidade enxuta: logs JSON sanitizados com `nestjs-pino`, Sentry opcional e `/api/v1/health` enriquecido | [rl-04-backend-observabilidade-logs-pino-sanitizados-sentry.md](./rl-04-backend-observabilidade-logs-pino-sanitizados-sentry.md) | ✅ Redigida | ⏳ Não iniciada |
| **RL-05** | Infra | Dockerfiles endurecidos (não-root e sem `devDependencies`), `docker-compose.prod.yml` e Proxy Reverso de borda | [rl-05-infra-dockerfiles-producao-compose-prod-proxy-borda.md](./rl-05-infra-dockerfiles-producao-compose-prod-proxy-borda.md) | ✅ Redigida | ⏳ Não iniciada |
| **RL-06** | CI/CD | Workflows GitHub Actions: CI completo com `moon` + Postgres + Playwright e CD imutável (`ghcr.io`) para HML e PROD | [rl-06-ci-cd-github-actions-ghcr-deploy-hml-prod.md](./rl-06-ci-cd-github-actions-ghcr-deploy-hml-prod.md) | ✅ Redigida | ⏳ Não iniciada |
| **RL-07** | Frontend | Acabamento de produção: `lang="pt-BR"`, títulos dinâmicos, `robots.txt`, Sidebar responsiva/dinâmica, Feature Flags e `/privacidade` + `/termos` | [rl-07-frontend-acabamento-producao-sidebar-responsiva-feature-flags.md](./rl-07-frontend-acabamento-producao-sidebar-responsiva-feature-flags.md) | ✅ Redigida | ⏳ Não iniciada |
| **RL-08** | QA / Infra | Suíte de Smoke Tests pós-deploy, testes de Carga e Estresse `k6` (Load & Stress) e scripts de backup/restore off-site (`pg_dump` → R2) | [rl-08-qualidade-smoke-tests-carga-k6-backup-offsite.md](./rl-08-qualidade-smoke-tests-carga-k6-backup-offsite.md) | ✅ Redigida | ⏳ Não iniciada |
