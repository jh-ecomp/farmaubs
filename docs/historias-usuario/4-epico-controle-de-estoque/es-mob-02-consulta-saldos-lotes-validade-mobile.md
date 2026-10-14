# ES-MOB-02 feat(estoque): Consulta de Saldos por Medicamento e Expansão de Lotes no Celular

---

- **Épico**: Controle de Estoque (RF-005, RF-022, RNF-001, RNF-002, RNF-007)
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF-005, RF-022
- **Requisitos Não-Funcionais**: RNF-001, RNF-002, RNF-007
- **ADRs Vinculadas**: ADR-006, ADR-007, ADR-022, ADR-034, ADR-035
- **História Frontend Irmã**: ES-07 (Tabela Principal de Saldos: Visão por Medicamento e Badges Laranja)
- **Complexidade Estimada**: Alta

---

## 1. História de usuário

> **Como** Farmacêutico ou Técnico de Farmácia circulando pelas prateleiras da UBS,  
> **quero** consultar pelo smartphone a lista de medicamentos com seus saldos totais e poder expandir cada item para visualizar seus lotes físicos, validades ordenadas por FEFO e badges laranjas nos lotes a vencer no mês,  
> **para que** eu possa conferir in loco a concordância física do estoque e priorizar a dispensação e descarte dos lotes mais antigos.

---

## 2. Regras de negócio e casos de borda

### 2.1 Apresentação em Lista Tátil com Accordion
- **Card Principal do Medicamento**:
  - Exibe: Nome do medicamento, dosagem/concentração, forma farmacêutica e categoria clínica (badge sutil).
  - Saldo total disponível na unidade em destaque à direita (ex: `1.450 comp`).
  - Badge de status de cobertura: `Regular` (verde), `Baixo Estoque` (âmbar) ou `Zerado` (vermelho).
  - Ícone de chevron animado indicando se o card está expandido ou recolhido.
- **Gaveta Expandida de Lotes (Accordion)**:
  - Ao tocar no card, desliza suavemente uma seção com todos os lotes que compõem o saldo:
    - Identificador do lote em tipografia monoespaçada legível.
    - Fabricante farmacêutico (ex: EMS, Prati-Donaduzzi, Eurofarma).
    - Data de validade com formato `DD/MM/AAAA`.
    - **Badge Semântico de Validade**:
      - **Laranja vibrante** (`#D97706`): Vencimento no mês vigente ou <= 90 dias.
      - **Vermelho** (`#DC2626`): Lote já vencido.
      - **Verde** (`#059669`): Validade regular (> 90 dias).
    - Quantidade física do lote individual.
  - Ações rápidas por lote (ícones táteis de 44x44pt):
    - Botão `Ajuste (+/-)`: abre o modal de ajuste avulso (**ES-MOB-04**).
    - Botão `Rastrear`: abre a linha do tempo do lote (**ES-MOB-05**).

### 2.2 Ordenação FEFO e Performance
- Os lotes no interior do accordion são obrigatoriamente ordenados por validade crescente (**FEFO**), garantindo que o lote mais próximo do vencimento encabece a lista.
- Utilização de `FlatList` com `initialNumToRender={10}`, `maxToRenderPerBatch={10}` e chave estável `keyExtractor={(item) => item.id}` para rolagem a 60 FPS.
- Estado recolhido por padrão para economizar espaço de tela e memória.

### 2.3 Critérios de Aceite Detalhados
1. **Agrupamento por Produto**: Cada linha da lista principal deve representar um medicamento único com a soma de todos os seus lotes em estoque.
2. **Expansão ao Toque**: O toque em qualquer ponto do card do medicamento deve expandir ou recolher a visualização de seus lotes com animação suave.
3. **Priorização FEFO**: Dentro do card expandido, os lotes devem ser exibidos do vencimento mais próximo para o mais distante.
4. **Destaque Laranja de Validade Curta**: Lotes com validade no mês corrente ou em até 90 dias devem exibir um badge destacado na cor laranja com ícone de atenção.
5. **Acesso aos Atalhos Operacionais**: Cada lote deve disponibilizar atalhos acessíveis para abrir Ajuste Rápido e Ficha de Rastreabilidade.

---

## 3. Contratos de dados e Protocolo HTTP (DTOs / Tipagens)

```typescript
import {
  MedicamentoSaldoItemDto,
  LoteEstoqueDto,
  ordenarLotesPorFEFO,
  calcularStatusValidade,
} from '@farmaubs/shared';

export interface UseSaldosEstoqueMobileReturn {
  medicamentos: MedicamentoSaldoItemDto[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  refetch: () => Promise<void>;
  fetchNextPage: () => void;
  hasNextPage: boolean;
}
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

- **Camada**: Mobile (`apps/mobile`).
- **Componentes**:
  - `SaldosEstoqueListMobile` (FlatList com virtualização e paginação infinita).
  - `MedicamentoAccordionItem` com animação via `LayoutAnimation` ou `react-native-reanimated`.
- **Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)**:
  - **Contra-parte no Frontend Web**: `ES-07` (Tabela de saldos por produto, expansão de lotes e destaque laranja).
  - **Contratos Compartilhados (`@farmaubs/shared`)**: `MedicamentoSaldoItemDto`, `LoteEstoqueDto`, `ordenarLotesPorFEFO`, `calcularStatusValidade`.
  - **Se o Frontend Web já implementou ES-07**: O Mobile utiliza a função `ordenarLotesPorFEFO` e o helper de classificação de validade diretamente de `@farmaubs/shared`.
  - **Se o Frontend Web ainda NÃO implementou ES-07**: O desenvolvedor Mobile define os contratos e helpers de ordenação em `packages/shared/src/domain/estoque/fefo-helpers.ts`.

---

## 5. Cenários de teste em BDD (Gherkin — camada Mobile)

```gherkin
# language: pt
Funcionalidade: Consulta de Saldos e Lotes no Celular (ES-MOB-02)

  Contexto:
    Dado que o usuário está na tela de estoque no smartphone
    E o medicamento "Amoxicilina 500mg cápsula" possui 2 lotes cadastrados

  Cenário: Expansão do medicamento e ordenação FEFO dos lotes
    Quando o usuário toca no card da "Amoxicilina 500mg cápsula"
    Então a gaveta de lotes deve se expandir suavemente
    E o lote "LOTE-2026A" com validade "15/10/2026" deve aparecer antes do lote "LOTE-2027B" com validade "20/05/2027"

  Cenário: Destaque visual do lote com validade no mês
    Dado que o lote "LOTE-2026A" vence no mês corrente
    Quando o usuário visualiza o lote expandido
    Então deve ser exibido um badge na cor laranja de alerta de vencimento
    E devem estar visíveis os botões "Ajustar" e "Rastrear"
```

---

## 6. Checklist de DoD e aceitação

- [ ] Componente `SaldosEstoqueListMobile` implementado com `FlatList` e suporte a paginação infinita.
- [ ] Componente `MedicamentoAccordionItem` com animação via `LayoutAnimation` ou `react-native-reanimated`.
- [ ] Regra `ordenarLotesPorFEFO` e `calcularStatusValidade` importadas diretamente de `@farmaubs/shared`.
- [ ] Badges de validade com contraste visual compatível com o design system FarmaUBS.
- [ ] Testes de componentes mobile simulando toque de expansão e renderização dos lotes.
