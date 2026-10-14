# ES-MOB-01 feat(estoque): Dashboard de Saldos e Indicadores de Criticidade no Celular (RF018, RF022, RF023)

---

- **Épico**: Controle de Estoque (RF018, RF022, RF023, NF001, NF002, NF007)
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF018 (Exibir Dashboard de Indicadores), RF022 (Alertar Medicamentos Próximos ao Vencimento), RF023 (Alertar Risco de Ruptura)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva), NF002 (Ergonomia Touch), NF007 (Resposta Ágil)
- **ADRs Vinculadas**: ADR-006 (RBAC), ADR-007 (API REST), ADR-022 (Monorepo), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança Monorepo)

---

## 1. História de usuário

> **Como** farmacêutico ou gerente de farmácia da UBS em ronda ou contagem física,  
> **quero** visualizar no celular, logo na abertura da aba de estoque, cartões táteis com os indicadores consolidados da minha unidade (Total de Itens, Unidades Físicas, Risco de Ruptura e Lotes com Validade Curta no Mês Corrente com destaque laranja),  
> **para que** eu possa avaliar imediatamente a saúde do estoque e tocar em um cartão para filtrar a lista e inspecionar os medicamentos críticos na prateleira (RF018, RF022, RF023).

---

## 2. Regras de negócio e casos de borda

1. **Grid Tátil Responsivo**:
   - 4 indicadores distribuídos em 2 colunas com área mínima de toque de 44x44pt.
2. **Definição dos Cartões**:
   - Card 1: Total de Medicamentos ativos catalogados (azul `#2563EB`).
   - Card 2: Unidades em Prateleira (ciano `#0891B2`).
   - Card 3: Risco de Ruptura (< 20 dias de cobertura) (vermelho `#DC2626`). Ao tocar, aplica filtro `statusEstoque=BAIXO_ESTOQUE`.
   - Card 4: Validade no Mês / 90 Dias em **laranja vibrante** (`#D97706`). Ao tocar, aplica filtro `filtroValidade=MES_CORRENTE`.
3. **Estados e Resiliência**:
   - Skeleton placeholders animados durante carregamento.
   - Suporte a Pull-to-refresh e feedback háptico (`Haptics.selectionAsync()`).

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
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

- **Camada**: Mobile (`apps/mobile`).
- **Componentes**:
  - `apps/mobile/src/screens/estoque/components/EstoqueMetricasCardsMobile.tsx`.
- **Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)**:
  - Contra-parte Web: `ES-06`.
  - Contratos compartilhados em `@farmaubs/shared` (`packages/shared/src/contracts/estoque/`).
  - Utilização da função pura `calcularCriticidadeEstoque` de `@farmaubs/shared`.

---

## 5. Cenários de teste em BDD (Gherkin — camada Mobile)

```gherkin
# language: pt
Funcionalidade: Dashboard de Saldos e Indicadores de Criticidade no Celular (ES-MOB-01 / RF018, RF022, RF023)

  Contexto:
    Dado que o usuário está autenticado no aplicativo mobile na UBS "UBS Vila Nova"
    E acessa a aba "Estoque"

  Cenário: Visualização dos indicadores com destaque laranja
    Quando a tela de estoque termina de carregar
    Então 4 cartões de indicadores devem ser exibidos
    E o cartão "Validade no Mês" deve ter borda e texto de destaque na cor laranja
    E o cartão "Risco de Ruptura" deve exibir a quantidade de itens em baixa

  Cenário: Filtragem da lista ao tocar no cartão de validade
    Dado que o cartão "Validade no Mês" indica 5 lotes
    Quando o usuário toca no cartão "Validade no Mês"
    Então o dispositivo deve emitir um feedback háptico leve
    E o cartão deve ser visualmente marcado como ativo
    E a lista de medicamentos abaixo deve exibir apenas os produtos com lotes a vencer no mês
```

---

## 6. Checklist de DoD e aceitação

- [ ] Componente `EstoqueMetricasCardsMobile` implementado no `apps/mobile/src/screens/estoque/components/`.
- [ ] Hook `useEstoqueMetricas` consumindo dados com TanStack Query e tipagens de `@farmaubs/shared`.
- [ ] Destaque visual laranja implementado de acordo com os tokens do FarmaUBS.
- [ ] Interatividade de filtro por toque com suporte a toggle (selecionar / desmarcar).
- [ ] Testes de renderização com React Native Testing Library cobrindo skeleton, clique de filtro e estado vazio.
