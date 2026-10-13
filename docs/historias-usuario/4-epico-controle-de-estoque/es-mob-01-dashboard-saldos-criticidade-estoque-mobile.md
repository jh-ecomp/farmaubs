# ES-MOB-01: Dashboard de Saldos e Indicadores de Criticidade no Celular

**Épico:** 4 - Controle de Estoque  
**Camada:** `apps/mobile` (Expo React Native)  
**Requisitos Funcionais Relacionados:** RF-018, RF-022, RF-023  
**Requisitos Não Funcionais Relacionados:** RNF-001, RNF-002, RNF-007, RNF-009  
**ADRs Aplicadas:** ADR-006 (Contratos TypeScript via @farmaubs/shared), ADR-007 (TanStack Query), ADR-022 (Expo Mobile), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)  
**História Frontend Irmã:** ES-06 (Dashboard Superior: Cartões de Métricas em Tempo Real)  
**Complexidade Estimada:** Média  

---

## 1. História de Usuário

**Como** Farmacêutico ou Gerente de Farmácia da UBS em ronda ou contagem física,  
**Quero** visualizar no celular, logo na abertura da aba de estoque, cartões táteis com os indicadores consolidados da minha unidade (Total de Itens, Unidades Físicas, Risco de Ruptura e Lotes com Validade Curta no Mês Corrente com destaque laranja),  
**Para que** eu possa avaliar imediatamente a saúde do estoque e tocar em um cartão para filtrar a lista e inspecionar os medicamentos críticos na prateleira.

---

## 2. Regras de Negócio e Casos de Borda Mobile

### 2.1 Apresentação e Interação dos Cards
- **Grid Tátil Responsivo**:
  - Em telas de smartphone padrão (portrait), os indicadores são distribuídos em 2 colunas com 2 linhas (ou carrossel suave caso a largura seja muito restrita).
  - Cada card possui área mínima de toque de 44x44pt e `activeOpacity={0.7}`.
- **Card 1: Total de Medicamentos**:
  - Exibe o total de produtos catalogados com cadastro ativo na UBS. Ícone estilizado de catálogo/pílula em azul (`#2563EB`).
- **Card 2: Unidades em Prateleira**:
  - Soma total de unidades farmacêuticas (comprimidos, frascos, ampolas) no estoque físico. Ícone de embalagem em ciano (`#0891B2`).
- **Card 3: Risco de Ruptura (RF023)**:
  - Itens com cobertura estimada inferior a 20 dias com base no histórico de dispensações. Badge de alerta vermelho (`#DC2626`).
  - Ao tocar no card: aplica o filtro `statusEstoque=BAIXO_ESTOQUE` na listagem de medicamentos abaixo e vibra levemente com feedback háptico.
- **Card 4: Validade no Mês / 90 Dias (RF022)**:
  - Lotes que vencem no mês corrente ou em até 90 dias.
  - **Destaque em Laranja Vibrante** (`#D97706` / Amber), alinhado às diretrizes visuais do projeto.
  - Ao tocar no card: aplica o filtro `filtroValidade=MES_CORRENTE` e posiciona o scroll na lista de lotes críticos.

### 2.2 Estados e Resiliência
- **Carregamento**: Skeleton placeholders individuais com gradiente animado (`react-native-reanimated`) enquanto a query `useEstoqueMetricas` carrega os dados.
- **Estado Saudável**: Quando o risco de ruptura for 0, o card exibe badge sutil "Regular" em tom esmeralda (`#059669`).
- **Atualização Manual (Pull-to-refresh)**: A ação de pull-to-refresh na tela atualiza simultaneamente os cards e a lista de saldos.

---

## 3. Contratos de Dados e Tipagens (`@farmaubs/shared`)

```typescript
import { EstoqueMetricasDTO } from '@farmaubs/shared';

export interface UseEstoqueMetricasMobileReturn {
  metricas: EstoqueMetricasDTO | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<void>;
  aplicarFiltroCard: (filtro: { statusEstoque?: string; filtroValidade?: string }) => void;
}
```

---

## 3.3 Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)

- **Contra-parte no Frontend Web**: `ES-06` (Painel superior: cartões com indicadores em tempo real de saldo e validade).
- **Contratos Compartilhados (`@farmaubs/shared`)**:
  - `EstoqueMetricasDTO`, `calcularCriticidadeEstoque`, regras de corte de validade.
- **Se o Frontend Web já implementou ES-06**:
  - O Mobile utiliza o mesmo DTO de métricas e a função pura `calcularCriticidadeEstoque` de `@farmaubs/shared`, garantindo que os 4 cards mostrem exatamente os mesmos totais que o painel web.
- **Se o Frontend Web ainda NÃO implementou ES-06**:
  - O desenvolvedor Mobile define os contratos e helpers em `packages/shared/src/domain/estoque/criticidade-helpers.ts`, permitindo que o time web os aproveite sem precisar reinventar as regras de corte.

---

## 4. Critérios de Aceite Detalhados

1. **Exibição dos 4 Indicadores**: A tela deve renderizar os 4 cards com números atualizados da UBS selecionada.
2. **Destaque Laranja de Validade**: O card de lotes com validade no mês deve obrigatoriamente adotar a cor de destaque laranja (`#D97706`) com contraste acessível para leitura sob luz ambiente de almoxarifado.
3. **Ação de Toque para Filtragem**: Ao tocar no card de "Risco de Ruptura" ou "Validade no Mês", a lista de medicamentos deve aplicar instantaneamente o filtro correspondente, sem necessidade de confirmação adicional.
4. **Desativação de Filtro**: Tocar novamente no card ativo desmarca o filtro e restaura a listagem completa.
5. **Feedback Tátil**: Todas as interações nos cards devem acionar `Haptics.selectionAsync()`.

---

## 5. Cenários de Teste em BDD (Gherkin em Português)

```gherkin
Funcionalidade: Dashboard de Saldos e Indicadores de Criticidade no Celular
  Como farmacêutico da UBS
  Quero visualizar indicadores de criticidade no meu smartphone
  Para identificar rapidamente medicamentos em risco de ruptura ou vencimento

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

## 6. Checklist de DoD (Definition of Done)

- [ ] Componente `EstoqueMetricasCardsMobile` implementado no `apps/mobile/src/screens/estoque/components/`.
- [ ] Hook `useEstoqueMetricas` consumindo dados com TanStack Query e tipagens de `@farmaubs/shared`.
- [ ] Destaque visual laranja implementado de acordo com os tokens do FarmaUBS.
- [ ] Interatividade de filtro por toque com suporte a toggle (selecionar / desmarcar).
- [ ] Testes de renderização com React Native Testing Library cobrindo skeleton, clique de filtro e estado vazio.
