# ES-MOB-03: Filtros Rápidos, Busca e Bottom Sheet de Estoque no Celular

**Épico:** 4 - Controle de Estoque  
**Camada:** `apps/mobile` (Expo React Native)  
**Requisitos Funcionais Relacionados:** RF-005, RF-022, RF-023  
**Requisitos Não Funcionais Relacionados:** RNF-001, RNF-007  
**ADRs Aplicadas:** ADR-006 (Contratos TypeScript via @farmaubs/shared), ADR-007 (TanStack Query), ADR-022 (Expo Mobile), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)  
**História Frontend Irmã:** ES-08 (Barra de Filtros Avançados: Busca Livre e Filtro de Validade)  
**Complexidade Estimada:** Média  

---

## 1. História de Usuário

**Como** Farmacêutico ou Atendente de Farmácia pesquisando itens no celular,  
**Quero** digitar parte do nome ou lote no campo de busca com retorno instantâneo e selecionar chips de filtro rápido (como "Vencendo no Mês" em laranja ou "Baixo Estoque"), além de poder abrir um painel inferior (Bottom Sheet) para filtrar por categoria clínica da REMUME,  
**Para que** eu encontre o medicamento exato com agilidade mesmo durante o atendimento ao balcão ou conferência no depósito.

---

## 2. Regras de Negócio e Casos de Borda Mobile

### 2.1 Ergonomia Tátil dos Filtros
- **Campo de Busca Superior (`SearchInputMobile`)**:
  - Posicionado de forma fixa ou sticky no topo da tela.
  - Ícone de lupa, placeholder intuitivo ("Buscar por medicamento, princípio ativo ou lote...").
  - Botão de limpar ("X") aparece automaticamente quando há texto digitado.
  - Debounce de 300ms antes de disparar a query de busca à API, economizando dados e bateria.
- **Carrossel Horizontal de Chips (`ScrollView horizontal`)**:
  - Chips táteis com rolagem horizontal livre logo abaixo da barra de busca:
    - `Todos` (padrão).
    - `Vencendo no Mês` (com ponto indicador laranja `#D97706`).
    - `Validade Curta (< 90d)`.
    - `Baixo Estoque` (vermelho `#DC2626`).
    - `Zerados`.
  - Apenas um chip de status temporal/criticidade fica ativo por vez. Toque no chip ativo desmarca e retorna para `Todos`.
- **Botão e Bottom Sheet de Filtros Avançados**:
  - Botão de filtro com ícone de reguladores ao lado da barra de busca. Exibe badge numérico quando há filtros avançados ativos.
  - Ao ser tocado, abre um Bottom Sheet nativo contendo:
    - Seletor de Categoria Clínica da REMUME (ex: Anti-hipertensivos, Antimicrobianos, Antidiabéticos).
    - Seletor de Tipo de Apresentação (Comprimido, Injetável, Xarope, Pomada).
    - Botões de ação no rodapé do sheet: "Limpar Filtros" e "Aplicar Filtros".

### 2.2 Preservação e Limpeza de Estado
- O botão "Limpar Filtros" reseta o termo de busca, desseleciona os chips e remove os filtros de categoria do bottom sheet em uma única operação.
- Ao alternar de UBS no app, os filtros são automaticamente limpos para prevenir visualização inconsistente.

---

## 3. Contratos de Dados e Tipagens (`@farmaubs/shared`)

```typescript
import {
  ConsultarSaldosQueryDto,
  consultarSaldosQuerySchema,
  FiltroValidadeEstoque,
} from '@farmaubs/shared';

export interface UseFiltrosEstoqueMobileReturn {
  filtros: ConsultarSaldosQueryDto;
  termoBusca: string;
  setTermoBusca: (busca: string) => void;
  setFiltroValidade: (filtro: FiltroValidadeEstoque) => void;
  setCategoriaRemume: (categoriaId: string | undefined) => void;
  limparFiltros: () => void;
  filtrosAtivosCount: number;
}
```

---

## 3.3 Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)

- **Contra-parte no Frontend Web**: `ES-08` (Barra de filtros avançados: busca textual, vencimento no mês e categorias).
- **Contratos Compartilhados (`@farmaubs/shared`)**:
  - `ConsultarSaldosQueryDto`, `consultarSaldosQuerySchema`, `FiltroValidadeEstoque`.
- **Se o Frontend Web já implementou ES-08**:
  - O Mobile utiliza o mesmo schema Zod de query e as mesmas chaves de ordenação e filtros temporais validadas pela tela web.
- **Se o Frontend Web ainda NÃO implementou ES-08**:
  - O desenvolvedor Mobile define os tipos de consulta e schemas de validação em `packages/shared/src/contracts/estoque/`, permitindo que o time web consuma a tipagem sem redundância.

---

## 4. Critérios de Aceite Detalhados

1. **Busca Textual com Debounce**: A digitação de texto deve disparar a consulta à API somente 300ms após o usuário parar de digitar.
2. **Chips Rápidos**: O toque em um chip deve filtrar a listagem imediatamente e atualizar o feedback visual do chip ativo.
3. **Destaque do Chip Laranja**: O chip "Vencendo no Mês" deve ter background âmbar suave e borda laranja `#D97706` quando ativo.
4. **Bottom Sheet de Categorias**: Ao tocar no botão de filtros avançados, o bottom sheet deve abrir cobrindo metade da tela, permitindo selecionar categorias da REMUME.
5. **Badge Contador**: O ícone de filtros avançados deve indicar numericamente quantos filtros não-padrão estão em aplicação.

---

## 5. Cenários de Teste em BDD (Gherkin em Português)

```gherkin
Funcionalidade: Filtros Rápidos e Busca de Medicamentos no Celular
  Como farmacêutico da UBS
  Quero filtrar os medicamentos por chips e categorias no celular
  Para localizar produtos específicos sem esforço

  Contexto:
    Dado que o usuário está na tela de estoque no smartphone

  Cenário: Busca por nome do medicamento com debounce
    Quando o usuário digita "Dipirona" no campo de busca
    E aguarda 300 milissegundos
    Então a API deve ser consultada com o parâmetro "termo=Dipirona"
    E a lista deve apresentar apenas medicamentos correspondentes

  Cenário: Ativação do chip de validade no mês corrente
    Quando o usuário toca no chip "Vencendo no Mês"
    Então o chip deve ficar ativo com estilo de destaque laranja
    E a lista deve exibir apenas os produtos com lotes a expirar no mês vigente

  Cenário: Aplicação de filtro avançado via Bottom Sheet
    Quando o usuário toca no botão de filtros avançados
    Então a folha inferior de filtros deve se abrir
    E o usuário seleciona a categoria "Antimicrobianos" e toca em "Aplicar"
    Então o bottom sheet deve se fechar
    E o botão de filtros deve exibir o badge "1"
```

---

## 6. Checklist de DoD (Definition of Done)

- [ ] Componente `EstoqueFiltrosChipsMobile` implementado com rolagem horizontal.
- [ ] Componente `EstoqueFiltrosBottomSheet` implementado com suporte a gestos de arrastar para fechar.
- [ ] Schema Zod `consultarSaldosQuerySchema` utilizado para validação dos filtros.
- [ ] Debounce de busca implementado sem travamento da UI nativa.
- [ ] Testes de componentes cobrindo seleção de chip e abertura/fechamento do bottom sheet.
