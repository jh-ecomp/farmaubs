# ADR-022 — Organização de Repositórios (Monorepo)

Criado por: João Henrique

## Status
🟢 Decidido e documentado — 20/07/2026

## Contexto

Com backend (ADR-005, NestJS), frontend (ADR-011, React) e banco de dados (ADR-002, ADR-003) já decididos, é necessário definir como o código é organizado em repositório(s) antes do início do desenvolvimento — decisão anterior e independente da containerização (ADR de infraestrutura correspondente) e do pipeline de CI/CD, ambos dependentes desta.

Ponto de partida relevante: pela arquitetura hexagonal definida no ADR-003 e pela estratégia de multi-tenancy do ADR-002, o schema, as migrations e as políticas de Row-Level Security do banco de dados são parte do adaptador de repositório do backend, não um artefato com ciclo de vida ou deploy independente. Um repositório de banco de dados separado só faria sentido em um cenário de múltiplos serviços com deploys independentes compartilhando um banco — cenário de micro-serviços já descartado no ADR-001. O desenvolvedor de banco de dados, portanto, atua dentro do repositório do backend, não em um projeto à parte. A decisão real em aberto é: **backend e frontend em repositórios separados (poliato) ou em um único repositório (monorepo)**.

Fatores relevantes:
- Backend e frontend são ambos escritos em TypeScript (ADR-005, ADR-011), criando uma oportunidade real de compartilhamento de tipos (ex.: formas de DTOs de resposta da API definida no ADR-007) entre as duas pontas.
- Equipe pequena (5 pessoas) trabalhando no mesmo produto, sem necessidade organizacional de fronteiras de acesso ou de deploy independente entre times distintos.
- Perfil predominantemente júnior da equipe, favorecendo menor carga cognitiva de navegação entre repositórios para entender uma funcionalidade de ponta a ponta.
- Muitas mudanças nesta fase inicial do produto tendem a afetar simultaneamente o contrato de API e seu consumo no frontend — um cenário comum de evolução conjunta.

### Opções avaliadas

**A — Poliato (um repositório por aplicação: backend, frontend)**

Vantagens: fronteira de deploy limpa e ciclo de CI independente por padrão; modelo mental simples de uma responsabilidade por repositório.

Desvantagens: qualquer tipo compartilhado entre backend e frontend precisa ser publicado como pacote npm à parte ou duplicado manualmente em cada lado, criando risco de divergência de contrato que o OpenAPI/Swagger do ADR-007 mitiga, mas não elimina. Uma mudança que afeta contrato de API e consumo no frontend simultaneamente exige duas branches e dois PRs coordenados manualmente — atrito real para um time pequeno em fase de validação de produto. Aumenta a carga cognitiva de onboarding para desenvolvedores júnior, que precisam navegar múltiplos repositórios para entender uma funcionalidade de ponta a ponta.

**B — Monorepo (um único repositório, com backend e frontend como workspaces)**

Vantagens: um único clone e uma única fonte de verdade, reduzindo fricção de onboarding e uso diário para a equipe júnior. Permite compartilhamento real de tipos TypeScript entre backend e frontend (ex.: um pacote interno de tipos/DTOs), reduzindo divergência de contrato além do que o Swagger já cobre. Uma mudança que afeta API e consumo do frontend simultaneamente cabe em um único pull request, revisável de uma vez. Um único pipeline de CI pode ser configurado com filtro por pasta alterada, evitando execução desnecessária de testes de uma aplicação quando apenas a outra foi modificada.

Desvantagens: exige uma ferramenta de gerenciamento de workspace (ex.: pnpm workspaces, possivelmente combinada com Turborepo ou Nx), configuração inicial adicional ainda que pequena. Sem disciplina de configuração de CI por pasta alterada, o pipeline pode ficar mais lento por executar testes de ambas as aplicações a cada mudança — mitigável, mas exige atenção desde o início.

## Decisão

Adotar **monorepo**, com gerenciamento de workspaces via **pnpm workspaces**, organizado da seguinte forma:

```
/apps/backend     → NestJS (inclui migrations e schema do banco de dados)
/apps/frontend    → React + Vite
/packages/shared  → tipos e DTOs compartilhados entre backend e frontend
/infra            → docker-compose de desenvolvimento local, manifests de deploy
```

O desenvolvedor de banco de dados atua dentro de `/apps/backend`, consistente com a decisão de que o banco de dados é parte do adaptador de repositório do backend (ADR-003), não um artefato de repositório próprio.

O motivo principal da decisão não é preferência estilística: backend e frontend sendo ambos TypeScript cria uma oportunidade concreta de compartilhamento de contrato de tipos que um poliato desperdiçaria, e o tamanho e perfil da equipe atual não apresentam nenhuma necessidade genuína de isolamento entre repositórios que compense essa perda.

## Consequências

**Positivas**
- Onboarding mais simples para a equipe júnior — um único clone, uma única fonte de verdade.
- Compartilhamento de tipos entre backend e frontend reduz risco de divergência de contrato de API além do que o Swagger do ADR-007 já cobre.
- Mudanças que afetam simultaneamente API e frontend ficam contidas em um único pull request.
- Base organizacional pronta para o ADR de containerização e para o pipeline de CI/CD, ambos dependentes desta estrutura de pastas.

**Negativas / trade-offs assumidos**
- Necessidade de configurar corretamente a ferramenta de workspace (pnpm) e, eventualmente, um orquestrador de tarefas com cache (Turborepo/Nx) para evitar que o pipeline de CI execute testes desnecessários a cada mudança — responsabilidade do desenvolvedor sênior configurar isso corretamente desde o início do repositório.
- Todo o histórico de commits do produto fica concentrado em um único repositório — sem impacto prático negativo identificado para este contexto, mas registrado como característica da escolha.

## Revisão

Esta decisão deve ser revisitada caso:
- A equipe cresça a ponto de backend e frontend passarem a ser mantidos por times genuinamente distintos, com necessidade de fronteiras de acesso ou de deploy independentes entre eles.
- O monorepo cresça a um tamanho que exija ferramental de escala (ex.: build cacheado distribuído) muito além do que pnpm workspaces oferece nativamente — cenário a ser resolvido primeiro com um orquestrador de tarefas como Turborepo/Nx antes de considerar a separação em múltiplos repositórios.

## Decisões relacionadas
- ADR-001 — Estilo de decomposição e comunicação (monolito modular, ausência de necessidade de deploy independente)
- ADR-002 — Estratégia de multi-tenancy / ADR-003 — Arquitetura interna do backend (banco de dados como parte do backend, sem repositório próprio)
- ADR-005 — Linguagem e framework do backend / ADR-011 — Framework de frontend (ambos TypeScript, base do compartilhamento de tipos)
- ADR-007 — Estratégia de API (contrato compartilhado via pacote `shared`)
