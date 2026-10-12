## ADR-002 - Estratégia de multi-tenancy

### Status
🟢 Decidido e documentado — última atualização: 20/07/2026

### Contexto

O modelo de negócio confirmado no ADR-001 tem duas fases: implantação gratuita em UBSs parceiras de Parnaíba-PI (validação de produto) seguida de venda institucional (B2G) à Secretaria Municipal de Saúde, cobrindo todas as unidades do município com farmácia, com potencial expansão para outras prefeituras.

Isso cria duas fronteiras de isolamento de natureza distinta:

- **Fronteira primária (tenant de contrato)**: o **município**. Cada prefeitura é uma cliente distinta, com responsabilidade legal e contratual própria sobre seus dados. É a fronteira relevante para cobrança, onboarding/offboarding de clientes e para exigências legais de segregação de dados entre clientes.
- **Fronteira secundária (escopo operacional)**: a **unidade de saúde** dentro de um mesmo município. Os dados de diferentes UBSs pertencem ao mesmo cliente (a prefeitura), portanto o isolamento entre unidades é primariamente uma questão de **autorização** (RBAC), não de segregação física. O próprio NF015 já prevê acesso cruzado autorizado pelo Administrador.

Não há, no momento desta decisão, exigência contratual ou legal conhecida de segregação física de dados entre municípios clientes. Essa condição é um gatilho explícito de revisão desta decisão.

Foram avaliadas três opções para a fronteira primária (município):

#### Opção A - Row-level (schema único compartilhado)

Todas as tabelas multi-tenant carregam uma coluna `municipio_id`. Um único banco de dados atende todos os clientes, com a segregação garantida por filtro de aplicação e por Row-Level Security (RLS) nativo do PostgreSQL.

**Vantagens**
- Infraestrutura de menor custo possível — uma única instância de banco atende todos os clientes.
- Migrações de schema executam uma única vez, independentemente do número de municípios atendidos.
- Compatível com o monolito modular decidido no ADR-001.
- RLS no próprio banco reduz o risco de vazamento de dados entre clientes por falha na camada de aplicação.

**Desvantagens**
- Isolamento lógico, não físico. Uma falha grave de configuração de RLS tem raio de dano maior que nas demais opções.
- Risco teórico de *noisy neighbor* — irrelevante na volumetria atual.

#### Opção B - Schema-per-tenant

Um schema PostgreSQL dedicado por município, com as mesmas tabelas replicadas em cada schema.

**Vantagens**
- Isolamento mais forte que row-level sem o custo de instâncias de banco separadas.
- Exportação ou expurgo completo dos dados de um cliente (LGPD, NF019, offboarding) equivale à remoção de um schema inteiro.

**Desvantagens**
- Toda migração de schema precisa ser executada uma vez por município a cada deploy, com overhead crescendo linearmente com a base de clientes.
- Complexidade adicional de gerenciamento de pool de conexões e ORM com N schemas dinâmicos.
- Sem ganho prático na fase atual (um único município no piloto).

#### Opção C - Database-per-tenant

Uma instância ou cluster de banco de dados dedicado por município.

**Vantagens**
- Isolamento máximo, sem risco de *noisy neighbor*, com offboarding e portabilidade de dados triviais.

**Desvantagens**
- Custo de infraestrutura multiplicado por cliente, incompatível com a restrição de custo mínimo da fase pré-receita.
- Overhead operacional escalando linearmente com o número de clientes, sem justificativa de volumetria atual.

### Decisão

Adotar **isolamento row-level** como estratégia de multi-tenancy para a fronteira primária (município), com as seguintes definições:

- Toda tabela cujo dado pertença a um cliente específico carrega uma coluna `municipio_id`, obrigatória e indexada.
- A segregação entre municípios é reforçada por **Row-Level Security (RLS) do PostgreSQL**, de modo que a política de isolamento não dependa exclusivamente de disciplina na camada de aplicação.
- A fronteira secundária (unidade de saúde) é resolvida por uma coluna de escopo `unidade_id` nas tabelas operacionais, combinada com controle de acesso baseado em perfil (RBAC), conforme já previsto em NF009/NF015. Não há segregação física entre unidades do mesmo município.
- O acesso cruzado entre unidades, quando autorizado pelo Administrador (NF015), é implementado como exceção explícita na camada de autorização, não como ausência de escopo.

### Consequências

**Positivas**
- Infraestrutura de banco de dados única e de baixo custo, compatível com a fase pré-receita.
- Simplicidade de deploy e migração de schema, alinhada ao monolito modular do ADR-001.
- Camada adicional de proteção contra vazamento de dados entre clientes via RLS, independente de eventuais falhas na lógica de aplicação.

**Negativas / trade-offs assumidos**
- Isolamento é lógico, não físico. Caso surja exigência contratual ou legal de segregação física de dados entre municípios, esta decisão precisará ser revisitada.
- Todo novo desenvolvedor da equipe precisa aprender a nunca escrever uma query multi-tenant sem o filtro de `municipio_id`/`unidade_id`. O RLS mitiga o risco, mas a disciplina na aplicação continua sendo a primeira linha de defesa.
- Uma migração futura para schema-per-tenant ou database-per-tenant exigiria trabalho de migração de dados não trivial. O modelo de dados já está organizado de forma que `municipio_id` é a chave de particionamento natural, o que facilita essa eventual migração.

### Revisão

Esta decisão deve ser revisitada caso ocorra pelo menos uma das seguintes condições:

- Surgimento de exigência contratual ou legal de segregação física de dados entre municípios clientes.
- Evidência mensurável de *noisy neighbor* afetando a experiência de outros clientes.
- Crescimento da base de clientes muito além do projetado, a ponto de o custo operacional de migrações row-level superar o custo de gerenciar schemas ou instâncias separadas.

### Decisões relacionadas
- [ADR-001](#adr-001---estilo-de-decomposição-e-comunicação-da-arquitetura) - Estilo de decomposição e comunicação da arquitetura
- [[ADR-015|Registro de Decisões de Arquitetura 4 ‐ Banco de Dados#adr-015---sgbd]] - SGBD (PostgreSQL, pré-requisito para RLS conforme descrito aqui)
- [[ADR-016|Registro de Decisões de Arquitetura 4 ‐ Banco de Dados#adr-016---modelagem-multi-tenant-no-banco]] - Modelagem multi-tenant no banco (detalhamento de schema, índices e políticas de RLS)
- [[ADR-018|Registro de Decisões de Arquitetura 4 ‐ Banco de Dados#adr-018---política-de-retenção-e-expurgo-de-dados-pessoais-LGPD]] - Política de retenção e expurgo de dados pessoais (LGPD) - ainda não priorizado