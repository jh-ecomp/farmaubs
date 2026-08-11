# ADR-032 — Acessibilidade Digital

Criado por: João Henrique

## Status
🟢 Decidido e documentado — 24/07/2026

## Contexto

A necessidade de acessibilidade digital foi confirmada como lacuna real do documento de requisitos original durante a fase de levantamento de requisitos arquiteturais (Q4). Essa necessidade já influenciou a escolha de framework de frontend no ADR-011, que priorizou React parcialmente pela maturidade de seu ecossistema de bibliotecas de componentes acessíveis (Radix UI/shadcn-ui). Este ADR formaliza o padrão de acessibilidade a ser seguido e o mecanismo de verificação de conformidade, de forma que a escolha do ADR-011 tenha um critério objetivo de "pronto" por trás dela.

Duas referências de acessibilidade digital são relevantes no contexto brasileiro:

- **WCAG** (Web Content Accessibility Guidelines): padrão internacional, com níveis de conformidade A, AA e AAA, adotado como referência técnica pela ampla maioria das legislações de acessibilidade do mundo, incluindo a Lei Brasileira de Inclusão.
- **e-MAG** (Modelo de Acessibilidade em Governo Eletrônico): padrão brasileiro específico para sítios e sistemas do governo, apoiado fortemente em WCAG, mas com adição de itens voltados a portais de atendimento ao cidadão leigo (linguagem simplificada, mapa do site, glossário de termos).

O FarmaUBS não é um portal de atendimento ao cidadão comum — é uma ferramenta de trabalho de uso interno e autenticado por farmacêuticos, cujo vocabulário técnico já é exigido pelo NF001 do documento de requisitos ("nomenclaturas devem seguir o vocabulário já utilizado pelos farmacêuticos"). Ao mesmo tempo, o roadmap comercial B2G confirmado no ADR-001 (venda futura à Secretaria de Saúde) torna relevante demonstrar conformidade com um padrão de acessibilidade reconhecido, como diferencial defensável em processos de contratação pública futuros.

### Opções avaliadas

**A — WCAG 2.1 nível AA como padrão-alvo, com e-MAG referenciado apenas nos pontos tecnicamente aplicáveis a um sistema interno**

Vantagens: nível AA é a referência prática adotada pela ampla maioria das legislações de acessibilidade relevantes, incluindo a brasileira — nem o mínimo raso do nível A, nem o padrão raramente exigido na prática do nível AAA, que inclui critérios como ausência total de linguagem figurada, inviável para um sistema de domínio técnico farmacêutico como este. Direciona objetivamente o uso da biblioteca de componentes já escolhida no ADR-011, cujos componentes primitivos (Radix UI) são desenhados nativamente para atender ao nível AA. Critério claro o suficiente para verificação por ferramenta automatizada, sem depender de julgamento subjetivo de um desenvolvedor júnior sobre o que constitui acessibilidade suficiente.

Desvantagens: não cobre, isoladamente, itens de usabilidade cognitiva mais amplos que o e-MAG completo endereçaria — aceitável dado que o público-alvo do sistema é um profissional treinado, não um cidadão leigo.

**B — e-MAG completo**

Vantagens: conformidade total com o padrão brasileiro específico de governo eletrônico.

Desvantagens: escopo desproporcional a um sistema interno autenticado de uso profissional — critérios como linguagem simplificada para leigo e glossário de termos contradiriam diretamente o NF001, que exige vocabulário técnico do próprio domínio farmacêutico. Descartada por desproporção, na mesma linha de raciocínio já aplicada a outras decisões de escopo deste projeto.

**C — "Melhor esforço", sem padrão formal definido**

Vantagens: nenhum esforço adicional de definição de critério.

Desvantagens: sem uma barra objetiva, cada desenvolvedor júnior aplicaria um critério próprio, ou nenhum, tornando a conformidade inverificável em revisão de código e impossível de comprovar caso um edital público futuro exija evidência formal. Descartada pela mesma razão que motivou a rejeição de uma meta de cobertura de testes genérica no ADR-030 — padrões vagos não são seguidos na prática por uma equipe júnior sem critério objetivo.

## Decisão

Adotar **WCAG 2.1 nível AA** como padrão-alvo de acessibilidade digital do FarmaUBS, com verificação de conformidade em duas camadas:

1. **Verificação automatizada**:
   - `eslint-plugin-jsx-a11y` integrado ao processo de lint do frontend, identificando violações de acessibilidade no momento da escrita do código, antes mesmo da abertura de um pull request.
   - `axe-core` integrado aos testes de componente já definidos no ADR-030 (via Testing Library), reaproveitando a infraestrutura de testes já decidida, sem introdução de ferramenta nova de teste.

2. **Verificação manual pontual**:
   - Checklist de navegação por teclado (ordem lógica de tabulação, indicador de foco visível) aplicado aos fluxos de tela do frontend.
   - Teste com leitor de tela (ex.: NVDA, gratuito) nos fluxos correspondentes aos requisitos funcionais classificados como Essencial no documento de requisitos original, antes do primeiro piloto real com as UBSs parceiras — mesmo critério de "requisito Essencial como linha de corte" já adotado no ADR-030 para testes end-to-end.

**Critério de aprovação em revisão de código**: qualquer componente novo de interface que apresente falha identificada pelo `axe-core` ou pelo lint de acessibilidade não é aprovado em revisão de código — mesmo modelo de regra de obrigatoriedade objetiva já adotado no ADR-030 para testes, em substituição a uma meta abstrata de conformidade.

## Consequências

**Positivas**
- Padrão de acessibilidade objetivo e verificável, evitando dependência de julgamento subjetivo de desenvolvedores júnior.
- Verificação automatizada integrada ao fluxo de desenvolvimento já existente (lint e testes de componente do ADR-030), sem introdução de ferramental adicional significativo.
- Escopo proporcional ao contexto de uso real do sistema — ferramenta interna profissional, não portal público — evitando o esforço desnecessário de aplicar e-MAG na íntegra.
- Diferencial defensável em processos de contratação pública futuros, dado o roadmap comercial B2G do ADR-001.

**Negativas / trade-offs assumidos**
- Verificação automatizada (lint e axe-core) não substitui integralmente testes manuais com usuários reais de tecnologia assistiva — a verificação manual pontual definida cobre apenas os fluxos Essenciais antes do piloto, não a totalidade do sistema.
- A equipe de frontend (um único desenvolvedor júnior) precisa internalizar o hábito de interpretar e corrigir as falhas apontadas pelo lint e pelo axe-core, exigindo suporte inicial do desenvolvedor sênior até a formação desse hábito.

## Revisão

Esta decisão deve ser revisitada caso:
- Um contrato ou edital público futuro exija formalmente conformidade com e-MAG completo, ou com um nível de WCAG distinto do AA.
- A verificação manual pontual revele, nos fluxos Essenciais, barreiras de acessibilidade não capturadas pela verificação automatizada, indicando necessidade de ampliar a cobertura de testes manuais para outros fluxos do sistema.

## Decisões relacionadas
- ADR-011 — Framework de frontend (React, escolhido em parte pela maturidade do ecossistema de acessibilidade)
- ADR-030 — Estratégia de testes (reaproveitamento da infraestrutura de testes de componente e do critério de requisito Essencial)
