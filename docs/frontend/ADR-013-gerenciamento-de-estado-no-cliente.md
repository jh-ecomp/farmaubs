# ADR-013 — Gerenciamento de Estado no Cliente

Criado por: João Henrique

## Status
🟢 Decidido e documentado — 20/07/2026

## Contexto

O ADR-011 e o ADR-012 definiram React com Vite e renderização client-side (SPA) como base do frontend. É necessário decidir como o estado da aplicação é gerenciado no cliente.

Esta decisão distingue dois tipos de estado, de natureza diferente, que costumam ser confundidos quando tratados por uma única ferramenta:

- **Estado de servidor**: dados que se originam da API REST (ADR-007) — estoque, medicamentos, dispensas, indicadores, pedidos. Este estado precisa de cache, revalidação, tratamento de carregamento/erro e, eventualmente, sincronização em segundo plano.
- **Estado de cliente/UI**: dados que existem apenas no navegador e não vêm da API — usuário autenticado atual (e seu escopo de `municipio_id`/`unidade_id`, herdado da sessão do ADR-006), estado de abertura de menus/modais, filtros temporários de formulário antes de submissão.

Dado que o frontend será mantido por um único desenvolvedor júnior, a decisão favorece minimizar a quantidade de conceitos e bibliotecas distintas a aprender, evitando tanto a subutilização de uma ferramenta poderosa demais quanto a reimplementação manual de funcionalidades (cache, revalidação) já resolvidas por bibliotecas maduras.

### Opções avaliadas

**A — TanStack Query (para estado de servidor) + Context/useState do React (para estado de cliente/UI)**

Vantagens: TanStack Query resolve cache, revalidação, novas tentativas em caso de falha de rede e estados de carregamento/erro para chamadas à API REST do ADR-007 com pouquíssimo código boilerplate — reduzindo diretamente a quantidade de lógica que o desenvolvedor júnior precisaria escrever manualmente. Ao usar hooks de mutação (`useMutation`) para toda escrita via API, cria-se naturalmente um ponto único e centralizado por onde passam todas as chamadas de escrita — relevante como base para o ADR-014. Para o estado de cliente/UI, que neste sistema é predominantemente simples (usuário autenticado, preferências de interface), o Context e o `useState` nativos do React são suficientes, sem necessidade de uma biblioteca de gerenciamento de estado global dedicada.

Desvantagens: exige que o desenvolvedor júnior aprenda a distinguir conceitualmente estado de servidor de estado de cliente — uma curva de aprendizado inicial pequena, mas necessária para não misturar os dois indevidamente.

**B — Redux Toolkit (estado global único para servidor e cliente)**

Vantagens: ferramenta madura e amplamente documentada, com grande histórico de uso em aplicações React de todos os tamanhos.

Desvantagens: Redux foi originalmente desenhado para estado de cliente, e usá-lo também para estado de servidor exige reimplementar manualmente cache, revalidação e novas tentativas que o TanStack Query já resolve prontos — mais código boilerplate para o desenvolvedor júnior escrever e manter. Para a proporção de estado de cliente/UI deste sistema (pequena, comparada ao volume de dados vindos da API), a estrutura de Redux (actions, reducers, store) é desproporcional.

**C — Zustand (estado global leve para servidor e cliente)**

Vantagens: API mais simples que Redux, menos boilerplate.

Desvantagens: assim como Redux, não resolve nativamente cache e revalidação de dados de servidor — precisaria ser combinado com uma solução de estado de servidor de qualquer forma. Como o estado de cliente/UI deste sistema é simples o suficiente para o Context nativo do React, a introdução do Zustand adicionaria uma dependência sem benefício claro sobre a opção A.

## Decisão

Adotar uma separação explícita de responsabilidades:

- **Estado de servidor**: gerenciado por **TanStack Query**, com toda leitura de dados da API REST (ADR-007) implementada via `useQuery` e toda escrita via `useMutation`. Isso centraliza as chamadas de escrita da aplicação em um único ponto de acesso a dados, servindo como base para o ADR-014.
- **Estado de cliente/UI**: gerenciado por **Context API e `useState`/`useReducer` nativos do React**, sem biblioteca de gerenciamento de estado global dedicada nesta fase. O contexto de autenticação (usuário atual, perfil, escopo `municipio_id`/`unidade_id` herdado da sessão do ADR-006) é implementado como um Context de nível superior da aplicação.

## Consequências

**Positivas**
- Redução significativa de código boilerplate para lidar com cache, revalidação e tratamento de erro de chamadas à API, adequado ao perfil de um único desenvolvedor júnior.
- Separação clara entre dado que vem do servidor e dado que existe apenas na interface, evitando a confusão comum de tratar os dois com a mesma ferramenta.
- Centralização das chamadas de mutação via TanStack Query cria o ponto de extensão necessário para a resiliência offline detalhada no ADR-014.

**Negativas / trade-offs assumidos**
- Caso o estado de cliente/UI cresça em complexidade ao longo do tempo (múltiplos contextos aninhados, lógica de derivação de estado complexa), pode ser necessário introduzir uma biblioteca de estado global dedicada (Zustand ou similar) — decisão adiada para quando essa necessidade for real, não hipotética.

## Revisão

Esta decisão deve ser revisitada caso:
- O estado de cliente/UI cresça a ponto de o uso de múltiplos Contexts aninhados se tornar difícil de manter ou gerar re-renderizações desnecessárias de forma mensurável.

## Decisões relacionadas
- ADR-006 — Modelo de autenticação e autorização (origem do contexto de usuário/escopo de tenant)
- ADR-007 — Estratégia de API (consumida via TanStack Query)
- ADR-011 — Framework de frontend (React)
- ADR-014 — Resiliência offline/conexão instável (apoiada na centralização de mutações via TanStack Query)
