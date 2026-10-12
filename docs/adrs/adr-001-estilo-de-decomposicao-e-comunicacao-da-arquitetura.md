## ADR-001 - Estilo de decomposição e comunicação da arquitetura

### Status
🟢 Decidido e documentado — última atualização: 20/07/2026

### Contexto

O FarmaUBS está em fase de validação de produto: será implantado gratuitamente em UBSs parceiras de Parnaíba-PI, com plano comercial futuro de venda institucional (B2G) para a Secretaria Municipal de Saúde, cobrindo todas as unidades do município com farmácia, e potencial expansão para outras prefeituras.

Características relevantes do contexto atual:

- **Volumetria**: concorrência muito baixa dentro de cada unidade (tipicamente 1 farmacêutico, poucos em unidades hospitalares). A escala total projetada para os próximos anos é da ordem de algumas centenas de requisições simultâneas, sem cenário realista de dezenas de milhares de usuários simultâneos no horizonte de planejamento.
- **Orçamento**: fase pré-receita, sem contrato institucional de nuvem definido. Prioridade explícita de custo mínimo de infraestrutura.
- **Equipe**: pequena, sem necessidade organizacional de deploys independentes por domínio de negócio.
- **Natureza do domínio**: a maior parte das funcionalidades (RF001–RF028) são operações CRUD transacionais com regras de negócio síncronas. Um subconjunto menor (alertas RF022–RF024 e geração de relatórios RF020–RF021) se beneficia de processamento assíncrono.
- **Consistência transacional**: operações de estoque devem ser auditáveis de forma imutável e atômica (NF018), o que favorece transações ACID locais em vez de consistência eventual entre serviços distribuídos.

Foram avaliadas três opções de estilo de decomposição e comunicação:

### Opção A - Monolito modular com barramento de eventos interno

Uma única aplicação implantável, organizada internamente em módulos com fronteiras de domínio bem definidas (acesso, medicamentos, estoque/entradas, estoque/saídas, inventário, pedidos, indicadores, alertas, administração). Comunicação majoritariamente síncrona, com um mecanismo leve de eventos internos (in-process, via *outbox pattern* no banco relacional) reservado para alertas e relatórios pesados.

**Vantagens**
- Custo de infraestrutura mínimo, compatível com a restrição orçamentária da fase atual.
- Deploy e operação simples, sem orquestração distribuída.
- Transações ACID nativas entre módulos, atendendo à exigência de auditabilidade imutável (NF018).
- Fronteiras internas de módulo preparam o terreno para extração futura de um serviço isolado, se algum módulo precisar escalar de forma independente.

**Desvantagens**
- Não permite deploy independente por módulo — mitigado pelo fato de a equipe ser única e pequena.
- Pode exigir refatoração futura em caso de crescimento comercial muito além do projetado — mitigado por manter os módulos internamente desacoplados desde o início.

### Opção B - Micro-serviços

Decomposição do sistema em serviços independentes por domínio de negócio, com deploy, escalabilidade e bancos de dados próprios por serviço.

**Vantagens**
- Escalabilidade e deploy independentes por serviço.
- Isolamento de falhas entre domínios.

**Desvantagens**
- Custo de infraestrutura multiplicado (múltiplos serviços, gateway, possível service mesh), incompatível com a restrição de custo mínimo da fase atual.
- Complexidade operacional (observabilidade distribuída, consistência eventual, versionamento de contratos entre serviços) sem contrapartida na volumetria real projetada.
- Aumenta significativamente o tempo até a entrega do primeiro piloto funcional.

### Opção C - Arquitetura orientada a eventos com broker externo

Uso de um barramento de mensageria externo (Kafka, RabbitMQ ou similar) como espinha dorsal de comunicação entre componentes.

**Vantagens**
- Bom encaixe pontual para os fluxos de alerta e geração de relatórios.

**Desvantagens**
- Desproporcional como estilo arquitetural principal, dado que a maior parte do domínio é CRUD transacional síncrono.
- Introduz mais uma peça de infraestrutura a operar e pagar, contrariando a restrição de custo mínimo.

### Decisão

Adotar **monolito modular** como estilo de decomposição, com um mecanismo leve de **eventos internos (in-process)** — implementado via *outbox pattern* no banco relacional, sem broker externo — reservado exclusivamente para alertas (RF022, RF023, RF024) e geração de relatórios pesados (RF020, RF021).

Os módulos internos devem ser organizados com fronteiras de domínio explícitas e comunicação mediada por interfaces bem definidas (ver ADR-003), de modo a preservar a possibilidade de extração futura de um módulo como serviço independente, caso a volumetria real venha a justificar.

Esta decisão deve ser revisitada caso ocorra pelo menos uma das seguintes condições:
- Crescimento da base de clientes muito além do projetado (múltiplas dezenas de municípios em operação simultânea com alta concorrência).
- Necessidade comprovada de escalar um módulo específico de forma isolada, com evidência de que o módulo é o gargalo de desempenho do monolito.
- Necessidade organizacional de deploys independentes por equipe, decorrente de crescimento do time de desenvolvimento.

### Consequências

**Positivas**
- Infraestrutura inicial de baixo custo, compatível com a fase de validação gratuita do produto.
- Simplicidade operacional para uma equipe pequena.
- Consistência transacional forte nas operações de estoque, atendendo diretamente a NF018.
- Módulos internos bem delimitados podem ser extraídos individualmente no futuro, sem exigir reescrita completa do sistema.

**Negativas / trade-offs assumidos**
- Escalabilidade horizontal ocorrerá inicialmente por replicação da aplicação inteira (múltiplas instâncias do monolito atrás de um balanceador de carga), não por escalonamento seletivo de módulos.
- Disciplina de engenharia é necessária para manter as fronteiras internas dos módulos limpas. Sem isso, o monolito modular tende a degradar para um "monolito espaguete" ao longo do tempo. Esse risco é reforçado pelo ADR-003.

## Decisões relacionadas
- [ADR-002](#adr-002---estratégia-de-multi-tenancy) - Estratégia de multi-tenancy (município → unidade de saúde)
- [ADR-003](#adr-003---arquitetura-interna-do-backend-hexagonal--ports--adapters) - Arquitetura interna do backend: Hexagonal + Ports & Adapters
- [ADR-004](#adr-004---estratégia-de-comunicação-entre-módulos-internos) - Estratégia de comunicação entre módulos internos
