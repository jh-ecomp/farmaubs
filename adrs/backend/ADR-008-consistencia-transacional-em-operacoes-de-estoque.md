# ADR-008 — Consistência Transacional em Operações de Estoque

Criado por: João Henrique

## Status
🟢 Decidido e documentado — 20/07/2026

## Contexto

As operações que alteram o estado do estoque — registro de recebimento (RF008), ajuste de entrada (RF009), registro de dispensa (RF010), ajuste de saída (RF011) e inventário mensal (RF013) — precisam garantir consistência mesmo sob acesso concorrente ao mesmo medicamento/lote, e produzir um registro de auditoria imutável, atômico e com estado anterior/posterior (NF018). O RF010 exige ainda que o sistema sugira automaticamente o lote de validade mais próxima (FEFO — First Expired, First Out), o que implica ler e decrementar a quantidade de um lote específico dentro da mesma operação de dispensa.

O nível de concorrência real dentro de uma mesma unidade de saúde foi caracterizado como baixo: tipicamente um único farmacêutico operando por farmácia, com múltiplos farmacêuticos operando simultaneamente apenas em unidades hospitalares, e mesmo nesse caso operando predominantemente sobre medicamentos/lotes distintos na maior parte do tempo. A concorrência real sobre o *mesmo* lote, no *mesmo* instante, é um evento raro.

Este ADR decide o mecanismo de controle de concorrência a ser aplicado nas operações de escrita sobre estoque, dentro do adaptador de repositório definido pela arquitetura hexagonal do ADR-003, sobre o banco PostgreSQL definido no ADR-002/ADR-015.

### Opções avaliadas

**A — Bloqueio pessimista (row-level lock via `SELECT ... FOR UPDATE`)**

A transação que decrementa ou incrementa a quantidade de um lote adquire um bloqueio de linha no início da operação, impedindo que outra transação concorrente leia esse mesmo lote para escrita até o commit.

Vantagens: modelo mental simples — uma única leitura protegida, seguida de escrita, dentro da mesma transação, sem necessidade de lógica de nova tentativa (retry). Mais fácil de implementar corretamente por desenvolvedores júnior do que um esquema de nova tentativa em caso de conflito. Dado o volume real de concorrência (raríssima disputa pelo mesmo lote), o custo de manter um bloqueio de linha por uma transação curta é desprezível. PostgreSQL implementa bloqueios de linha de forma eficiente nativamente, sem necessidade de biblioteca adicional.

Desvantagens: risco de impasse (*deadlock*) caso uma mesma operação de negócio precise bloquear múltiplos lotes em ordens diferentes (ex.: um ajuste de inventário que afeta vários lotes ao mesmo tempo) — mitigável por uma regra simples de ordenação consistente de bloqueio (ver Decisão). Bloqueios de linha mantidos por mais tempo que o estritamente necessário podem gerar espera desnecessária — mitigável mantendo transações curtas e sem chamadas de rede (e-mail, geração de arquivo) dentro do escopo transacional.

**B — Bloqueio otimista (coluna de versão, verificação no commit, nova tentativa em caso de conflito)**

Cada linha de lote carrega uma coluna de versão. A transação lê o lote e sua versão, calcula a nova quantidade, e só efetiva a escrita se a versão não tiver mudado; em caso de conflito, a operação é reexecutada.

Vantagens: nenhum bloqueio de linha é mantido durante a transação, o que favorece cenários de alta concorrência real sobre o mesmo registro.

Desvantagens: exige lógica de nova tentativa (retry) em toda operação de escrita de estoque — complexidade adicional sem retorno, dado que a concorrência real sobre o mesmo lote é rara. Para desenvolvedores júnior, a lógica de nova tentativa é uma fonte adicional de erro sutil (ex.: reexecutar efeitos colaterais não idempotentes) que o bloqueio pessimista evita por construção.

**C — Confiar apenas no nível de isolamento de transação do banco (ex.: `SERIALIZABLE`), sem controle explícito na aplicação**

Vantagens: nenhuma lógica adicional no código de aplicação; o banco resolve conflitos de serialização automaticamente.

Desvantagens: o nível `SERIALIZABLE` no PostgreSQL pode abortar transações em conflito de forma menos previsível para quem não domina a semântica exata do mecanismo, exigindo de qualquer forma lógica de nova tentativa na aplicação — herdando a mesma desvantagem da opção B, sem o benefício de um modelo mental explícito e visível no código do adaptador de repositório.

## Decisão

Adotar **bloqueio pessimista via `SELECT ... FOR UPDATE`** como mecanismo de controle de concorrência para todas as operações de escrita sobre estoque (RF008, RF009, RF010, RF011, RF013), com as seguintes regras de implementação:

- Toda operação que leia um lote com intenção de alterá-lo (incrementar ou decrementar quantidade) deve fazê-lo dentro de uma transação, com `SELECT ... FOR UPDATE` sobre a linha do lote, no adaptador de repositório correspondente (ADR-003).
- Quando uma única operação de negócio precisar bloquear múltiplos lotes (ex.: um ajuste de inventário afetando vários lotes), os lotes devem ser bloqueados em **ordem consistente e determinística** (ex.: ordenados por identificador de lote crescente), para eliminar o risco de impasse entre transações concorrentes.
- As transações que envolvem bloqueio de linha devem ser mantidas o mais curtas possível, e não devem incluir chamadas a serviços externos (envio de e-mail, geração de arquivo) dentro do mesmo escopo transacional — esses efeitos são disparados de forma assíncrona pelo mecanismo de outbox definido no ADR-004, após o commit da transação principal.
- O registro de auditoria (NF018) é gravado na mesma transação da operação de estoque, garantindo que o estado anterior e posterior fiquem consistentes com a alteração efetivamente commitada.

## Consequências

**Positivas**
- Modelo de implementação simples e direto para a dupla de desenvolvedores backend júnior, sem necessidade de lógica de nova tentativa.
- Corretude garantida por construção para o caso de uso mais crítico do sistema (decremento de estoque com FEFO), com baixo risco de erro sutil.
- Custo de desempenho do bloqueio de linha é desprezível dado o volume real de concorrência caracterizado neste contexto.

**Negativas / trade-offs assumidos**
- Risco de impasse (*deadlock*) em operações que bloqueiam múltiplos lotes, mitigado pela regra de ordenação consistente de bloqueio — esta regra precisa ser seguida disciplinadamente em toda nova operação que bloqueie mais de um lote, e deve ser reforçada em revisão de código.
- Caso a concorrência real sobre o mesmo lote aumente significativamente no futuro (cenário não observado no contexto atual), o bloqueio pessimista pode se tornar um gargalo de desempenho, exigindo reavaliação para um esquema otimista.

## Revisão

Esta decisão deve ser revisitada caso:
- Seja observada, em produção, contenção real e mensurável de bloqueios sobre o mesmo lote, indicando que a concorrência aumentou além do caracterizado neste ADR.
- A regra de ordenação consistente de bloqueio se mostre insuficiente para eliminar impasses em operações que envolvam múltiplos lotes, exigindo um mecanismo mais robusto de prevenção de deadlock.

## Decisões relacionadas
- ADR-002 — Estratégia de multi-tenancy (banco PostgreSQL)
- ADR-003 — Arquitetura interna do backend (bloqueio implementado no adaptador de repositório)
- ADR-004 — Estratégia de comunicação entre módulos internos (efeitos assíncronos disparados após commit, fora do escopo transacional do bloqueio)
- ADR-015 — SGBD (PostgreSQL, suporte nativo a `SELECT ... FOR UPDATE`)
