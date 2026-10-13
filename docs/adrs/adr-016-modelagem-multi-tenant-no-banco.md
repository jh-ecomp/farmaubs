## ADR-016 - Modelagem multi-tenant no banco

### Status
🟢 Decidido e documentado — última atualização: 24/07/2026

### Contexto

O ADR-002 definiu isolamento multi-tenant row-level, reforçado por Row-Level Security (RLS) do PostgreSQL, com fronteira primária em `municipio_id` e fronteira secundária em `unidade_id`. O ADR-015 confirmou PostgreSQL como SGBD, com base parcialmente no suporte nativo a RLS. Este ADR resolve três sub-decisões necessárias para transformar essas escolhas em schema de banco de dados concreto.

#### Sub-decisão A - Propagação do contexto de tenant para a política de RLS

A política de RLS precisa saber, a cada consulta, qual é o `municipio_id`/`unidade_id` da sessão atual para aplicar o filtro. Isso exige um mecanismo explícito de propagação desse contexto do código de aplicação para o banco.

**Opções avaliadas:**

- **Variável de sessão via `SET LOCAL`**: um interceptor do NestJS lê o escopo de tenant da sessão do usuário (ADR-006) e executa `SET LOCAL app.current_municipio_id = '...'` (e equivalente para `unidade_id`, quando aplicável) no início de cada transação; a política RLS compara a coluna de tenant contra `current_setting('app.current_municipio_id')`. Vantagens: padrão idiomático de RLS em PostgreSQL, bem documentado; `SET LOCAL` é escopado à transação, seguro mesmo com connection pooling, pois não vaza para a próxima transação que reutilizar a mesma conexão; ponto único de aplicação (o interceptor), facilmente auditável em revisão de código; comportamento fail-closed — na ausência do contexto de sessão, a política RLS bloqueia o acesso por padrão. Desvantagem: exige disciplina de garantir que todo acesso a dados passe pelo interceptor; scripts administrativos ad-hoc fora desse fluxo precisam de tratamento explícito.
- **Papel (role) de banco por município**: descartada por reintroduzir na prática a lógica de schema-per-tenant/database-per-tenant já rejeitada por custo e overhead operacional no ADR-002.
- **RLS comparando apenas contra parâmetro passado em cada query, sem contexto de sessão no banco**: descartada por não constituir RLS de fato, apenas um filtro de aplicação disfarçado, perdendo a característica de segunda camada de defesa independente da aplicação que fundamentou a escolha de RLS no ADR-002.

**Decisão**: adotar variável de sessão via `SET LOCAL`, propagada por um interceptor centralizado no backend, aplicado a toda transação antes de qualquer consulta a tabelas com política de RLS.

#### Sub-decisão B - Estrutura de chave para tabelas multi-tenant

**Opções avaliadas:**

- **Chave primária simples (`id UUID`) com `municipio_id` como coluna comum, RLS como única barreira de isolamento**: vantagem — schema simples, joins convencionais, baixa curva de aprendizado. Desvantagem — em caso de falha de RLS por erro de configuração, nada na estrutura do schema impede, por si só, um join cruzando tenants.
- **Chave composta (`municipio_id`, `id`) como chave primária, com chaves estrangeiras também compostas incluindo `municipio_id`**: vantagem — defesa em profundidade adicional, tornando estruturalmente impossível um join cruzar `municipio_id`s diferentes, independentemente do estado do RLS. Desvantagem — aumenta significativamente a complexidade de todo o schema; toda chave estrangeira, todo índice e toda consulta precisam carregar `municipio_id` explicitamente, gerando atrito real no dia a dia de uma equipe majoritariamente júnior, sem contrapartida clara diante de um RLS já adotado especificamente para não depender de disciplina manual.

**Decisão**: adotar chave primária simples (`id UUID`) com `municipio_id` (e `unidade_id`, quando aplicável) como colunas de escopo indexadas, sem chave composta. O RLS definido na sub-decisão A é o mecanismo primário de isolamento; chaves compostas seriam redundância de complexidade desproporcional ao nível de risco real do produto nesta fase.

#### Sub-decisão C - Catálogo de medicamentos: compartilhado ou por tenant

O NF016 exige suporte à nomenclatura da RENAME (Relação Nacional de Medicamentos Essenciais, comum a todos os municípios) com possibilidade de personalização para a REMUME (Relação Municipal de Medicamentos Essenciais, específica de cada cliente).

**Opções avaliadas:**

- **Catálogo em duas camadas**: uma tabela de referência nacional (RENAME), global, sem `municipio_id`, e uma tabela de catálogo local por tenant, referenciando a tabela de referência e permitindo customização municipal (REMUME). Vantagem — atende ao NF016 de forma direta; permite pré-carregar a RENAME inteira no onboarding de um novo município cliente, um diferencial concreto dado o roadmap comercial de expansão. O catálogo de referência nacional não é dado sensível nem multi-tenant, ficando naturalmente fora do escopo de RLS. Desvantagem — exige modelagem inicial de duas tabelas em vez de uma.
- **Tabela única `medicamentos`, tenant-scoped, com código RENAME como campo texto solto**: vantagem — modelagem inicial mais simples. Desvantagem — perde a padronização nacional e a possibilidade de onboarding acelerado; cada novo município cliente começaria com catálogo vazio, exigindo recadastro manual de centenas de medicamentos.

**Decisão**: adotar o catálogo em duas camadas — tabela de referência nacional (RENAME), global e fora do escopo de RLS, e tabela de catálogo local por município, referenciando a tabela nacional e permitindo customização REMUME. O esforço adicional de modelagem é pequeno frente ao ganho concreto de onboarding acelerado de novos clientes.

### Decisão consolidada

1. O contexto de tenant (`municipio_id`/`unidade_id`) é propagado a cada transação via `SET LOCAL`, aplicado por um interceptor centralizado no backend, sobre o qual as políticas de RLS das tabelas multi-tenant se apoiam.
2. Tabelas multi-tenant utilizam chave primária simples (`id UUID`), com `municipio_id`/`unidade_id` como colunas de escopo indexadas — sem chave composta.
3. O catálogo de medicamentos é modelado em duas camadas: uma tabela de referência nacional (RENAME), global e fora do escopo de RLS, e uma tabela de catálogo local por município, referenciando a nacional e permitindo customização REMUME.

### Consequências

**Positivas**
- Mecanismo de propagação de contexto de tenant idiomático, seguro sob connection pooling e com comportamento fail-closed em caso de esquecimento.
- Schema de complexidade proporcional ao risco real do produto nesta fase, sem redundância desnecessária de chaves compostas.
- Onboarding de novos municípios clientes pode ser acelerado com a RENAME pré-carregada, diferencial de produto derivado diretamente da modelagem do catálogo.

**Negativas / trade-offs assumidos**
- A ausência de chave composta significa que o isolamento de tenant depende da correta configuração e manutenção das políticas de RLS. Isso reforça a necessidade de revisão de código disciplinada sobre qualquer mudança nas políticas de RLS ou no interceptor de propagação de contexto.
- Scripts administrativos ou de manutenção que precisem operar fora do fluxo normal da aplicação precisam de tratamento explícito de propagação de contexto (ou de um papel de banco com bypass de RLS documentado e restrito), para não serem bloqueados indevidamente pelo comportamento fail-closed.

### Revisão

Esta decisão deve ser revisitada caso:
- Seja identificada uma falha de RLS em produção que exponha dados entre tenants, situação em que a introdução de chaves compostas (sub-decisão B) passaria a ser reavaliada como defesa em profundidade adicional.
- O modelo de catálogo em duas camadas se mostre insuficiente para alguma necessidade de customização municipal não prevista pelo NF016 original.

### Decisões relacionadas
- [[ADR-002|Registro de Decisões de Arquitetura 1 ‐ Arquitetura de Software#adr-002---estratégia-de-multi-tenancy]] - Estratégia de multi-tenancy (row-level, RLS)
- [[ADR-003|Registro de Decisões de Arquitetura 1 ‐ Arquitetura de Software#adr-003---arquitetura-interna-do-backend-hexagonal--ports--adapters]] - Arquitetura interna do backend (interceptor de propagação de contexto como parte do adaptador de repositório)
- [[ADR-006|Registro de Decisões de Arquitetura 2 ‐ Backend#adr-006---modelo-de-autenticação-e-autorização]] - Modelo de autenticação e autorização (origem do escopo de tenant na sessão)
- [ADR-015](#adr-015---sgbd) - SGBD (PostgreSQL, suporte nativo a RLS)
- [ADR-017](#adr-017---estratégia-de-particionamento-de-histórico) - Estratégia de particionamento/arquivamento de histórico