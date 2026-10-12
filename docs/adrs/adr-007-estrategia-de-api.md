## ADR-007 - Estratégia de API

### Status
🟢 Decidido e documentado — última atualização: 24/07/2026

### Contexto

O backend foi definido no ADR-005 como Node.js/TypeScript com NestJS, organizado internamente segundo a arquitetura hexagonal do ADR-003. É necessário decidir o estilo de API exposto pelo backend ao frontend (ainda em definição — ADR-011 em aberto) e a estratégia de versionamento.

Fatores relevantes:
- Consumidor único e conhecido da API nesta fase: o próprio frontend do FarmaUBS, não uma API pública para terceiros. A integração com CAF/PEC é manual/por exportação de arquivo, conforme escopo negativo do documento de requisitos.
- Volumetria projetada (centenas de requisições simultâneas) não impõe restrições de desempenho que favoreçam um estilo de API sobre outro.
- Equipe majoritariamente júnior, o que favorece um estilo de API amplamente documentado, com curva de aprendizado curta e grande volume de material de estudo disponível.
- O frontend será desenvolvido por um desenvolvedor diferente dos que constroem o backend, sem grande possibilidade de alinhamento informal contínuo — o que exige um contrato de API claro e verificável.
- O grosso das funcionalidades (RF001–RF028) é composto por operações CRUD e consultas com filtros razoavelmente simples. Não há um caso de uso que demande agregação de dados fortemente heterogênea a ponto de justificar uma linguagem de consulta flexível no cliente.

#### Opções avaliadas

**A - REST (JSON sobre HTTP)**

Vantagens: estilo arquitetural mais difundido e documentado, com o maior volume de material de estudo em português — relevante para o perfil júnior da equipe. Mapeia diretamente para os casos de uso definidos na arquitetura hexagonal do ADR-003 (um recurso/endpoint por caso de uso ou agregado de domínio). NestJS possui suporte de primeira classe para REST, incluindo geração automática de documentação OpenAPI/Swagger via decorators, o que produz um contrato de API verificável sem esforço manual adicional — mitigando o risco de desalinhamento entre backend e frontend desenvolvidos por pessoas diferentes.

Desvantagens: para telas de dashboard que agregam dados de múltiplas fontes (RF018, RF019), pode ser necessário desenhar endpoints agregadores específicos, em vez de uma única consulta flexível.

**B - GraphQL**

Vantagens: permite ao cliente solicitar exatamente os campos necessários, reduzindo sobre-busca de dados; conveniente para telas de dashboard com necessidades variadas de agregação.

Desvantagens: introduz complexidade adicional (resolvers, N+1 de consultas exigindo *dataloaders*, controle de profundidade de consulta) sem contrapartida na volumetria ou na complexidade real das consultas deste sistema. Curva de aprendizado adicional para uma equipe majoritariamente júnior, sem benefício claro dado que não há consumidor externo variável da API. Aplicar controle de acesso multi-tenant (ADR-002) e RBAC (ADR-006) de forma consistente é mais complexo em resolvers GraphQL do que em endpoints REST convencionais.

**C - RPC tipado ponta a ponta (ex.: tRPC)**

Vantagens: tipagem compartilhada entre backend e frontend sem geração de contrato intermediário, reduzindo divergência de tipos quando ambas as pontas são TypeScript.

Desvantagens: acopla fortemente a escolha de frontend a TypeScript/JavaScript antes mesmo do ADR-011 ser decidido, retirando flexibilidade de uma decisão ainda em aberto. Ecossistema e material de estudo em português significativamente menor que REST, pesando contra o perfil júnior da equipe. Menos adequado caso uma integração externa (ex.: futura API para a CAF) venha a ser necessária, já que RPC tipado ponta a ponta não é um padrão amplamente interoperável.

### Decisão

Adotar **REST (JSON sobre HTTP)** como estilo de API, com as seguintes definições:

- **Versionamento por URI**: todos os endpoints são expostos sob o prefixo `/api/v1/`. Medida de baixo custo para preservar a possibilidade de introduzir uma versão futura da API sem quebrar o consumidor atual, sem exigir nenhum mecanismo de versionamento mais sofisticado nesta fase.
- **Documentação automática via OpenAPI/Swagger**: geração da documentação da API diretamente a partir dos decorators e DTOs do NestJS (`@nestjs/swagger`), mantendo o contrato de API sempre sincronizado com o código e disponível para consulta pelo desenvolvedor de frontend sem depender de documentação escrita manualmente à parte.
- **Validação de entrada via DTOs**: toda entrada de API é validada por DTOs com `class-validator`/`class-transformer`, idiomático ao NestJS e já alinhado à camada de adaptador de entrada da arquitetura hexagonal (ADR-003) — o DTO valida o formato da requisição antes de chegar ao caso de uso de domínio.
- **Endpoints agregadores para dashboards**: as necessidades de agregação de dados dos indicadores (RF018, RF019) são resolvidas por endpoints REST específicos de leitura (ex.: `/api/v1/indicadores/dashboard`), desenhados para retornar exatamente os dados que a tela correspondente precisa, em vez de expor uma linguagem de consulta genérica ao cliente.

### Consequências

**Positivas**
- Contrato de API claro, documentado automaticamente e verificável, reduzindo o risco de desalinhamento entre o desenvolvedor de frontend e a dupla de backend.
- Baixa curva de aprendizado adicional para a equipe júnior, com abundância de material de referência em português.
- Compatibilidade natural com uma eventual necessidade futura de expor endpoints para integração externa (ex.: uma futura integração direta com a CAF ou o PEC).
- Alinhamento direto com a arquitetura hexagonal do ADR-003: um endpoint tende a corresponder a um caso de uso de domínio.

**Negativas / trade-offs assumidos**
- Telas com necessidades de agregação variável podem exigir a criação de múltiplos endpoints especializados ao longo do tempo — aceito dado que o volume de telas de dashboard é pequeno e conhecido antecipadamente (RF018, RF019).
- Versionamento por URI é uma solução simples, não a mais elegante a longo prazo — aceito por proporcionalidade ao estágio do produto.

### Revisão

Esta decisão deve ser revisitada caso:
- Surja a necessidade de expor a API para múltiplos consumidores externos com necessidades de consulta muito heterogêneas, cenário em que GraphQL passaria a ter uma vantagem real.
- O número de endpoints agregadores de dashboard cresça a ponto de a duplicação de lógica de agregação se tornar um problema de manutenção relevante.

### Decisões relacionadas
- [[ADR-003|Registro de Decisões de Arquitetura 1 ‐ Arquitetura de Software#adr-003---arquitetura-interna-do-backend-hexagonal--ports--adapters]] - Arquitetura interna do backend (mapeamento endpoint → caso de uso)
- [ADR-005](#adr-005---linguagem-e-framework-do-backend) - Linguagem e framework do backend (NestJS, suporte nativo a OpenAPI/Swagger)
- [ADR-006](#adr-006---modelo-de-autenticação-e-autorização) - Modelo de autenticação e autorização (aplicação de RBAC por endpoint)
- [[ADR-011|Registro de Decisões de Arquitetura 3 ‐ Frontend#adr-011---framework-de-front-end]] - Framework de frontend (consumidor da API definida aqui)