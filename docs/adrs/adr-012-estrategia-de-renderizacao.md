## ADR-012 - Estratégia de renderização

### Status
🟢 Decidido e documentado — última atualização: 20/07/2026

### Contexto

Com React/Vite decidido no ADR-011 como base do frontend, a estratégia de renderização ainda é uma decisão aberta. O FarmaUBS é uma ferramenta de trabalho com acesso autenticado, utilizada exclusivamente por farmacêuticos e gerentees cadastrados.

Fatores relevantes:
- **Toda a aplicação é protegida por autenticação**: não há conteúdo público, o que neutraliza o principal argumento a favor de renderização no servidor (SSR) — indexação por mecanismos de busca e carregamento de conteúdo público sem JavaScript.
- **Performance de carregamento inicial do SPA**: mitigável por code splitting (lazy loading por rota), de modo que o usuário receba e processe apenas o bundle da rota que está acessando.
- **Infraestrutura**: a restrição de custo mínimo do ADR-001/ADR-021 favorece soluções sem componentes de servidor adicionais dedicados ao frontend.
- **Equipe**: um único desenvolvedor júnior de frontend, sem par experiente, favorece modelos mentais mais simples e menor número de peças móveis.

#### Opções avaliadas

**A - SPA pura com renderização client-side (CSR)**

Vantagens: arquitetura de deploy simples — o frontend é um conjunto de arquivos estáticos servidos por Nginx sem lógica de servidor dedicada ao frontend (ADR-023). Nenhum componente adicional de infraestrutura. Model mental de componente React puro, sem a camada adicional de separação entre componentes servidor e componentes cliente que SSR em React introduz. O servidor de aplicação (NestJS, ADR-005) concentra toda a lógica de dados e regra de negócio, sem divisão entre dois runtimes. Compatível de forma natural com o service worker para caching de app shell (ADR-014), sem os conflitos de hidratação que SSR tende a introduzir em cenários com cache agressivo.

Desvantagens: o tempo de interatividade inicial (TTI) pode ser maior que em SSR, pois o HTML carregado é mínimo e a renderização ocorre inteiramente no cliente. Para um sistema de uso interno autenticado sem conteúdo público, essa desvantagem é pouco relevante — o usuário está logado, com expectativa de um carregamento razoável ao abrir a ferramenta de trabalho, e não de um page load instantâneo por motores de busca.

**B - SSR (Server-Side Rendering) via Next.js ou Remix**

Vantagens: melhor performance de carregamento inicial percebido e indexabilidade por mecanismos de busca.

Desvantagens: ambas as vantagens são irrelevantes para o caso de uso do FarmaUBS — a aplicação é totalmente autenticada, sem conteúdo público para indexar. SSR em React introduz uma separação entre componentes servidor e componentes cliente que aumenta a complexidade do modelo mental para um desenvolvedor júnior trabalhando sozinho. Requer um runtime Node.js adicional para o frontend, aumentando o custo de infraestrutura e a complexidade operacional, contrariando a restrição de custo mínimo e de simplicidade operacional já estabelecidas.

**C - SSG (Static Site Generation)**

Vantagens: performance de carregamento máxima, com HTML pré-gerado.

Desvantagens: inadequada a um sistema com dados dinâmicos por definição (estoque em tempo real, histórico de dispensas, indicadores calculados por período). A natureza altamente dinâmica e personalizada por tenant do FarmaUBS invalida SSG como estratégia aplicável.

### Decisão

Adotar **SPA com renderização client-side (CSR)** como estratégia de renderização do frontend.

O frontend é construído como um conjunto de arquivos estáticos (HTML, JS, CSS) gerados pelo build do Vite, servidos por um servidor Nginx simples dentro do container Docker já previsto no ADR-023. Toda a lógica de dados reside no backend NestJS via API REST (ADR-007). O code splitting por rota, configurado no Vite, mantém o tamanho do bundle inicial dentro de limites aceitáveis de performance de carregamento.

### Consequências

**Positivas**
- Deploy de frontend como artefato estático simples, sem runtime de servidor adicional para o frontend.
- Modelo mental de componente React puro, sem camada SSR adicional — mais adequado ao perfil do desenvolvedor frontend da equipe.
- Compatibilidade natural com service worker para caching de app shell (ADR-014), sem conflitos de hidratação.
- Custo de infraestrutura mínimo, com Nginx como servidor estático de footprint pequeno.

**Negativas / trade-offs assumidos**
- Tempo de interatividade inicial potencialmente maior que em SSR — aceito dado que a aplicação é de uso interno autenticado, sem conteúdo público, e code splitting por rota mitiga parcialmente esse custo.
- Toda a renderização é client-side: uma falha de JavaScript no cliente impede o uso da aplicação, sem fallback de HTML renderizado pelo servidor. Para um sistema de uso interno em rede local ou com conexão razoável, esse risco é considerado aceitável.

### Revisão

Esta decisão deve ser revisitada caso:
- Seja introduzida uma área pública da aplicação (ex.: portal de acesso para o paciente verificar a disponibilidade de medicamentos), onde indexabilidade e performance de carregamento sem JavaScript sejam relevantes.
- A performance de carregamento inicial do SPA se mostre, na prática, insatisfatória para os farmacêuticos em condições reais de rede das UBSs parceiras.

### Decisões relacionadas
- [[ADR-007|Registro de Decisões de Arquitetura 2 ‐ Backend#adr-007---estratégia-de-api]] - Estratégia de API (API REST consumida pelo SPA)
- [ADR-011](#adr-011---framework-de-front-end) - Framework de frontend (React com Vite, base desta decisão)
- [ADR-014](#adr-014---resiliência-offlineconexão-instável) - Resiliência offline/conexão instável (service worker compatível com SPA/CSR)
- [[ADR-023|Registro de Decisões de Arquitetura 5 ‐ CI CD e Infraestrutura#adr-023---containerização-e-orquestração]] - Containerização e orquestração (Nginx para servir os artefatos estáticos)