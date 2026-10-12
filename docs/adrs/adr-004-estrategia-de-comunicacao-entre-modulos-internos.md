## ADR-004 - Estratégia de comunicação entre módulos internos

### Status
🟢 Decidido e documentado — última atualização: 20/07/2026

### Contexto

O ADR-001 definiu que o FarmaUBS será um monolito modular, com comunicação majoritariamente síncrona entre módulos e um mecanismo leve de eventos internos (in-process, via *outbox pattern*) reservado para alertas (RF022, RF023, RF024) e geração de relatórios pesados (RF020, RF021).

O ADR-003 definiu que módulos só se comunicam entre si pelas portas de aplicação uns dos outros, nunca acessando diretamente repositório, tabela ou entidade interna de outro módulo — essa é a regra primária de prevenção do "monolito espaguete".

Este ADR resolve os dois mecanismos concretos de comunicação que ficaram em aberto:

**(A)** Como um módulo chama outro de forma síncrona, respeitando a regra de portas do ADR-003.
**(B)** Como funciona, na prática, o mecanismo de eventos assíncronos internos prometido no ADR-001.

Restrição herdada dos ADRs anteriores: nenhuma peça de infraestrutura nova deve ser introduzida além do Postgres já decidido, dado o contexto de custo mínimo da fase pré-receita.

Requisito de confiabilidade relevante: operações de estoque exigem auditabilidade imutável e atômica (NF018), e a perda de um alerta de vencimento (RF022) ou de um relatório em processamento (RF020, RF021) não é aceitável em um sistema de saúde pública.

#### Opções avaliadas para comunicação síncrona (A)

**A1 - Chamada direta de porta (injeção de dependência in-process)**

Vantagens: zero overhead de rede/serialização; mantém a transação ACID do banco entre módulos na mesma operação de negócio (crítico para NF018); simples de testar via mock da porta.
Desvantagens: exige disciplina para que a porta exponha apenas o contrato necessário, não a entidade de domínio inteira do módulo chamado.

**A2 - Mediator/bus interno para chamadas request-response**

Vantagens: desacopla quem chama de quem implementa, útil quando muitos módulos chamam a mesma operação.
Desvantagens: para a quantidade de módulos do FarmaUBS (da ordem de uma dezena), é indireção sem benefício real — resolve um problema de escala que o sistema não tem nesta fase.

#### Opções avaliadas para eventos assíncronos internos (B)

**B1 - Outbox transacional no Postgres + worker interno**

O módulo grava, na mesma transação da operação de negócio, uma linha em uma tabela de eventos (ex.: `DispensaRegistrada`, `LoteProximoAoVencimento`). Um worker interno ao próprio processo do monolito lê essa tabela (por polling ou via `LISTEN/NOTIFY` do Postgres) e dispara os handlers correspondentes.

Vantagens: garantia transacional real — o evento só existe se a operação de negócio foi commitada, resolvendo o problema de "evento publicado com transação em rollback" sem broker externo nem padrão saga; nenhuma infraestrutura nova além do Postgres já decidido; idempotência simples via coluna de controle de processamento.
Desvantagens: há latência de polling/notify entre o evento ocorrer e ser processado. Irrelevante para este sistema, pois nenhum requisito funcional exige latência sub-segundo nos fluxos de alerta ou relatório.

**B2 - Fila in-memory (ex.: event emitter in-process, sem persistência)**

Vantagens: implementação mais simples que B1, latência mínima.
Desvantagens: não sobrevive a um restart ou crash do processo — um alerta de vencimento ou um relatório em processamento perdido silenciosamente é um problema real de confiabilidade neste domínio.

### Decisão

**(A) Comunicação síncrona entre módulos**: adotar **chamada direta de porta** (opção A1). Cada módulo expõe suas portas de aplicação (interfaces) como o único ponto de entrada para outros módulos. As portas devem expor apenas o contrato estritamente necessário à operação solicitada, nunca a entidade de domínio interna do módulo chamado.

**(B) Eventos assíncronos internos**: adotar **outbox transacional no Postgres com worker interno ao processo do monolito** (opção B1), com as seguintes definições:

- Toda operação de negócio que precise disparar um efeito assíncrono (alerta por e-mail, geração de relatório pesado) grava um evento na tabela de outbox **na mesma transação** da operação de negócio principal.
- Um worker interno ao processo do monolito processa a tabela de outbox de forma assíncrona, sem exigir infraestrutura de mensageria externa.
- Cada evento processado é marcado com um controle de idempotência (ex.: timestamp de processamento), de forma que reprocessamentos por falha do worker não dupliquem efeitos colaterais (ex.: reenvio de e-mail de alerta).
- Este mecanismo é reservado exclusivamente para os fluxos identificados no ADR-001 (alertas e relatórios pesados). Não deve se tornar o meio padrão de comunicação entre módulos, que continua sendo a chamada direta de porta (A1).

### Consequências

**Positivas**
- Nenhuma infraestrutura nova além do Postgres já decidido, mantendo o custo de infraestrutura mínimo.
- Garantia transacional real entre a operação de negócio e o evento assíncrono disparado, sem exigir padrão saga ou coordenação distribuída.
- Alertas de vencimento e relatórios não são perdidos silenciosamente por crash ou restart do processo.
- Consistente com a regra de comunicação via portas do ADR-003, sem introduzir um mecanismo de indireção sem justificativa de escala.

**Negativas / trade-offs assumidos**
- Latência de processamento assíncrono não é sub-segundo — aceitável pois nenhum RF exige isso, mas deve ser considerado explicitamente caso um requisito futuro de notificação em tempo real seja introduzido.
- O worker interno compartilha recursos com a aplicação principal. Se o volume de eventos crescer muito, pode ser necessário extrair o worker para um processo separado (não um serviço distribuído, apenas um segundo processo rodando o mesmo binário/container em modo worker). Essa extração é simples dado o desacoplamento já existente.

### Revisão

Esta decisão deve ser revisitada caso:
- Surja um requisito funcional de notificação em tempo real (latência sub-segundo) incompatível com o modelo de polling/notify do outbox.
- O volume de eventos na tabela de outbox cresça a ponto de o worker interno degradar a performance do processo principal.

### Decisões relacionadas
- [ADR-001](#adr-001---estilo-de-decomposição-e-comunicação-da-arquitetura) - Estilo de decomposição e comunicação da arquitetura
- [ADR-003](#adr-003---arquitetura-interna-do-backend-hexagonal--ports--adapters) - Arquitetura interna do backend: Hexagonal + Ports & Adapters
- [[ADR-009|Registro de Decisões de Arquitetura 2 ‐ Backend#adr-009---processamento-de-relatórios-e-exportações]] - Processamento de relatórios e exportações (detalhamento do uso do outbox para RF020/RF021)