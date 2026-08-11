# ADR-023 — Containerização e Orquestração

Criado por: João Henrique

## Status
🟢 Decidido e documentado — 23/07/2026

## Contexto

O ADR-021 já estabeleceu Docker como tecnologia de container e VPS única como topologia de hospedagem, como parte da justificativa de portabilidade da infraestrutura. O ADR-022 definiu a organização em monorepo, com backend (API NestJS) e frontend (estáticos React/Vite) como os dois artefatos deployáveis a partir do mesmo repositório.

Este ADR formaliza duas decisões que ainda restavam em aberto: **(1)** se algum orquestrador de containers é necessário além do próprio Docker, e **(2)** a estrutura de composição que serve tanto ao ambiente de desenvolvimento local da equipe quanto à produção — resolvendo, junto com esta decisão, a necessidade prática de que os quatro desenvolvedores consigam subir o ambiente completo localmente desde o primeiro dia, sem depender de suporte manual do desenvolvedor sênior a cada novo onboarding.

### Opções avaliadas para orquestração

**A — Docker Compose puro, sem orquestrador**

Vantagens: overhead operacional mínimo — um arquivo de composição e um comando para subir todo o ambiente. Coerente com a topologia de VPS única já decidida no ADR-021: orquestradores como Kubernetes ou Swarm existem para coordenar múltiplos nós, inexistentes neste cenário. Curva de aprendizado baixa para a equipe júnior, que já utilizará Compose no ambiente de desenvolvimento local, tornando o modelo mental de produção uma extensão direta do que já é familiar do dia a dia.

Desvantagens: sem auto-healing sofisticado ou rolling update automático — reinício de container em caso de falha é manual ou via script simples, não um recurso nativo do orquestrador.

**B — Docker Swarm**

Vantagens: orquestração real (rolling update, healthcheck com reinício automático), com curva de aprendizado mais baixa que Kubernetes e reaproveitamento quase direto da sintaxe do Compose.

Desvantagens: overhead ainda desproporcional para um nó único — o benefício do Swarm se realiza coordenando múltiplos nós, fora do horizonte de planejamento atual. Comunidade e ferramental ao redor do Swarm encolheram nos últimos anos frente a Kubernetes, reduzindo o suporte disponível em caso de dificuldade.

**C — Kubernetes (ou variante como K3s)**

Vantagens: orquestração completa e madura para ambientes distribuídos de múltiplos nós.

Desvantagens: overhead operacional e de aprendizado claramente desproporcional ao estágio do produto e à restrição de custo mínimo — o mesmo raciocínio que já levou à rejeição de micro-serviços no ADR-001 se aplica com ainda mais força aqui, pois Kubernetes sem múltiplos serviços a orquestrar não entrega o benefício que justificaria sua complexidade. Descartada sem ressalvas nesta fase.

## Decisão

Adotar **Docker Compose puro**, sem orquestrador adicional, com a seguinte estrutura de arquivos de composição:

- `docker-compose.yml` — configuração base, comum a todos os ambientes.
- `docker-compose.dev.yml` — overrides de desenvolvimento local: hot-reload, portas expostas para acesso direto, volumes montados a partir do código-fonte local.
- `docker-compose.prod.yml` — overrides de produção: variáveis de ambiente de produção, ausência de bind mount de código-fonte, política de reinício automático de container.

**Serviços definidos no Compose**:
- `postgres` — banco de dados definido no ADR-015.
- `api` — aplicação NestJS (backend), incluindo o worker do outbox pattern (ADR-004) executando como **processo interno ao mesmo container**, não como serviço separado. Esta escolha prioriza simplicidade operacional nesta fase, dado o volume atual de eventos assíncronos, mas é registrada como gatilho de revisão explícito (ver seção "Revisão"), coerente com a evolução futura já prevista no próprio ADR-004.
- `frontend` — em desenvolvimento, servidor de desenvolvimento do Vite; em produção, build estático servido por um Nginx simples.

**Registro de imagem**: nesta fase, sem uso de um registry de imagens externo (ex.: Docker Hub privado, GitHub Container Registry) — o build das imagens ocorre diretamente na VPS a partir do repositório, dado que existe apenas um ambiente de produção. Esta escolha é registrada como gatilho de revisão explícito, a ser reavaliada quando o pipeline de CI/CD (ADR-024, ainda não priorizado) ou múltiplos ambientes/VPS entrarem em operação.

Esta estrutura resolve, junto com a decisão de orquestração, a necessidade de setup de desenvolvimento local: os quatro desenvolvedores sobem o ambiente completo (Postgres, API e frontend) com um único comando (`docker compose -f docker-compose.yml -f docker-compose.dev.yml up`), sem depender de configuração manual assistida pelo desenvolvedor sênior a cada onboarding.

## Consequências

**Positivas**
- Overhead operacional mínimo, coerente com a topologia de VPS única e com a restrição de custo mínimo já estabelecidas no ADR-021.
- Modelo mental único de containerização compartilhado entre desenvolvimento local e produção, reduzindo a curva de aprendizado para a equipe júnior.
- Ambiente de desenvolvimento local reprodutível e de configuração simples, resolvendo diretamente a necessidade prática de onboarding autônomo da equipe.

**Negativas / trade-offs assumidos**
- Ausência de auto-healing e rolling update automático — falhas de container exigem intervenção manual ou script simples de reinício, responsabilidade operacional que recai sobre o desenvolvedor sênior, na mesma linha já assumida no ADR-021.
- O worker do outbox pattern rodando no mesmo container da API compartilha recursos com a aplicação principal — se o volume de eventos crescer significativamente, a extração para um processo/container dedicado (já prevista como possibilidade no ADR-004) precisará ser executada.
- Build de imagem diretamente na VPS, sem registry externo, significa que não há histórico versionado de imagens de build para rollback rápido — mitigável no curto prazo pelo controle de versão do próprio código-fonte no monorepo (ADR-022), mas é uma limitação real a ser resolvida quando o CI/CD for tratado formalmente.

## Revisão

Esta decisão deve ser revisitada caso:
- O volume de eventos processados pelo worker do outbox cresça a ponto de justificar sua extração para um container/processo separado, conforme já sinalizado como possibilidade no ADR-004.
- O pipeline de CI/CD (ADR-024) ou a introdução de múltiplos ambientes/VPS (ADR-025) tornem necessário o uso de um registry de imagens externo, em vez de build direto na VPS.
- A ausência de auto-healing se mostre, na prática, um problema operacional recorrente, justificando a adoção de Docker Swarm.

## Decisões relacionadas
- ADR-001 — Estilo de decomposição e comunicação (monolito modular, escala-alvo que dispensa orquestração multi-nó)
- ADR-004 — Estratégia de comunicação entre módulos internos (worker do outbox, ponto de extensão futuro já previsto)
- ADR-021 — Provedor de nuvem e topologia de hospedagem (VPS única, Docker como tecnologia de container)
- ADR-022 — Organização de repositórios (monorepo, dois artefatos deployáveis)
- ADR-024 — Pipeline de CI/CD (ainda não priorizado)
- ADR-025 — Estratégia de ambientes (ainda em discussão)
