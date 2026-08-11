# ADR-003 — Arquitetura Interna do Backend (Hexagonal / Ports & Adapters)

Criado por: João Henrique

## Status
🟢 Decidido e documentado — 20/07/2026

## Contexto

O ADR-001 estabeleceu o monolito modular como estilo de decomposição do sistema, organizado internamente em módulos de domínio (acesso, medicamentos, estoque/entradas, estoque/saídas, inventário, pedidos, indicadores, alertas, administração). Naquele ADR foi registrado explicitamente o risco de que, sem disciplina de engenharia, um monolito modular degrade ao longo do tempo para um "monolito espaguete" — módulos acoplados entre si sem fronteiras reais.

O ADR-002 estabeleceu isolamento multi-tenant row-level (`municipio_id`/`unidade_id`) reforçado por Row-Level Security no banco, mas identificou como trade-off que a disciplina de aplicação continua sendo a primeira linha de defesa contra esquecimento do escopo de tenant em alguma consulta.

Este ADR resolve como o código dentro de cada módulo do monolito é organizado, de forma a:
- Impedir vazamento de regra de negócio para dentro de detalhes de infraestrutura (framework, ORM, HTTP, geração de arquivos).
- Criar um ponto único e revisável de aplicação do escopo de tenant.
- Preservar a extraibilidade futura de um módulo como serviço independente, conforme gatilho de revisão deixado em aberto no ADR-001.

Foram avaliadas três opções:

### Opção A — Camadas tradicionais (Controller → Service → Repository)
**Vantagens**
- Simples, familiar, baixo overhead de abstração, alta produtividade no curto prazo.

**Desvantagens**
- Regra de negócio tende a se misturar com detalhes de infraestrutura dentro dos Services, dificultando testes isolados de domínio e futura extração de módulos.
- Não há um ponto único e óbvio de aplicação do escopo de tenant — cada Service decide isso individualmente, aumentando o risco de esquecimento apesar do RLS do ADR-002.

### Opção B — Hexagonal / Ports & Adapters
O domínio (regras de negócio) fica isolado atrás de **portas** (interfaces), com **adaptadores** plugáveis para infraestrutura (Postgres, e-mail transacional, geração de PDF/XLSX). O domínio não conhece framework nem banco de dados.

**Vantagens**
- O adaptador de repositório é o único ponto de código que toca o banco de dados, tornando-se o local único e revisável para garantir o escopo `municipio_id`/`unidade_id` — segunda camada de defesa somada ao RLS do ADR-002.
- Módulos com hexágono próprio tornam-se genuinamente extraíveis como serviço independente no futuro — trocar um adaptador interno por um adaptador de rede é uma mudança de borda, não de domínio, atendendo ao gatilho de revisão do ADR-001.

**Desvantagens**
- Mais boilerplate e indireção que a opção A, com curva de aprendizado para quem não conhece o padrão.
- Aplicado com rigor total, pode representar overhead desnecessário para telas puramente CRUD sem regra de negócio relevante.

### Opção C — Clean Architecture / DDD-lite (hexagonal + casos de uso explícitos + entidades ricas)
**Vantagens**
- Mesmos benefícios da opção B, mais um caso de uso explícito por funcionalidade, mapeando quase 1:1 com os requisitos funcionais do documento (ex.: RF008 → caso de uso `RegistrarRecebimento`), dando rastreabilidade direta entre requisito e código.

**Desvantagens**
- Maior cerimônia das três opções. Ferramental tático completo de DDD (agregados, value objects, domain events em todos os pontos) tende a desacelerar excessivamente uma equipe pequena em fase de validação de produto.

## Decisão

Adotar **arquitetura hexagonal (Ports & Adapters)** como organização interna de cada módulo do monolito, com as seguintes definições:

- O domínio de cada módulo (regras de negócio) é isolado por trás de portas (interfaces) e não depende de framework, ORM ou protocolo de comunicação.
- Adaptadores de infraestrutura (repositório Postgres, envio de e-mail, geração de PDF/XLSX, etc.) implementam essas portas e são os únicos pontos de código que tocam infraestrutura externa.
- O adaptador de repositório é o ponto único responsável por aplicar o escopo de tenant (`municipio_id`/`unidade_id`) em toda consulta e escrita — reforçando, na camada de aplicação, a proteção já garantida pelo RLS definido no ADR-002.
- **Casos de uso explícitos são adotados quando a funcionalidade envolve regra de negócio relevante** (ex.: RF010 — Registrar Dispensa, com aplicação de FEFO; RF015 — Sugestão de Pedido Mensal, com cálculo de ponto de pedido), mapeando o caso de uso ao requisito funcional correspondente para rastreabilidade.
- Para funcionalidades majoritariamente CRUD sem regra de negócio relevante (ex.: cadastro simples de medicamento), não é obrigatória a criação de um caso de uso formal — é aceitável uma passagem direta e simplificada até o adaptador de repositório, evitando abstração artificial.
- O ferramental tático completo de DDD (agregados complexos, value objects generalizados, domain events em todos os pontos) **não é adotado** nesta fase, para evitar over-engineering incompatível com o momento de validação de produto.
- Módulos só se comunicam entre si através das portas de aplicação uns dos outros — nunca acessando diretamente repositório, tabela ou entidade interna de outro módulo. Esta regra é detalhada no ADR-004 e é o mecanismo primário de prevenção do "monolito espaguete" identificado como risco no ADR-001.

## Consequências

**Positivas**
- Regras de negócio testáveis de forma isolada, sem necessidade de banco de dados ou framework web em testes unitários de domínio.
- Ponto único e revisável de aplicação do escopo de tenant, reduzindo o risco de vazamento de dados entre municípios/unidades por esquecimento em código de aplicação.
- Módulos extraíveis como serviço independente no futuro, sem reescrita de regra de negócio — apenas troca do adaptador de borda.
- Rastreabilidade entre requisito funcional (RF00X) e código, para os casos de uso com regra de negócio relevante.

**Negativas / trade-offs assumidos**
- Maior indireção e boilerplate comparado a uma arquitetura em camadas tradicional — a equipe precisa de alinhamento inicial sobre o padrão para não perder produtividade na curva de aprendizado.
- Necessidade de critério deliberado sobre quando criar um caso de uso explícito versus quando permitir passagem direta ao adaptador — sem esse critério documentado, a equipe tende a divergir (uns criando caso de uso para tudo, outros para nada). Este critério fica registrado nesta decisão: regra de negócio relevante → caso de uso explícito; CRUD simples → passagem direta.

## Revisão

Esta decisão deve ser revisitada caso:
- A disciplina de manter módulos comunicando-se apenas por portas se mostre inviável na prática da equipe, exigindo reforço adicional (ex.: linters de arquitetura, testes de dependência entre módulos).
- Algum módulo específico seja de fato extraído como serviço independente, exigindo validação de que a fronteira hexagonal definida foi suficiente para a extração sem retrabalho significativo de domínio.

## Decisões relacionadas
- ADR-001 — Estilo de decomposição e comunicação (monolito modular)
- ADR-002 — Estratégia de multi-tenancy (aplicação do escopo de tenant no adaptador de repositório)
- ADR-004 — Estratégia de comunicação entre módulos internos
