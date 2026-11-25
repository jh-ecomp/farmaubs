# Release 1 — Prontidão para Produção, CI/CD e Infraestrutura (NF002, NF003, NF004, NF006, NF007, NF009, NF010, NF014, NF015, RF001, RF022)

## Visão geral do épico e história de usuário

> **Como** equipe técnica e administradores responsáveis pela implantação do FarmaUBS,  
> **quero** endurecer a aplicação backend e frontend, preparar containers imutáveis de produção, automatizar a esteira de integração e entrega contínua (CI/CD) no GitHub Actions com validação de testes automatizados em etapas de promoção (*smoke*, *load* e *stress tests*), e estabelecer observabilidade básica e backup automatizado off-site,  
> **para que** o FarmaUBS possa ser implantado e operado em ambiente real na nuvem (StayCloud + Cloudflare) com segurança de nível piloto, previsibilidade, alta disponibilidade (`99,5%`), rastreabilidade e custo mínimo compatível com a fase inicial do projeto.

---

## Contexto operacional e fronteira de escopo da Release 1

Para colocar os módulos já concluídos na `main` (e acomodar continuamente a entrada dos demais módulos dos Incrementos 1 e 2) em operação real segura, o repositório ainda apresenta lacunas de engenharia de produção que impedem um *Go-Live* confiável:
1. O arquivo `infra/docker-compose.prod.yml` encontra-se vazio, `infra/docker-compose.yml` fixa `env_file: ../.env` sem parametrização e o `Dockerfile` do backend ainda executa como `root`, embarcando `devDependencies` e sem suporte a `migration:run` ou bootstrap/seed compilados sobre `dist/`.
2. Não há esteira automatizada em `.github/workflows/` aplicando os gates de testes definidos no **ADR-030** (unitários, BDD Cucumber, schema, integração com RLS/concorrência e Playwright BDD/E2E) nem publicação e promoção determinística de imagens imutáveis no `ghcr.io` (**ADR-024**).
3. A API NestJS ainda não aplica hardening básico de produção (`helmet`, `trust proxy` para cadeia multi-hop atrás de Cloudflare + Caddy + Nginx, rate limiting em `/api/v1/acesso/login`, restrição do Swagger em produção, *graceful shutdown*, validação de variáveis de ambiente no boot e dimensionamento do pool de conexões PostgreSQL).
4. O serviço de e-mail ainda utiliza apenas stub de console (`ConsoleEmailServiceAdapter` — que deve permanecer como fallback padrão seguro quando SMTP/Resend não estiver configurado), o logger não emite JSON estruturado com redação de dados sensíveis (**ADR-026 / ADR-027**), e o frontend apresenta detalhes de acabamento pendentes (`<html lang="en">`, `SMS Parnaíba/PI` fixo na sidebar, barra lateral sem responsividade para telas menores, ausência de `robots.txt` bloqueando indexação e rotas `<EmDesenvolvimento />` expostas no menu).

**Escopo negativo explícito desta Release 1:**
- Não inclui aplicativo Mobile (`apps/mobile`), tratado em trilha independente;
- Não inclui funcionalidades dos Incrementos 3 e 4 (Curva ABC avançada, Previsão de Demanda/Pedido CAF);
- Não inclui cofre externo de segredos gerenciado (mantém-se `.env` isolado por ambiente na VPS com `chmod 600` conforme **ADR-027**), nem criptografia em nível de coluna ou módulos comerciais de faturamento/assinatura.

---

## Escopo do épico

### Requisitos funcionais e não funcionais cobertos

Requisitos canônicos descritos em [farmaubs-requisitos.md](../../documento-requisitos/farmaubs-requisitos.md):

| Código | Descrição canônica | Histórias associadas |
| --- | --- | --- |
| RF001 / RF022 / RF023 | Envio de e-mails transacionais de confirmação de cadastro e alertas críticos de vencimento/ruptura | RL-03 |
| NF002 | Design Responsivo: barra lateral adaptável a tablets e resoluções menores (ex.: 1366×768 e mobile) | RL-07 |
| NF003 | Suporte ao Idioma Português (Brasil): `lang="pt-BR"`, títulos dinâmicos e fuso horário `America/Sao_Paulo` | RL-02, RL-07 |
| NF004 | Disponibilidade Mínima (99,5%): *graceful shutdown*, healthchecks, reinício automático e monitoramento externo | RL-01, RL-04, RL-05, RL-08 |
| NF006 | Backup Automático de Dados: rotina automatizada off-site com retenção mínima de 30 dias e script de restauração testável | RL-08 |
| NF007 / NF014 | Desempenho (< 2s/3s) e Escalabilidade (>= 50 usuários simultâneos): pool de conexões Postgres, compressão, cache de estáticos e suítes `k6` de Carga (*Load*) e Estresse (*Stress*) | RL-01, RL-05, RL-08 |
| NF009 / NF010 | Segurança, RBAC e Proteção de Dados (LGPD): `helmet`, rate limiting, restrição do Swagger, logs sanitizados sem PII, `robots.txt` e páginas `/privacidade` e `/termos` | RL-01, RL-04, RL-05, RL-07 |
| NF015 | Isolamento Multi-tenant (RLS): verificação automatizada obrigatória no CI a cada Pull Request | RL-06 |

### Registros de arquitetura aplicados (ADRs)

| ADR | Tema | Histórias associadas |
| --- | --- | --- |
| ADR-006 | Sessão server-side com cookie `HttpOnly` seguro (`trust proxy` + limpeza de sessões expiradas) | RL-01, RL-03 |
| ADR-009 | Expurgo periódico de relatórios temporários gerados em `storage/reports` | RL-03 |
| ADR-020 | Estratégia de backup off-site e procedimento de restauração (DR) | RL-08 |
| ADR-021 / ADR-023 | VPS genérica com Docker Compose puro, imagens imutáveis e proxy reverso de borda | RL-05 |
| ADR-024 | Pipeline de CI/CD no GitHub Actions + `ghcr.io` + promoção por *cut* (`develop` → `release/*` → `main`) | RL-06 |
| ADR-025 | Isolamento de ambientes (`farmaubs-hml` e `farmaubs-prod`) sem dados reais em QA | RL-02, RL-05, RL-06 |
| ADR-026 | Observabilidade enxuta: logs JSON sanitizados (`Pino`), `Sentry`, rotação Docker e healthcheck | RL-04, RL-05 |
| ADR-027 | Gestão de segredos via `.env` por ambiente + sanitização de logs | RL-01, RL-04 |
| ADR-030 / ADR-035 | Pirâmide de testes (Jest, Cucumber, Postgres real, Playwright) orquestrada via `moon` no CI | RL-06, RL-08 |
| ADR-032 | Acessibilidade WCAG 2.1 AA (`lang="pt-BR"`, títulos semânticos, foco e navegação responsiva) | RL-07 |

---

## Backlog do épico

### Backend e Confiabilidade

| ID | Título | Camada / Testes | Depende de | Status |
| --- | --- | --- | --- | --- |
| [RL-01](./rl-01-backend-hardening-api-validacao-env-graceful-shutdown.md) | Hardening da API NestJS: `helmet`, `trust proxy`, rate limit, validação de env com Zod, pool Postgres e *graceful shutdown* | Backend (A, C) | AC-05 | ✅ Concluída |
| [RL-02](./rl-02-backend-migrations-runtime-bootstrap-prod-timezone.md) | Migrations de runtime em `dist/`, Bootstrap de Produção, Seed sintético de QA (`seed-qa`) e fuso `America/Sao_Paulo` | Backend (B) | AC-01, DI-01, RE-01 | ✅ Concluída |
| [RL-03](./rl-03-backend-adaptador-email-transacional-limpeza-sessoes-relatorios.md) | Adaptador real de e-mail transacional (SMTP/Resend opcional com fallback `console`) e limpeza periódica de sessões e relatórios | Backend (A, B) | AC-04 | ✅ Redigida |
| [RL-04](./rl-04-backend-observabilidade-logs-pino-sanitizados-sentry.md) | Observabilidade enxuta: logs JSON estruturados com `nestjs-pino` (redação de PII/segredos), Sentry opcional e `/api/v1/health` enriquecido | Backend (A, C) | RL-01 | ✅ Redigida |

### Infraestrutura, CI/CD, Frontend e Qualidade

| ID | Título | Camada / Testes | Depende de | Status |
| --- | --- | --- | --- | --- |
| [RL-05](./rl-05-infra-dockerfiles-producao-compose-prod-proxy-borda.md) | Dockerfiles endurecidos (não-root e sem `devDependencies`), `docker-compose.prod.yml` com rotação de logs e Proxy Reverso de borda | Infra | RL-01, RL-02 | ✅ Redigida |
| [RL-06](./rl-06-ci-cd-github-actions-ghcr-deploy-hml-prod.md) | Workflows GitHub Actions: CI completo com `moon` + Postgres + Playwright e CD imutável (`ghcr.io`) com *cut* para HML e aprovação para PROD | CI/CD | RL-05 | ✅ Redigida |
| [RL-07](./rl-07-frontend-acabamento-producao-sidebar-responsiva-feature-flags.md) | Acabamento de produção no Frontend: `lang="pt-BR"`, títulos dinâmicos, `robots.txt`, Sidebar responsiva/dinâmica, Feature Flags e páginas `/privacidade` e `/termos` | Frontend (D) | AC-21 | ✅ Redigida |
| [RL-08](./rl-08-qualidade-smoke-tests-carga-k6-backup-offsite.md) | Suíte de Smoke Tests pós-deploy, testes de Carga e Estresse `k6` (Load & Stress) e scripts de backup/restore off-site (`pg_dump` → R2) | QA / Infra | RL-05, RL-06 | ✅ Redigida |
