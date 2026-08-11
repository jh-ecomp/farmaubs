# ADR-014 — Resiliência Offline / Conexão Instável

Criado por: João Henrique

## Status
🟢 Decidido e documentado — 20/07/2026

## Contexto

O documento de requisitos original trata parcialmente da resiliência a falhas de conexão: NF005 exige que registros de entrada e dispensa em curso não sejam perdidos em caso de queda de conexão, com rascunhos salvos automaticamente a cada 30 segundos. Esta necessidade foi confirmada como real e mais ampla do que o NF005 cobre — unidades de saúde podem ter conectividade instável, e o risco de perda de trabalho (ou de bloqueio total de uso durante uma queda breve de conexão) é uma lacuna a ser tratada.

Esta decisão é explicitamente de **padrão arquitetural**, não de implementação completa de um modo offline-first nesta fase. O objetivo é decidir uma abordagem que crie o "gancho" necessário na camada de dados do frontend, de forma que uma capacidade offline mais completa possa ser adicionada no futuro sem exigir reescrita da camada de acesso a dados construída agora — o mesmo raciocínio de proporcionalidade já aplicado ao *outbox pattern* do ADR-004.

Base já estabelecida pelos ADRs anteriores: o ADR-013 centralizou toda leitura e escrita de dados via TanStack Query (`useQuery`/`useMutation`), o que já cria um ponto único de acesso a dados na aplicação — nenhum componente de UI faz chamada direta à API por conta própria.

### Opções avaliadas

**A — Chamadas diretas à API espalhadas pelos componentes, sem camada de acesso a dados centralizada, tratando offline apenas quando necessário no futuro**

Vantagens: nenhum esforço adicional agora.

Desvantagens: sem um ponto único de acesso a dados, adicionar qualquer capacidade offline no futuro exigiria localizar e modificar cada chamada de API espalhada pela aplicação — um retrabalho equivalente a reescrever a camada de dados inteira. Esta opção já está descartada de fato pela decisão do ADR-013, que centralizou o acesso a dados via TanStack Query.

**B — Centralizar toda mutação por trás da camada de TanStack Query (já decidida no ADR-013) como o único "ponto de costura", com capacidade offline completa (fila local persistente, sincronização em segundo plano) adiada para uma iteração futura, informada por dados reais de campo**

Vantagens: aproveita a centralização de acesso a dados já decidida no ADR-013 sem esforço adicional de reestruturação. Permite adicionar, no futuro, uma fila de mutações persistente (ex.: IndexedDB) e sincronização em segundo plano (Background Sync API) *sob* a camada de mutação já existente, sem tocar em componentes de UI — os componentes continuam apenas chamando os mesmos hooks de mutação. Evita implementar, nesta fase inicial, um mecanismo de fila offline e resolução de conflito completo antes mesmo de o fluxo online básico estar validado em uso real — quantidade de esforço proporcional ao estágio do produto.

Desvantagens: nesta fase, uma queda de conexão durante uma mutação ainda resulta em falha visível ao usuário (com nova tentativa manual), não em enfileiramento automático transparente — a resiliência efetiva a quedas de conexão fica limitada ao autosave de rascunho já previsto em NF005, até que a fila offline seja implementada.

**C — Implementar arquitetura offline-first completa já nesta fase (fila de mutações em IndexedDB, sincronização em segundo plano, resolução de conflitos)**

Vantagens: resolve o problema de resiliência offline de forma completa desde o início.

Desvantagens: introduz complexidade significativa (gerenciamento de fila local, resolução de conflitos entre estado local e remoto, testes de cenários de sincronização) para um único desenvolvedor júnior de frontend, antes mesmo de o fluxo básico online estar validado em uso real pelas UBSs parceiras. Não há ainda dado de campo sobre a frequência e o padrão real de quedas de conexão nas unidades parceiras que justifique o desenho de uma solução completa agora — o desenho de resolução de conflitos, em particular, depende de entender esse padrão real de uso.

## Decisão

Adotar o **padrão de centralização de mutações via TanStack Query** (opção B) como o "ponto de costura" para resiliência offline, com as seguintes definições:

- Toda escrita de dados na aplicação passa exclusivamente pelos hooks de mutação centralizados já definidos no ADR-013 — nenhum componente de UI realiza chamada de API diretamente. Esta regra já está em vigor pelo ADR-013 e é reafirmada aqui como pré-condição estrutural para este ADR.
- Nesta fase inicial, mutações que falham por perda de conectividade retornam erro tratável pela interface (nova tentativa manual pelo usuário), sem fila offline automática.
- Configurar, desde já, um **service worker básico via `vite-plugin-pwa`** para cache do *app shell* (arquivos estáticos da aplicação), garantindo que a aplicação carregue mesmo com conectividade momentaneamente indisponível, ainda que sem capacidade de operação offline de dados.
- A implementação de uma fila de mutações persistente (ex.: IndexedDB) com sincronização em segundo plano é **adiada para uma iteração futura**, a ser desenhada com base em dados reais de frequência e padrão de queda de conectividade observados nas UBSs parceiras durante a fase de validação.
- O NF005 (autosave de rascunho a cada 30 segundos para operações de entrada e dispensa em andamento) permanece como a mitigação primária de perda de trabalho nesta fase, e deve ser implementado independentemente da fila offline futura.

## Consequências

**Positivas**
- Nenhum retrabalho de camada de dados será necessário para adicionar capacidade offline completa no futuro — o ponto de extensão já existe graças à centralização via TanStack Query do ADR-013.
- Esforço de implementação nesta fase é proporcional ao estágio de validação do produto, evitando over-engineering antes de haver dados reais de uso.
- App shell cacheado via service worker desde já melhora a resiliência percebida mesmo antes da fila offline completa existir.

**Negativas / trade-offs assumidos**
- Até a implementação da fila offline futura, uma queda de conexão durante uma mutação ainda é visível ao usuário como erro, exigindo nova tentativa manual — mitigado parcialmente pelo autosave de rascunho do NF005 para os fluxos mais críticos (entrada e dispensa).
- A decisão de adiar a fila offline completa pressupõe que o time voltará a este ADR com dados reais de campo — é responsabilidade do time de produto/arquitetura garantir que essa observação de campo realmente aconteça durante o piloto, e não seja esquecida.

## Revisão

Esta decisão deve ser revisitada, com prioridade alta, assim que houver dados reais de uso das UBSs parceiras indicando:
- Frequência e duração típica de quedas de conectividade nas unidades.
- Padrões de operação concorrente que informem a estratégia de resolução de conflito necessária para uma fila offline (ex.: o mesmo lote sendo alterado localmente por dois dispositivos que sincronizam depois).

## Decisões relacionadas
- ADR-004 — Estratégia de comunicação entre módulos internos (mesmo raciocínio de proporcionalidade aplicado ao outbox pattern)
- ADR-011 — Framework de frontend (React, ecossistema de PWA)
- ADR-012 — Estratégia de renderização (SPA como base compatível com service worker)
- ADR-013 — Gerenciamento de estado no cliente (centralização de mutações via TanStack Query, pré-condição estrutural desta decisão)
