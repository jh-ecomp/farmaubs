# IN-MOB-02: Contagem Física de Inventário nas Prateleiras no Celular

**Épico:** 5 - Inventário Mensal  
**Camada:** `apps/mobile` (Expo React Native)  
**Requisitos Funcionais Relacionados:** RF-013  
**Requisitos Não Funcionais Relacionados:** RNF-001, RNF-002, RNF-005, RNF-007  
**ADRs Aplicadas:** ADR-006 (Contratos TypeScript via @farmaubs/shared), ADR-007 (TanStack Query), ADR-022 (Expo Mobile), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)  
**História Frontend Irmã:** IN-06 (Formulário de Contagem Física: Lançamento por Lote e Autosave)  
**Complexidade Estimada:** Alta  

---

## 1. História de Usuário

**Como** Farmacêutico ou Técnico de Farmácia percorrendo os corredores e prateleiras da farmácia da UBS com o smartphone,  
**Quero** registrar a contagem física das caixas e frascos por lote diretamente no aplicativo, com campo de busca ágil, botões incrementais táteis (+/-) e salvamento automático contínuo em rascunho (autosave),  
**Para que** eu possa realizar o levantamento físico com velocidade e conforto, sem pranchetas de papel e com garantia de que nenhuma digitação será perdida caso a conexão oscile.

---

## 2. Regras de Negócio e Casos de Borda Mobile

### 2.1 Ergonomia de Bancada e Contagem Física
- **Identificação do Item**:
  - Nome do medicamento, apresentação farmacêutica, laboratório/fabricante.
  - Código do lote em fonte monoespaçada e data de validade com badge.
- **Controles de Quantidade Física Tátil**:
  - Campo numérico central com botões largos de incremento (`+`) e decremento (`-`) nas laterais (mínimo de 48x48pt para fácil operação com polegar).
  - Toque no número abre o teclado numérico nativo (`keyboardType="number-pad"`).
  - Não permite valores negativos (`>= 0`).
- **Navegação e Filtros Rápidos**:
  - Barra de busca superior com debounce de 300ms (busca por nome do remédio ou lote).
  - Chips de status:
    - `Pendentes` (itens ainda não contados no ciclo atual - padrão ao abrir).
    - `Contados` (itens já com contagem lançada).
    - `Todos`.

### 2.2 Salvamento Automático em Rascunho (Autosave - RNF-005)
- Ao alterar a quantidade física de um lote:
  - O estado da tela é atualizado instantaneamente (zero atraso perceptível).
  - Uma fila de sincronização em background despacha o salvamento para `PUT /api/v1/inventario/ciclos/:id/itens/:itemId/contagem` com debounce de 1 segundo.
- **Barra de Status de Sincronização**:
  - Exibida no topo ou rodapé da tela:
    - 🔄 `Salvando contagem...`
    - ✅ `Todas as contagens salvas`
    - ⚠️ `Sem conexão — retido no aparelho` (mantido em fila local no AsyncStorage/Memory até retorno da rede).
- **Detecção de Divergência**:
  - Após o salvamento, se a contagem física diferir do saldo teórico congelado, o card exibe um badge sutil `Divergência Detectada` e disponibiliza o atalho `Justificar` que direciona para a tela de conciliação (**IN-MOB-03**).

---

## 3. Contratos de Dados e Tipagens (`@farmaubs/shared`)

```typescript
import {
  SalvarContagemItemInputDTO,
  salvarContagemItemSchema,
  InventarioItemContagemDTO,
  calcularDivergencia,
} from '@farmaubs/shared';

export interface UseContagemInventarioMobileReturn {
  itens: InventarioItemContagemDTO[];
  isLoading: boolean;
  isSaving: boolean;
  statusSync: 'SALVANDO' | 'SINCRONIZADO' | 'ERRO_OFFLINE';
  atualizarQuantidade: (itemId: string, novaQtd: number) => void;
  filtroStatus: 'TODOS' | 'PENDENTES' | 'CONTADOS';
  setFiltroStatus: (filtro: 'TODOS' | 'PENDENTES' | 'CONTADOS') => void;
}
```

---

## 3.3 Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)

- **Contra-parte no Frontend Web**: `IN-06` (Formulário de contagem física: digitação por lote com busca textual e salvamento contínuo).
- **Contratos Compartilhados (`@farmaubs/shared`)**:
  - `SalvarContagemItemInputDTO`, `salvarContagemItemSchema`, `InventarioItemContagemDTO`, `calcularDivergencia`.
- **Se o Frontend Web já implementou IN-06**:
  - O Mobile utiliza exatamente o mesmo schema Zod e o mesmo endpoint `PATCH /api/v1/inventario/ciclos/:id/itens/:itemId` para atualização da contagem de cada lote em tempo real.
- **Se o Frontend Web ainda NÃO implementou IN-06**:
  - O desenvolvedor Mobile define os schemas de salvamento de lote e helpers de divergência em `packages/shared/src/contracts/inventario/`, permitindo que a tela web de contagem os consuma sem desvios de tipagem.

---

## 4. Critérios de Aceite Detalhados

1. **Facilidade Tátil**: Os botões de incremento (+) e decremento (-) devem responder imediatamente a toques repetidos com feedback háptico leve.
2. **Salvamento Automático em Background**: A alteração numérica não deve exigir clique em "Salvar" individual; o app deve sincronizar automaticamente em até 1 segundo após o término da digitação.
3. **Indicador Visual de Sincronização**: O usuário deve ter visibilidade permanente sobre o estado das gravações (salvando vs salvo).
4. **Filtro de Itens Pendentes**: Deve ser possível isolar com um toque apenas os medicamentos que ainda aguardam contagem.
5. **Prevenção de Perda de Dados**: Fechar o aplicativo ou alternar de tela não deve descartar contagens que estejam na fila de salvamento.

---

## 5. Cenários de Teste em BDD (Gherkin em Português)

```gherkin
Funcionalidade: Contagem Física de Inventário nas Prateleiras no Celular
  Como conferente de farmácia na UBS
  Quero lançar as quantidades físicas contadas no smartphone
  Para registrar o inventário diretamente na prateleira sem pranchetas de papel

  Contexto:
    Dado que o usuário está na tela de contagem do ciclo de inventário ativo
    E o lote "LOTE-551" de "Paracetamol 500mg" está pendente de contagem

  Cenário: Incremento tátil de quantidade com salvamento automático
    Quando o usuário toca 3 vezes no botão "+" do lote "LOTE-551"
    Então o visor deve exibir a quantidade "3"
    E a barra de sincronização deve exibir "Salvando contagem..."
    E após 1 segundo deve exibir "Todas as contagens salvas"

  Cenário: Filtro de itens pendentes de conferência
    Dado que 10 itens já foram contados e 15 continuam pendentes
    Quando o usuário seleciona o chip "Pendentes"
    Então a lista deve exibir estritamente os 15 medicamentos que ainda não receberam contagem física
```

---

## 6. Checklist de DoD (Definition of Done)

- [ ] Componente `ContagemInventarioListMobile` implementado com suporte a `FlatList` virtualizada.
- [ ] Hook de autosave com debounce e tratamento de reconexão.
- [ ] Botões incrementais de 48x48pt com suporte a `Haptics.selectionAsync()`.
- [ ] Indicador de sincronização em tempo real no topo/rodapé da tela.
- [ ] Testes de componentes mobile simulando toques incrementais e chamadas de autosave.
