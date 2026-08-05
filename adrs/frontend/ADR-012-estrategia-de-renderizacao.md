# ADR-012 — Estratégia de Renderização

Criado por: João Henrique

## Status
🟢 Decidido e documentado — 20/07/2026

## Contexto

O ADR-011 definiu React com Vite como framework de frontend. Este ADR decide a estratégia de renderização: renderização no cliente (SPA/CSR), renderização no servidor (SSR) ou geração estática (SSG).

Fatores relevantes deste contexto:
- O FarmaUBS é um sistema **inteiramente autenticado** — não há nenhuma tela pública de conteúdo (RF002 exige login para acesso a qualquer funcionalidade). Não há, portanto, necessidade de indexação por mecanismos de busca (SEO), que é a principal motivação usual para SSR ou SSG.
- NF007 exige carregamento inicial do dashboard e telas principais em até 3 segundos em conexão de 10 Mbps — um requisito atendível por uma SPA bem construída, sem necessidade de renderização no servidor para atingi-lo.
- O conteúdo exibido é altamente dinâmico e específico do usuário autenticado (estoque da sua unidade, seus indicadores, seu histórico) — SSG não se aplica, pois pressupõe conteúdo majoritariamente estático, conhecido em tempo de build.
- SSR exigiria manter um processo Node de servidor rodando para renderização, adicionando uma peça de infraestrutura e complexidade operacional que não tem contrapartida de benefício, dado que não há necessidade de SEO nem de melhorar o tempo de primeira renderização para usuário não autenticado (a tela de login é a única acessível sem autenticação, e é uma tela simples).
- A resiliência offline planejada para o ADR-014 (ainda a ser detalhado) é mais naturalmente implementada sobre uma SPA com service worker do que sobre um modelo de renderização híbrida servidor/cliente, que introduz complexidade adicional de sincronização entre o que foi renderizado no servidor e o que é gerenciado offline no cliente.
- Restrição de custo mínimo de infraestrutura (herdada desde o ADR-001): uma SPA construída com Vite é servida como arquivos estáticos, podendo ser hospedada em qualquer CDN ou servidor HTTP simples, sem exigir um processo Node dedicado à renderização.

### Opções avaliadas

**A — SPA / Client-Side Rendering (Vite, sem framework de meta-renderização)**

Vantagens: build gerado como arquivos estáticos, hospedáveis em qualquer servidor HTTP simples ou CDN, sem processo Node de servidor dedicado à renderização — custo de infraestrutura mínimo. Modelo mental mais simples para o desenvolvedor júnior de frontend, sem a distinção entre código de servidor e código de cliente que frameworks SSR exigem. Compatibilidade natural com a futura implementação de resiliência offline via service worker (ADR-014), sem a complexidade adicional de sincronizar renderização de servidor com cache offline no cliente. Atende ao requisito de tempo de carregamento (NF007) sem necessidade de renderização no servidor, dado que o sistema não precisa otimizar para usuário não autenticado.

Desvantagens: sem benefício de SEO ou de renderização otimizada para o primeiro carregamento antes da autenticação — irrelevante neste contexto, pois não há necessidade de SEO e a única tela pré-autenticação (login) é simples.

**B — SSR (ex.: Next.js)**

Vantagens: melhor SEO e tempo de primeira renderização para conteúdo público — nenhum dos dois benefícios se aplica a este sistema, que é inteiramente autenticado.

Desvantagens: exige um processo Node de servidor dedicado à renderização, adicionando infraestrutura e complexidade operacional sem contrapartida de benefício real neste contexto. Introduz a necessidade de o desenvolvedor júnior de frontend distinguir entre código executado no servidor e no cliente, uma fonte adicional de complexidade e de possíveis erros sutis (ex.: uso indevido de APIs de navegador em código de servidor). Adiciona fricção à futura implementação de resiliência offline (ADR-014), que se apoia mais naturalmente em uma SPA com service worker.

**C — SSG (Static Site Generation)**

Vantagens: desempenho máximo de carregamento para conteúdo conhecido em tempo de build.

Desvantagens: inaplicável a este sistema — o conteúdo é inteiramente dinâmico e específico do usuário autenticado, não havendo página cujo conteúdo possa ser gerado antecipadamente em tempo de build.

## Decisão

Adotar **SPA (Client-Side Rendering)**, construída com Vite, como estratégia de renderização do frontend do FarmaUBS. A aplicação é compilada como um conjunto de arquivos estáticos (HTML mínimo, JavaScript, CSS), servidos por qualquer servidor HTTP simples ou CDN, com toda a renderização de conteúdo autenticado ocorrendo no navegador do usuário após o carregamento inicial e a chamada à API REST definida no ADR-007.

## Consequências

**Positivas**
- Custo de infraestrutura mínimo — nenhum processo de servidor dedicado à renderização é necessário, apenas hospedagem de arquivos estáticos.
- Modelo mental único (sem distinção servidor/cliente) para o desenvolvedor júnior de frontend, reduzindo superfície de erro.
- Base natural para a futura implementação de resiliência offline via service worker (ADR-014), sem complexidade adicional de sincronização servidor/cliente.
- Atende ao requisito de tempo de carregamento (NF007) sem necessidade de renderização no servidor.

**Negativas / trade-offs assumidos**
- Ausência de otimização de SEO e de primeira renderização para conteúdo público — aceito integralmente, dado que o sistema é inteiramente autenticado e não há necessidade de indexação por mecanismos de busca.
- O carregamento inicial da SPA (antes da hidratação/renderização da primeira tela) depende do tamanho do bundle JavaScript — a ser monitorado para garantir conformidade contínua com NF007 à medida que o sistema cresce, com técnicas de divisão de código (code splitting) aplicadas conforme necessário.

## Revisão

Esta decisão deve ser revisitada caso:
- Surja um requisito futuro de conteúdo público indexável (ex.: uma landing page comercial do produto) — cenário em que SSR ou SSG poderiam ser avaliados para essa parte específica, sem necessariamente afetar a aplicação autenticada.
- O tamanho do bundle JavaScript cresça a ponto de comprometer o requisito de tempo de carregamento (NF007) mesmo após aplicação de divisão de código.

## Decisões relacionadas
- ADR-007 — Estratégia de API (consumida via chamadas HTTP do cliente)
- ADR-011 — Framework de frontend (React com Vite)
- ADR-014 — Resiliência offline/conexão instável
