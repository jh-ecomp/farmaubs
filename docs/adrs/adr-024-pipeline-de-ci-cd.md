## ADR-024 - Pipeline de CI/CD

### Status
🟢 Decidido e documentado — última atualização: 18/11/2026

### Contexto

Até o final do Incremento I, a execução de testes ocorria apenas localmente antes do push (`ADR-030`), a promoção entre homologação (`farmaubs-hml`) e produção (`farmaubs-prod`) era manual (`ADR-025`), e o build das imagens Docker era previsto diretamente na VPS sem registry externo (`ADR-023`). O `ADR-035` já organizou o monorepo (`apps/backend`, `apps/frontend`, `apps/mobile`, `packages/shared`) com `pnpm` e `moon` para suportar execução seletiva por arquivos alterados.

Com a aproximação da entrada em produção, é necessário automatizar:
1. **CI (Integração Contínua):** gate automático em Pull Requests (`lint`, `typecheck`, testes unitários, testes de integração com Postgres real validando RLS/concorrência e testes E2E/BDD Playwright).
2. **Empacotamento:** geração de artefatos/imagens imutáveis para não depender de `docker build` na VPS de produção.
3. **CD (Entrega Contínua):** promoção controlada de `develop` → **QA/Homologação** (com Smoke/Carga) → `main` → **Produção** (com aprovação humana e execução segura de migrations).

#### Opções avaliadas

**A - GitHub Actions + `ghcr.io` (GitHub Container Registry) + CD via SSH/Docker Compose na VPS**

Todo o CI roda no GitHub Actions (usando `moon` para rodar tarefas afetadas, *Service Container* de `postgres:18-alpine` para integração/RLS e Playwright headless para E2E). No merge em `develop`, o workflow faz build das imagens (`api` e `frontend`), publica no `ghcr.io` com tag do commit/versão e conecta via SSH na VPS para atualizar a stack `farmaubs-hml` e rodar *Smoke Tests*. A promoção para `farmaubs-prod` ocorre via merge/tag na `main` com *GitHub Environment Protection Rule* (aprovação manual obrigatória), reutilizando a **exata mesma imagem** já validada em QA e rodando `migration:run` antes da virada.

Vantagens:
- Custo zero adicional de infraestrutura (GitHub Actions gratuito para repositórios públicos ou 2.000 min/mês em privados + `ghcr.io` integrado).
- Mantém 100% da aderência ao `ADR-021` e `ADR-023` (Docker Compose puro na VPS, sem instalar agentes ou plataformas extras no servidor).
- Garante artefato imutável ("build once, deploy anywhere"), eliminando o risco de compilar código diferente na VPS.

Desvantagens:
- Exige manter scripts de deploy (SSH + `docker compose pull && up -d` + estratégia de rollback) dentro dos workflows do GitHub Actions.
- Requer liberar acesso SSH (restrito por chave e idealmente IP/tailscale/proxy) para o runner do GitHub Actions conseguir aplicar o deploy na VPS.

**B - GitHub Actions (CI) + `ghcr.io` + PaaS Auto-Hospedado na VPS (ex.: Dokploy ou Coolify)**

O GitHub Actions cuida apenas do **CI** (testes unitários, integração, E2E e push da imagem no `ghcr.io`). Na VPS, instala-se um gerenciador leve de deploy sobre Docker (**Dokploy** ou **Coolify**), que fornece interface web, proxy reverso integrado (Traefik + Let's Encrypt/Origin Cert), webhooks automáticos para deploy em QA/Prod, visualização de logs de container e botão de rollback em 1 clique.

Vantagens:
- Reduz drasticamente o esforço manual de configurar Nginx/Traefik, TLS, zero-downtime deploy e scripts SSH — muito amigável para equipe sem perfil dedicado de DevOps/SRE.
- Rollback visual em 1 clique e gerenciamento centralizado dos ambientes `hml` e `prod` na mesma VPS.
- Mantém portabilidade (roda sobre Docker na sua própria VPS).

Desvantagens:
- Introduz uma camada de gerenciamento adicional na VPS (consome ~300–500 MB de RAM e adiciona um componente que também precisa ser atualizado).
- Muda parcialmente a forma pura de subir o `docker-compose.prod.yml` descrita no `ADR-023` (passa a ser gerenciado pelo painel da ferramenta).

**C - GitHub Actions (CI + Build no `ghcr.io`) + Deploy *Pull-based* na VPS (sem abrir SSH externo)**

O GitHub Actions roda todos os testes e publica as imagens assinadas/tagueadas no `ghcr.io` (ex.: tag `hml` ao mergear em `develop`, tag `prod-vX.Y.Z` ao aprovar release na `main`). Na VPS, um agente leve local (ex.: **Watchtower** com filtro de labels, ou um pequeno daemon/cron local via webhook autenticado / Tailscale) puxa a nova imagem de dentro para fora e aplica o `docker compose up -d`.

Vantagens:
- Superfície de ataque menor: a VPS não precisa expor a porta SSH (22) para os IPs dinâmicos do GitHub Actions.
- Separação clara de responsabilidades entre o pipeline de build (GitHub) e o runtime (VPS).

Desvantagens:
- Coordenar `typeorm migration:run` antes de subir a nova imagem e coletar feedback/status de falha de volta para o GitHub Actions é mais trabalhoso em modelos *pull-based* simples (como Watchtower puro).
- Se o Watchtower atualizar automaticamente sem orquestração de migration, há risco de subir código novo antes da migration rodar.

### Decisão

Adotar a **Opção A — GitHub Actions + `ghcr.io` (GitHub Container Registry) + CD via SSH/Docker Compose na VPS**, com fluxo de promoção em lotes (*cut* de release para QA):

1. **Integração Contínua (CI) em Pull Requests para `develop` e `main`:**
   - Orquestrada via `moon` (`ADR-035`) com detecção de tarefas afetadas: `lint`, `typecheck`, `build`, testes unitários e BDD de domínio (Jest/Cucumber/Vitest), testes de schema, integração e E2E de API contra *Service Container* `postgres:18-alpine` (incluindo `01-create-role-farmaubs-app.sh`, teste obrigatório de RLS e `SELECT ... FOR UPDATE`), e testes de sistema/UI Playwright (`frontend:test-bdd` e `frontend:test-e2e`).
2. **Promoção por *Cut* (`develop` → `release/*` → `main`):**
   - PRs aprovados são acumulados em `develop` (mantida sempre verde pelo CI).
   - Periodicamente (ex.: fim de sprint/épico), realiza-se um **cut para QA** (branch `release/vX.Y.Z`), congelando o escopo da versão, gerando as imagens Docker imutáveis no `ghcr.io` (tag candidata `vX.Y.Z-rc` + tag numerada `vX.Y.Z-rc.<N>`) e fazendo deploy automático na stack `farmaubs-hml` na VPS (`ADR-025`).
   - Em QA executam-se automaticamente *Smoke Tests* completos (`smoke-test.mjs` cobrindo `/api/v1/health`, `/api/v1/acesso/login`, cookie `HttpOnly` e logout), validação funcional com dados sintéticos (`seed-qa.js`) e **testes de Carga (*Load*, 50 VUs) e Estresse (*Stress*, rampa até 200 VUs + recuperação)** com `k6`.
   - Após aprovação manual no *GitHub Environment* `production`, faz-se o merge para `main` + tag `vX.Y.Z`, re-tagueando no `ghcr.io` o **mesmo digest SHA256** já validado em QA (`vX.Y.Z-rc` → `vX.Y.Z`, sem recompilar mesmo que o SHA do commit de merge mude), executando backup pré-deploy, `migration:run:prod` e verificação pós-deploy *somente leitura* em `farmaubs-prod`.

### Consequências

**Positivas**
- Custo zero adicional de plataforma e aderência total ao Docker Compose puro (`ADR-023`).
- Garantia de artefato imutável ("build once, deploy anywhere") com histórico versionado no `ghcr.io` para rollback rápido (revisando a limitação anterior do `ADR-023`).
- O modelo de *cut* evita que QA seja sobrescrito no meio de uma bateria de testes por merges contínuos em `develop`.

**Negativas / trade-offs assumidos**
- Exige manter workflows de deploy via SSH e scripts de rollback/migration no repositório.
- Exige disciplina para não acumular PRs demais em `develop` sem cortar para QA (evitar *big bang* difícil de depurar).

### Revisão

Esta decisão deve ser revisitada caso:
- A gestão manual de scripts SSH e proxy reverso se torne um gargalo operacional, justificando adotar Dokploy/Coolify (Opção B) ou migrar para PaaS gerenciado.

### Decisões relacionadas
- [ADR-021](adr-021-provedor-de-nuvem-e-topologia-de-hospedagem.md) - Provedor de nuvem e topologia de hospedagem
- [ADR-022](adr-022-organizacao-de-repositorios.md) - Organização de repositórios (monorepo)
- [ADR-023](adr-023-containerizacao-e-orquestracao.md) - Containerização e orquestração (revisão sobre uso de registry externo)
- [ADR-025](adr-025-estrategia-de-ambientes.md) - Estratégia de ambientes (homologação e produção)
- [ADR-030](adr-030-estrategia-de-testes.md) - Estratégia de testes (automação do gate de qualidade)
- [ADR-035](adr-035-governanca-e-orquestracao-de-monorepo.md) - Governança de monorepo (`moon` / `pnpm` affected)
