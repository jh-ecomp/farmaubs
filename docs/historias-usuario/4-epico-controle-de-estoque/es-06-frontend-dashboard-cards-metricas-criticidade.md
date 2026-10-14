# ES-06 feat(estoque): Dashboard Superior: Cartões de Métricas em Tempo Real (Totalizadores, Baixo Estoque e Validade Curta)

---

- **Épico**: Controle de Estoque (RF005, RF006, RF007, RF009, RF011, RF018, RF020, RF022, RF023, RF028, NF001, NF002, NF003, NF007, NF009, NF015)
- **Requisitos Funcionais**: RF018 (Exibir Dashboard de Indicadores), RF022 (Alertar Medicamentos Próximos ao Vencimento), RF023 (Alertar Risco de Ruptura de Estoque)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva com Menos Cliques), NF002 (Design Responsivo), NF007 (Carregamento Ágil < 2s)
- **ADRs Vinculadas**: ADR-011 (React 19 + Vite + Tailwind CSS), ADR-013 (TanStack Query), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico responsável ou gerente de farmácia da UBS,  
> **quero** visualizar no topo da tela de estoque quatro cartões de indicadores consolidados e interativos (Total de Medicamentos, Total de Unidades Físicas, Itens em Baixo Estoque e Lotes com Validade no Mês Corrente em destaque laranja),  
> **para que** eu tenha uma percepção instantânea do nível de criticidade do estoque e possa, com um simples clique no cartão, filtrar a tabela principal para atuar diretamente sobre os itens críticos (RF018, RF022, RF023).

---

## 2. Regras de negócio e casos de borda

1. **Estrutura dos 4 Cartões de Métricas**:
   - **Card 1: Total de Medicamentos**: Número de produtos ativos catalogados na unidade (`text-blue-600 bg-blue-50`).
   - **Card 2: Unidades Físicas em Prateleira**: Soma consolidada de todas as unidades em estoque (`text-cyan-600 bg-cyan-50`).
   - **Card 3: Risco de Ruptura / Baixo Estoque (RF023)**: Itens com cobertura crítica (< 20 dias). Ao clicar, filtra por `statusEstoque=BAIXO_ESTOQUE`.
   - **Card 4: Lotes Vencendo no Mês / Validade Curta (RF022)**: Lotes no mês corrente ou em até 90 dias em **cor laranja vibrante** (`text-amber-700 bg-amber-50 border-amber-200`). Ao clicar, filtra por `filtroValidade=MES_CORRENTE`.
2. **Estados Visuais e Feedback**:
   - Skeleton loaders com efeito pulsar durante carregamento para evitar layout shift.
   - Estado Zero com badge suave "Estoque Saudável" em tom esmeralda quando não houver riscos.
3. **Acessibilidade e Semântica (ADR-032)**:
   - `role="button"` nos cards interativos, `tabindex="0"`, foco visível de alto contraste e atributos `aria-label` descritivos.

---

## 3. Contratos de dados e Protocolo HTTP (DTOs / Tipagens)

```typescript
export interface EstoqueMetricasDTO {
  totalMedicamentosAtivos: number;
  totalUnidadesFisicas: number;
  itensRiscoRuptura: number;
  lotesValidadeMesAtual: number;
  lotesValidadeCurta90d: number;
  lotesVencidos: number;
  calculadoEm: string;
}

export interface FiltroCardsEstoque {
  statusEstoque?: 'BAIXO_ESTOQUE' | 'ZERADO' | 'TODOS';
  filtroValidade?: 'MES_CORRENTE' | 'VALIDADE_90D' | 'VENCIDOS' | 'TODOS';
}
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

- **Camada**: D (Testes de Componentes React).
- **Componente**: `apps/frontend/src/features/estoque/components/EstoqueCardsMetricas.tsx`.
- **Hook de Dados**: `useEstoqueMetricas()` consumindo `GET /api/v1/estoque/metricas` via TanStack Query.
- **Props**: `onFiltrarPorCard?: (filtro: FiltroCardsEstoque) => void`.

### Compartilhamento Arquitetural com `@farmaubs/shared` e App Mobile (`apps/mobile` - ES-MOB-01)
- **Contratos e DTOs Unificados**: DTO `EstoqueMetricasDTO` definido em `@farmaubs/shared/src/contracts/estoque/`.
- **Cálculo de Criticidade e Ranges**: Helper puro em `@farmaubs/shared/src/domain/estoque/criticidade-helpers.ts` consumido no web e mobile.

---

## 5. Cenários de teste em BDD (Gherkin — camada D)

```gherkin
# language: pt
Funcionalidade: Cartões de Métricas de Estoque (Camada D)

  Cenário: Renderização com dados e destaque do card laranja de validade
    Dado que a API retorna métricas com 6 lotes vencendo no mês atual
    Quando o componente "EstoqueCardsMetricas" for renderizado
    Então o card de validade curta deve exibir o número "6" com estilo de destaque na cor laranja
    E o card de total de medicamentos deve exibir o valor correspondente
    E nenhum skeleton loader deve permanecer visível após o carregamento

  Cenário: Clique no card de risco de ruptura aciona filtro na tabela
    Dado que existem 3 itens em risco de ruptura de estoque
    Quando o farmacêutico clicar no card "Itens em Risco de Ruptura"
    Então o callback de filtro deve ser disparado com "statusEstoque=BAIXO_ESTOQUE"
    E o card deve apresentar um indicador visual de estado ativo/selecionado
```

---

## 6. Checklist de DoD e aceitação

- [ ] Componente implementado com Tailwind CSS e grid responsivo (1 col mobile, 2 col tablet, 4 col desktop).
- [ ] Cartão de validade estilizado com a cor laranja acordada e suporte a clique de atalho.
- [ ] Testes de componentes (Camada D) validando skeleton de carregamento, clique de filtro e conformidade com `axe-core` (zero violações WCAG 2.1 AA).
