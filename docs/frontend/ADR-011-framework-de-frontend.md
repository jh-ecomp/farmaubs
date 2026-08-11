# ADR-011 — Framework de Frontend

Criado por: João Henrique

## Status
🟢 Decidido e documentado — 20/07/2026

## Contexto

O frontend do FarmaUBS será desenvolvido por um único desenvolvedor júnior, sem par de frontend para revisão contínua no dia a dia. Este ADR decide o framework a ser adotado, considerando:

- A ausência de um segundo desenvolvedor de frontend favorece um framework com estrutura clara e boas práticas incorporadas, reduzindo o número de decisões fragmentadas que precisariam ser tomadas isoladamente por um desenvolvedor júnior sem revisão de par.
- A necessidade de acessibilidade digital (WCAG/e-MAG), identificada como lacuna do documento de requisitos original, precisa nascer junto com a escolha do framework e de sua biblioteca de componentes, não ser corrigida posteriormente — retrabalho de acessibilidade após a construção das telas tende a exigir reescrita componente a componente.
- A necessidade futura de resiliência offline (ADR-014, ainda a ser detalhado), o que torna relevante a maturidade do ecossistema de PWA/service worker do framework escolhido.
- O consumo da API REST definida no ADR-007, favorecendo um ecossistema fortemente tipado para reduzir erros de integração entre frontend e backend.
- Consistência com o critério de mercado de trabalho e material de estudo em português já utilizado na escolha do backend (ADR-005), relevante para contratação futura e suporte à equipe júnior.
- A predominância de dashboards com gráficos (RF018, RF019 — curva ABC, indicadores) e formulários intensivos (a maior parte das telas do sistema), favorecendo ecossistemas maduros de bibliotecas de gráfico e de formulário.

### Opções avaliadas

**A — React (com Vite)**

Vantagens: maior mercado de trabalho no Brasil e maior volume de material de estudo em português entre as opções avaliadas, na mesma linha de raciocínio que favoreceu Node.js no ADR-005. Ecossistema de bibliotecas de componentes acessíveis por padrão (ex.: Radix UI, React Aria, e a combinação shadcn/ui) é o mais maduro entre as opções avaliadas, endereçando diretamente a exigência de acessibilidade sem exigir conhecimento profundo de ARIA por parte do desenvolvedor júnior. Ecossistema robusto de PWA/service worker (ex.: Workbox) para a futura implementação do padrão de resiliência offline do ADR-014. Ecossistema maduro de bibliotecas de gráfico (Recharts, Chart.js) para os dashboards de indicadores.

Desvantagens: React não é um framework completo por si só — decisões de roteamento, cliente HTTP e formulários ficam em aberto, a serem resolvidas em ADRs subsequentes (ADR-012, ADR-013), não sendo uma lacuna desta decisão, mas uma característica a ser reconhecida.

**B — Vue 3 (com Vite)**

Vantagens: curva de aprendizado geralmente considerada mais suave que React para iniciantes, com single-file components favorecendo organização intuitiva de HTML/CSS/JS. Documentação oficial de alta qualidade, com boa presença de comunidade brasileira.

Desvantagens: mercado de trabalho no Brasil significativamente menor que React, pesando contra a contratação futura. Ecossistema de bibliotecas de componentes acessíveis (PrimeVue, Vuetify) existe e é adequado, porém menos maduro e menos referenciado que o do React.

**C — Angular**

Vantagens: framework mais completo, com roteamento, formulários reativos, cliente HTTP e injeção de dependência inclusos, reduzindo o número de decisões fragmentadas que um desenvolvedor júnior sozinho precisaria tomar. A filosofia de módulos e injeção de dependência do Angular é estruturalmente semelhante à do NestJS já adotado no backend (ADR-005), o que facilitaria suporte direto do desenvolvedor sênior ao frontend, caso necessário. Angular Material oferece boa acessibilidade por padrão.

Desvantagens: curva de aprendizado mais íngreme que Vue e React neste estágio, com RxJS como peça central do framework representando um obstáculo real para um único desenvolvedor júnior sem par de revisão. Mercado de trabalho no Brasil menor que React.

**D — Svelte / SvelteKit**

Vantagens: menos boilerplate, sintaxe enxuta, boa performance.

Desvantagens: ecossistema de bibliotecas de componentes acessíveis prontas ainda imaturo comparado às demais opções, contrariando diretamente a exigência de acessibilidade nascer junto com a escolha do framework. Mercado de trabalho e material de estudo em português significativamente menores, aumentando o risco de falta de suporte de comunidade quando o desenvolvedor júnior encontrar dificuldades.

## Decisão

Adotar **React, com Vite** como ferramenta de build, como framework de frontend do FarmaUBS.

A escolha é orientada primariamente pela combinação entre maturidade do ecossistema de acessibilidade (via bibliotecas construídas sobre primitivos acessíveis, como Radix UI/shadcn-ui, a serem detalhadas no ADR de biblioteca de componentes), curva de aprendizado adequada a um único desenvolvedor júnior sem par de revisão, consistência com o critério de mercado de trabalho e material de estudo em português já aplicado ao backend no ADR-005, maturidade de ecossistema de PWA para a futura resiliência offline (ADR-014), e maturidade de bibliotecas de gráfico para os dashboards de indicadores (RF018, RF019).

A vantagem de sinergia estrutural do Angular com o NestJS do backend foi reconhecida como um argumento válido, mas de peso insuficiente diante do cenário de um único desenvolvedor júnior de frontend sem par — cenário em que a curva de aprendizado mais suave e o ecossistema de acessibilidade mais maduro do React pesam mais.

## Consequências

**Positivas**
- Ecossistema de componentes acessíveis maduro reduz o risco de retrabalho futuro de acessibilidade, endereçando a lacuna identificada no documento de requisitos original.
- Consistência de critério de contratação e suporte de comunidade em português com a decisão já tomada para o backend.
- Ecossistema de PWA maduro facilita a implementação futura do padrão de resiliência offline definido no ADR-014.
- Ecossistema de bibliotecas de gráfico maduro atende diretamente às necessidades de RF018 e RF019.

**Negativas / trade-offs assumidos**
- Por não ser um framework completo, decisões de roteamento, cliente HTTP e gerenciamento de formulários precisam ser tomadas separadamente (ADR-012, ADR-013), exigindo disciplina para manter essas escolhas consistentes ao longo do desenvolvimento, já que não há um "caminho único" imposto pelo framework como aconteceria com Angular.
- A ausência de estrutura organizacional imposta pelo framework exige que o desenvolvedor sênior estabeleça, ainda que de forma enxuta, convenções de organização de pastas e componentes para o desenvolvedor júnior seguir desde o início.

## Revisão

Esta decisão deve ser revisitada caso:
- A ausência de estrutura imposta pelo React se mostre, na prática, um obstáculo real para o desenvolvedor júnior sozinho, a ponto de exigir um framework mais opinativo.
- A equipe de frontend cresça para múltiplos desenvolvedores, cenário em que a maior estruturação imposta por um framework como Angular poderia voltar a ser vantajosa.

## Decisões relacionadas
- ADR-005 — Linguagem e framework do backend (critério de mercado de trabalho e material em português)
- ADR-007 — Estratégia de API (consumida pelo frontend definido aqui)
- ADR-012 — Estratégia de renderização
- ADR-013 — Gerenciamento de estado no cliente
- ADR-014 — Resiliência offline/conexão instável
