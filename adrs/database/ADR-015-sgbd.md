# ADR-015 — SGBD

Criado por: João Henrique

## Status
🟢 Decidido e documentado — 21/07/2026

## Contexto

O documento de requisitos original (NF021) já sugeria banco de dados relacional com suporte a transações ACID, citando PostgreSQL ou equivalente. Além disso, duas decisões arquiteturais já fechadas pressupõem, implicitamente, capacidades específicas do PostgreSQL:

- O **ADR-002** apoiou o isolamento multi-tenant (município → unidade de saúde) em **Row-Level Security (RLS)** como reforço, na camada de banco de dados, da fronteira de tenant — RLS declarativo nativo é uma característica específica do PostgreSQL, sem equivalente direto em outros SGBDs relacionais amplamente usados.
- O **ADR-004** apoiou o worker do *outbox pattern* em **`LISTEN/NOTIFY`** do PostgreSQL, para reduzir a latência entre a gravação de um evento e seu processamento, sem exigir infraestrutura de mensageria externa nem polling puro.
- O **ADR-008** apoiou o controle de concorrência em operações de estoque em **`SELECT ... FOR UPDATE`**, um mecanismo padrão de bloqueio de linha bem suportado pelo PostgreSQL.

Este ADR avalia se o PostgreSQL deve ser confirmado como SGBD, ou se alguma alternativa (SQLite, MariaDB/MySQL, ou um banco NoSQL orientado a documentos) apresenta vantagem suficiente para justificar reabrir as decisões acima.

### Opções avaliadas

**A — PostgreSQL**

Vantagens: suporte nativo a Row-Level Security, preservando integralmente o reforço de isolamento de tenant definido no ADR-002. Suporte nativo a `LISTEN/NOTIFY`, preservando o mecanismo de outbox de baixa latência definido no ADR-004 sem infraestrutura adicional. Suporte robusto a transações ACID e a `SELECT ... FOR UPDATE`, conforme já utilizado no ADR-008. Explicitamente sugerido pelo NF021 do documento de requisitos original. Gratuito, open source, com custo de hospedagem compatível com a restrição de custo mínimo da fase pré-receita (ADR-001, ADR-002).

Desvantagens: nenhuma identificada como relevante neste contexto — é a opção sobre a qual os ADRs anteriores já foram desenhados.

**B — SQLite**

Vantagens: custo de infraestrutura mínimo — o banco é um arquivo, sem processo de servidor dedicado.

Desvantagens: modelo de bloqueio a nível de arquivo/banco para escrita, não bloqueio de linha, incompatível com o modelo de múltiplos municípios/unidades escrevendo no mesmo banco físico simultaneamente, conforme o roadmap B2G confirmado no ADR-001/ADR-002. Não possui RLS nativo, o que exigiria que o isolamento de tenant do ADR-002 dependesse inteiramente de disciplina de aplicação, perdendo a camada de reforço que justificou parte daquela decisão. Não possui `LISTEN/NOTIFY`, reduzindo o outbox do ADR-004 a polling puro. Adequado a aplicações embarcadas ou de usuário único, não ao backend de um produto SaaS B2G multi-tenant.

**C — MariaDB (ou MySQL)**

Vantagens: suporte ACID robusto e maduro, bem suportado por ORMs do ecossistema Node, com custo de hospedagem baixo.

Desvantagens: não possui Row-Level Security declarativo nativo equivalente ao do PostgreSQL — o isolamento de tenant do ADR-002 precisaria ser reimplementado via views parametrizadas ou inteiramente em código de aplicação, perdendo a camada de reforço de segurança que fundamentou parte daquela decisão. Não possui equivalente a `LISTEN/NOTIFY`, exigindo polling puro ou uma ferramenta externa de captura de mudanças (ex.: Debezium sobre o binlog) para reduzir a latência do outbox do ADR-004, adicionando infraestrutura sem necessidade no cenário do PostgreSQL.

**D — NoSQL orientado a documentos (ex.: MongoDB)**

Vantagens: schema flexível, boa história de escalabilidade horizontal.

Desvantagens: o domínio do FarmaUBS é fortemente relacional (medicamentos, lotes, estoque, dispensas e pedidos com integridade referencial real, exigindo junções para os indicadores de RF018/RF019), tornando a modelagem em documentos uma fonte de desnormalização manual e complexidade adicional de consistência para uma equipe majoritariamente júnior. Contraria diretamente o NF021 do documento de requisitos original, que exige banco de dados relacional com suporte a transações ACID. Não possui equivalente a RLS declarativo nem a `LISTEN/NOTIFY` no sentido utilizado pelos ADRs anteriores.

## Decisão

Confirmar **PostgreSQL** como SGBD do FarmaUBS.

A confirmação preserva integralmente as decisões já tomadas nos ADR-002 (Row-Level Security), ADR-004 (`LISTEN/NOTIFY` para o outbox pattern) e ADR-008 (`SELECT ... FOR UPDATE` para controle de concorrência), atende diretamente ao NF021 do documento de requisitos original, e mantém compatibilidade com a restrição de custo mínimo de infraestrutura estabelecida desde o ADR-001. As alternativas avaliadas exigiriam reabrir e enfraquecer decisões de segurança e de arquitetura já fechadas, sem apresentar vantagem que compense essa perda no contexto atual do produto.

## Consequências

**Positivas**
- Nenhuma decisão anterior precisa ser reaberta ou enfraquecida.
- Camada de reforço de isolamento multi-tenant (RLS) e mecanismo de outbox de baixa latência (`LISTEN/NOTIFY`) permanecem disponíveis nativamente, sem infraestrutura ou biblioteca adicional.
- Conformidade direta com o requisito não-funcional NF021 do documento de requisitos original.

**Negativas / trade-offs assumidos**
- Nenhum trade-off novo é introduzido por esta decisão — ela é uma confirmação e formalização de premissas já assumidas implicitamente pelos ADR-002, ADR-004 e ADR-008.

## Revisão

Esta decisão deve ser revisitada caso surja, no futuro, uma necessidade de escalabilidade horizontal de escrita muito além do que o PostgreSQL suporta de forma direta (cenário não projetado no horizonte de planejamento atual), ou caso uma parte específica e isolada do domínio venha a se beneficiar genuinamente de um modelo de dados não-relacional, sem que isso implique substituir o SGBD principal do sistema.

## Decisões relacionadas
- ADR-001 — Estilo de decomposição e comunicação (restrição de custo mínimo de infraestrutura)
- ADR-002 — Estratégia de multi-tenancy (Row-Level Security)
- ADR-004 — Estratégia de comunicação entre módulos internos (`LISTEN/NOTIFY` para o outbox pattern)
- ADR-008 — Consistência transacional em operações de estoque (`SELECT ... FOR UPDATE`)
- ADR-016 — Modelagem multi-tenant no banco
- ADR-017 — Estratégia de particionamento/arquivamento de histórico
