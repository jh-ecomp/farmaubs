# ES-06: Dashboard Superior: Cartões de Métricas em Tempo Real (Totalizadores, Baixo Estoque e Validade Curta)

---

- **Épico**: Controle de Estoque (RF005, RF006, RF007, RF009, RF011, RF018, RF020, RF022, RF023, RF028, NF001, NF002, NF003, NF007, NF009, NF015)
- **Requisitos Funcionais**: RF018 (Exibir Dashboard de Indicadores), RF022 (Alertar Medicamentos Próximos ao Vencimento), RF023 (Alertar Risco de Ruptura de Estoque)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva com Menos Cliques), NF002 (Design Responsivo), NF007 (Carregamento Ágil < 2s)
- **ADRs Vinculadas**: ADR-011 (React 19 + Vite + Tailwind CSS), ADR-013 (TanStack Query), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de Usuário

> **Como** farmacêutico responsável ou gerente de farmácia da UBS,  
> **quero** visualizar no topo da tela de estoque quatro cartões de indicadores consolidados e interativos (Total de Medicamentos, Total de Unidades Físicas, Itens em Baixo Estoque e Lotes com Validade no Mês Corrente em destaque laranja),  
> **para que** eu tenha uma percepção instantânea do nível de criticidade do estoque e possa, com um simples clique no cartão, filtrar a tabela principal para atuar diretamente sobre os itens críticos (RF018, RF022, RF023).

---

## 2. Regras de Negócio e Casos de Borda

1. **Estrutura dos 4 Cartões de Métricas**:
   - **Card 1: Total de Medicamentos**:
     - Exibe o número de produtos ativos catalogados na unidade;
     - Ícone temático institucional (pílula / catálogo), cor azul institucional (`text-blue-600 bg-blue-50`).
   - **Card 2: Unidades Físicas em Prateleira**:
     - Soma consolidada de todas as unidades farmacêuticas em estoque na UBS;
     - Ícone temático (caixas / embalagens), cor ciano (`text-cyan-600 bg-cyan-50`).
   - **Card 3: Risco de Ruptura / Baixo Estoque (RF023)**:
     - Quantidade de itens com cobertura crítica (< 20 dias de consumo médio);
     - Indicador visual em vermelho/âmbar caso haja itens em risco (`text-rose-600 bg-rose-50`);
     - Interatividade: ao clicar no card, a tabela de saldos aplica automaticamente o filtro `statusEstoque=BAIXO_ESTOQUE`.
   - **Card 4: Lotes Vencendo no Mês / Validade Curta (RF022)**:
     - Quantidade de lotes que vencem no mês corrente ou em até 90 dias;
     - Destaque em **cor laranja vibrante** (`text-amber-700 bg-amber-50 border-amber-200`), conforme acordado na entrevista com a equipe em 29/09/2026;
     - Interatividade: ao clicar no card, a tabela de saldos aplica automaticamente o filtro `filtroValidade=MES_CORRENTE`.

2. **Estados Visuais e Feedback**:
   - **Carregamento**: Skeleton loaders com efeito pulsar em cada card para prevenir layout shift (`CLS < 0.1`).
   - **Estado Zero**: Caso não haja nenhum item em risco ou validade curta, o número é exibido como "0" com badge suave "Estoque Saudável" em tom esmeralda.

3. **Acessibilidade e Semântica (ADR-032)**:
   - Cada card possui `role="button"` quando clicável para filtro, `tabindex="0"`, foco visível de alto contraste e atributos `aria-label` descritivos (ex.: `"Ver 4 medicamentos em risco de ruptura"`).

---

## 3. Escopo Técnico & Arquitetural

- **Camada**: D (Testes de Componentes React).
- **Componente**: `apps/frontend/src/features/estoque/components/EstoqueCardsMetricas.tsx`.
- **Hook de Dados**: `useEstoqueMetricas()` consumindo `GET /api/v1/estoque/metricas` via TanStack Query.
- **Props**: `onFiltrarPorCard?: (filtro: { statusEstoque?: string; filtroValidade?: string }) => void`.

### Compartilhamento Arquitetural com @farmaubs/shared e App Mobile (apps/mobile - ES-MOB-01)
- **Contratos e DTOs Unificados**: O DTO de resposta `EstoqueMetricasDTO` e as chaves de query cache `['estoque', 'metricas', ubsId]` são definidos em `@farmaubs/shared/src/contracts/estoque/`.
- **Cálculo de Criticidade e Ranges**: A regra pura que classifica criticidade (ex: `< 20 dias` de cobertura = risco de ruptura; vencimento `<= 90 dias` ou no mês corrente = destaque laranja de validade) é extraída como função pura em `@farmaubs/shared/src/domain/estoque/criticidade-helpers.ts` e consumida tanto na web quanto no componente nativo mobile `EstoqueMetricasCardsMobile`.
- **Consistência de Feedback**: As mesmas cores semânticas e critérios de badges são compartilhados entre Tailwind CSS (Web) e tokens de estilo do React Native (Mobile).
- **Diretrizes para Ciclos Independentes de Desenvolvimento**:
  - *Cenário A (Mobile já implementou ES-MOB-01)*: O Frontend Web consome diretamente `EstoqueMetricasDTO` e `criticidade-helpers.ts` de `@farmaubs/shared`, aplicando as mesmas faixas de corte de ruptura e validade.
  - *Cenário B (Mobile ainda NÃO implementou ES-MOB-01)*: O Frontend Web publica as regras puras de criticidade e tipagens em `packages/shared/src/domain/estoque/criticidade-helpers.ts`, permitindo que o time Mobile tenha o algoritmo e tokens prontos.

---

## 4. Critérios de Aceite (Gherkin BDD)

### Cenário 1: Renderização com dados e destaque do card laranja de validade
```gherkin
Dado que a API retorna métricas com 6 lotes vencendo no mês atual
Quando o componente "EstoqueCardsMetricas" for renderizado
Então o card de validade curta deve exibir o número "6" com estilo de destaque na cor laranja
E o card de total de medicamentos deve exibir o valor correspondente
E nenhum skeleton loader deve permanecer visível após o carregamento
```

### Cenário 2: Clique no card de risco de ruptura aciona filtro na tabela
```gherkin
Dado que existem 3 itens em risco de ruptura de estoque
Quando o farmacêutico clicar no card "Itens em Risco de Ruptura"
Então o callback de filtro deve ser disparado com "statusEstoque=BAIXO_ESTOQUE"
E o card deve apresentar um indicador visual de estado ativo/selecionado
```

---

## 5. Definition of Done (DoD)

- [ ] Componente implementado com Tailwind CSS e grid responsivo (1 col mobile, 2 col tablet, 4 col desktop).
- [ ] Cartão de validade estilizado com a cor laranja acordada e suporte a clique de atalho.
- [ ] Testes de componentes (Camada D) validando skeleton de carregamento, clique de filtro e conformidade com `axe-core` (zero violações WCAG 2.1 AA).
