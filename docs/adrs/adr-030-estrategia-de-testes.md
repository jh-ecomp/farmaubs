## ADR-030 - Estratégia de testes

### Status
🟢 Decidido e documentado — última atualização: 18/11/2026

### Contexto

A arquitetura hexagonal definida no ADR-003 isola o domínio (regras de negócio) da infraestrutura, com o objetivo explícito, entre outros, de tornar o domínio testável sem dependência de banco de dados ou framework web. Este ADR formaliza a estratégia de testes que se apoia nessa separação, além de tratar pontos de risco específicos já identificados por decisões anteriores:

- Multi-tenancy via Row-Level Security (ADR-002, ADR-016) é uma política de segurança que, se falhar silenciosamente, tem consequência grave — vazamento de dados entre municípios clientes.
- Controle de concorrência em operações de estoque via bloqueio pessimista (ADR-008) e o mecanismo de outbox pattern (ADR-004) são pontos onde erros sutis de concorrência e consistência tendem a se esconder.
- O ambiente de homologação (ADR-025) já existe como destino natural de validação antes de produção.
- A equipe de desenvolvimento é majoritariamente júnior, favorecendo uma estratégia objetiva e de fácil verificação em revisão de código, em vez de um framework de testes elaborado que exija julgamento experiente para ser aplicado corretamente.

#### Camadas de teste avaliadas e adotadas

**A - Testes unitários e BDD de domínio no backend (casos de uso e regras de negócio)**

Escopo: lógica pura contida nas portas da arquitetura hexagonal — cálculo de FEFO (RF010), sugestão de pedido mensal e regras de ponto de pedido/estoque de segurança (RF015), cálculo de curva ABC (RF019), gestão de acesso, entre outras regras de negócio relevantes. Executados com mock das portas de infraestrutura (repositório, e-mail, geração de arquivo), sem banco de dados real nem framework web em execução. A facilidade de escrever esses testes é, em si, um indicador da integridade da fronteira hexagonal definida no ADR-003 — dificuldade em isolar uma regra de negócio para teste unitário é sinal de vazamento dessa fronteira. **Ferramentas:** **Jest** (testes unitários `*.spec.ts`) e **`@cucumber/cucumber`** (`*.feature` + `*.steps.ts` via `test:bdd`) para especificação executável em Gherkin (pt-BR) dos casos de uso do backend.

**B - Testes de integração de adaptadores (contra banco de dados real)**

Escopo: verificação de que o adaptador de repositório aplica corretamente o escopo de tenant definido no ADR-016, que o `SELECT ... FOR UPDATE` do ADR-008 bloqueia como esperado sob concorrência, e que o mecanismo de outbox do ADR-004 grava e processa eventos corretamente. Executados contra um PostgreSQL real, não mockado, subido via Docker Compose (ADR-023), reaproveitando a mesma stack já utilizada no ambiente de desenvolvimento local, com um banco de dados de teste efêmero.

**Teste obrigatório de RLS**: por se tratar de uma camada de segurança crítica e silenciosa (ADR-002), é obrigatório um teste de integração dedicado que tenta deliberadamente ler ou escrever dados associados a um `municipio_id` diferente do contexto de sessão ativo, verificando que a política de RLS bloqueia o acesso. Este teste não é opcional e deve acompanhar qualquer mudança em política de RLS.

**C - Testes end-to-end (e2e) via API**

Escopo: os fluxos críticos de ponta a ponta descritos no NF001 (registro de entrada, registro de dispensa, geração de pedido, consulta de dashboard), executados chamando a API NestJS real contra um banco de dados de teste, sem mock. Cobertura seletiva, não exaustiva — os requisitos funcionais classificados como Essencial no documento de requisitos original são os candidatos primários; requisitos classificados como Importante ou Desejável não exigem cobertura e2e obrigatória nesta fase.

**D - Testes de frontend e E2E de Interface (Playwright BDD)**

Escopo: os cenários em Gherkin (pt-BR) especificados nas histórias de usuário de frontend são executados diretamente em navegador Chromium real via **Playwright (`@playwright/test`) + `playwright-bdd` + `@axe-core/playwright`**, substituindo progressivamente os mocks de componente em JSDOM/Vitest nas páginas e fluxos operacionais:
1. **Modalidade 1 — Teste de Sistema de Frontend (`moon run frontend:test-bdd`)**: Executa os arquivos `.feature` da Camada D interceptando as rotas HTTP via `page.route()` com contratos tipados de `@farmaubs/shared`, validando download binário real (`.xlsx`), emulação de folha de impressão A4 (`page.emulateMedia({ media: 'print' })`), controle de relógio (`page.clock`) e auditoria de contraste/acessibilidade WCAG 2.1 AA com `@axe-core/playwright`.
2. **Modalidade 2 — Teste E2E de Contrato Full-Stack (`moon run frontend:test-e2e`)**: Executa a jornada de ponta a ponta no navegador integrando Frontend React/Vite, transporte de cookie `HttpOnly` (`farmaubs_session`) e servidor HTTP de contrato (`e2e-api-server.ts`) em local/CI — complementada em Homologação (`farmaubs-hml`) pelos *Smoke Tests* contra a stack Docker completa (NestJS + PostgreSQL + Nginx + Caddy + Cloudflare) e pelas suítes `k6` de **Carga (*Load*, 50 VUs)** e **Estresse (*Stress*, até 200 VUs)** (`RL-08`).

#### Meta de cobertura

Foi deliberadamente rejeitada uma meta percentual genérica de cobertura de código, por ser uma métrica facilmente satisfeita com testes triviais sem valor real de verificação. Em seu lugar, adota-se uma **regra de obrigatoriedade por tipo de mudança**, mais objetiva de seguir por uma equipe júnior e diretamente direcionada aos pontos de maior risco já identificados pelos ADRs anteriores.

### Decisão

Adotar as quatro camadas de teste descritas acima (unitário/BDD de domínio com Jest + Cucumber, integração de adaptadores com PostgreSQL real, e2e via API, e testes de sistema/E2E de interface com **Playwright + `playwright-bdd` + `@axe-core/playwright`** substituindo Vitest/JSDOM nas jornadas de UI), com a seguinte regra de obrigatoriedade por tipo de mudança:

1. Todo caso de uso novo no domínio (ADR-003) exige teste unitário (Jest) ou cenário BDD (Cucumber) correspondente antes do merge.
2. Toda mudança em política de Row-Level Security ou em lógica de bloqueio de concorrência de estoque (ADR-008) exige teste de integração correspondente antes do merge, sem exceção, dado o risco de segurança e de integridade de dados associado.
3. Todo requisito funcional classificado como Essencial no documento de requisitos original deve ter cobertura E2E/BDD (API e/ou Playwright) antes de ser disponibilizado em produção.

**Onde os testes são executados**: localmente pelo desenvolvedor antes do push e **automaticamente como gate obrigatório de Pull Request no GitHub Actions (`ADR-024`)**, orquestrados pelo `moon` (`ADR-035`) com PostgreSQL real em *Service Container* e Chromium headless para Playwright.

### Consequências

**Positivas**
- Estratégia de testes objetiva e de fácil verificação em revisão de código e CI, adequada ao perfil majoritariamente júnior da equipe.
- Cobertura obrigatória concentrada exatamente nos pontos de maior risco já identificados pelos ADRs anteriores (RLS, concorrência de estoque, fluxos essenciais).
- Especificação viva em Gherkin (pt-BR) compartilhada entre backend (`@cucumber/cucumber`) e frontend (`playwright-bdd`), além de auditoria automática de acessibilidade WCAG 2.1 AA (`@axe-core/playwright`).

**Negativas / trade-offs assumidos**
- Execução de Playwright E2E full-stack e testes de integração com Postgres exige maior tempo de pipeline no CI (mitigado por execução seletiva de tarefas afetadas via `moon`).
- Coexistência temporária de testes legados em Vitest/JSDOM enquanto a migração para Playwright BDD é concluída (ex.: história AC-31).

### Revisão

Esta decisão deve ser revisitada caso:
- O ADR-024 (pipeline de CI/CD) seja priorizado, momento em que a execução de testes deve ser automatizada como gate de merge, em vez de depender de disciplina manual.
- A ausência de testes e2e de UI se mostre, na prática, insuficiente à medida que a equipe de frontend cresça além de um único desenvolvedor.
- A regra de obrigatoriedade por tipo de mudança se mostre insuficiente para prevenir regressões reais observadas em produção, justificando a extensão da cobertura obrigatória a outras categorias de mudança.

### Decisões relacionadas
- [[ADR-002|Registro de Decisões de Arquitetura 1 ‐ Arquitetura de Software#adr-002---estratégia-de-multi-tenancy]] / ADR-016 - Multi-tenancy e Row-Level Security (teste de integração obrigatório)
- [[ADR-003|Registro de Decisões de Arquitetura 1 ‐ Arquitetura de Software#adr-003---arquitetura-interna-do-backend-hexagonal--ports--adapters]] - Arquitetura interna do backend (base da testabilidade do domínio)
- [[ADR-004|Registro de Decisões de Arquitetura 1 ‐ Arquitetura de Software#adr-004---estratégia-de-comunicação-entre-módulos-internos]] - Estratégia de comunicação entre módulos internos (outbox pattern, testes de integração)
- [[ADR-008|Registro de Decisões de Arquitetura 2 ‐ Backend#adr-008---consistência-transacional-em-operações-de-estoque]] - Consistência transacional em operações de estoque (teste de integração obrigatório)
- [[ADR-023|Registro de Decisões de Arquitetura 5 ‐ CI CD e Infraestrutura#adr-023---containerização-e-orquestração]] - Containerização e orquestração (banco de teste via Docker Compose)
- [[ADR-024|Registro de Decisões de Arquitetura 5 ‐ CI CD e Infraestrutura#adr-024---pipeline-de-cicd]] - Pipeline de CI/CD (ainda não priorizado; automação futura do gate de testes)
- [[ADR-025|Registro de Decisões de Arquitetura 5 ‐ CI CD e Infraestrutura#adr-025---estratégia-de-ambientes]] - Estratégia de ambientes (homologação como destino de validação e2e)