# IN-06: Formulário de Contagem Física: Lançamento por Lote com Busca Inteligente e Salvamento Automático em Rascunho

---

- **Épico**: Inventário Mensal (RF009, RF011, RF013, RF014, RF021, RF028, NF001, NF002, NF003, NF005, NF007, NF008, NF009, NF015)
- **Requisitos Funcionais**: RF013 (Realizar Inventário Mensal - Contagem Física)
- **Requisitos Não-Funcionais**: NF001 (Interface Rápida de Bancada), NF002 (Design Responsivo), NF005 (Autosave em Rascunho sem Perda de Digitação)
- **ADRs Vinculadas**: ADR-011 (React 19 + Tailwind CSS), ADR-013 (TanStack Query e Context API), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de Usuário

> **Como** farmacêutico responsável ou residente da UBS,  
> **quero** uma interface ágil de conferência física na prateleira que permita buscar medicamentos por texto, lançar as quantidades físicas contadas por lote com salvamento automático contínuo em rascunho (autosave) e visualizar o feedback de divergência em tempo real,  
> **para que** eu execute a contagem das caixas sem receio de perder o trabalho caso ocorra instabilidade de rede ou o navegador seja fechado acidentalmente (RF013, NF005).

---

## 2. Regras de Negócio e Casos de Borda

1. **Mecanismo de Busca e Navegação por Itens**:
   - Barra de busca com debounce (300ms) permitindo filtrar a lista de itens do ciclo por nome comercial, princípio ativo ou código de lote.
   - Filtro de navegação rápida: "Todos", "Apenas Não Conferidos" (prioritário na rotina) e "Já Conferidos".

2. **Lançamento de Quantidade Física**:
   - Para cada lote listado:
     - Exibe identificação completa: Medicamento, Concentração, Fabricante, Código do Lote e Data de Validade;
     - Campo numérico `quantidadeFisica` com botões incrementais (`+` e `-`) e digitação direta;
     - O valor deve ser um inteiro maior ou igual a zero (`>= 0`).

3. **Persistência Contínua em Rascunho (Autosave - NF005)**:
   - Ao alterar o valor do campo numérico:
     - O componente atualiza o estado local imediatamente;
     - Dispara requisição de salvamento com debounce de 1 segundo para a rota `PUT /api/v1/inventario/ciclos/:id/itens/:itemId/contagem`;
     - Um indicador no topo da tela exibe o estado de sincronização:
       - `Salvando alterações...` (ícone de sincronização girando);
       - `Todas as contagens salvas em rascunho` (ícone de check verde e timestamp da última gravação);
       - `Aviso: Conexão instável — dados retidos localmente` (caso ocorra erro de rede temporário).

4. **Identificação Imediata de Divergência**:
   - Se a contagem física for divergente do saldo teórico, a linha do item recebe uma sutil borda colorida e exibe um botão de atalho `"Justificar Divergência"` que abre o modal/gaveta para seleção de motivo.

---

## 3. Escopo Técnico & Arquitetural

- **Camada**: D (Testes de Componentes e Fluxos React).
- **Componente Principal**: `apps/frontend/src/features/inventario/components/InventarioContagemForm.tsx`.
- **Hooks & Integrações**:
  - `useItensContagem(cicloId, filtros)`: TanStack Query;
  - `useSalvarContagemItem()`: Mutação com atualização otimista (optimistic update);
  - `useAutosaveInventario()`: Hook personalizado para controle de status e fila de sincronização.

### Compartilhamento Arquitetural com @farmaubs/shared e App Mobile (apps/mobile - IN-MOB-02)
- **Contratos e DTOs de Contagem**: O DTO `SalvarContagemItemInputDTO` e o schema Zod `salvarContagemItemSchema` são centralizados em `@farmaubs/shared/src/contracts/inventario/`.
- **Lógica Pura de Comparação de Divergência**: A regra `calcularDivergencia(saldoTeorico, quantidadeFisica)` que determina diferença (sobra ou falta) é exportada de `@farmaubs/shared/src/domain/inventario/divergencia-helpers.ts`.
- **Especialização Mobile**: O aplicativo mobile (**IN-MOB-02**) foi desenhado para ser o instrumento primário de contagem física nas prateleiras da farmácia, com botões incrementais táteis (+ / -) de 44x44pt, autosave com debounce em segundo plano e teclado numérico com controle de foco (`KeyboardAvoidingView`).
- **Diretrizes para Ciclos Independentes de Desenvolvimento**:
  - *Cenário A (Mobile já implementou IN-MOB-02)*: O Frontend Web consome diretamente `SalvarContagemItemInputDTO`, `salvarContagemItemSchema` e `calcularDivergencia` de `@farmaubs/shared`.
  - *Cenário B (Mobile ainda NÃO implementou IN-MOB-02)*: O Frontend Web publica as regras de autosave e DTOs em `packages/shared/src/contracts/inventario/`, servindo de modelo contratual para a contagem no smartphone.

---

## 4. Critérios de Aceite (Gherkin BDD)

### Cenário 1: Digitação de contagem e salvamento automático em rascunho
```gherkin
Dado que o farmacêutico está na tela de contagem do ciclo ativo
Quando ele digitar a quantidade física "45" no lote "LT-DIP-01"
Então o indicador de sincronização deve passar para "Salvando alterações..."
E após 1 segundo a requisição de atualização deve ser confirmada
E o indicador deve exibir "Todas as contagens salvas em rascunho" com ícone de check
```

### Cenário 2: Filtro por itens pendentes de conferência física
```gherkin
Dado que o ciclo possui 120 itens e 40 já foram contados
Quando o usuário acionar o filtro "Apenas Não Conferidos"
Então a lista na tela deve exibir exatamente os 80 itens que ainda estão com contagem nula
E o contador superior deve refletir a quantidade pendente
```

---

## 5. Definition of Done (DoD)

- [ ] Formulário de contagem implementado com inputs numéricos acessíveis e foco ordenado por teclado.
- [ ] Mecanismo de autosave com debounce e tratamento de erros de conexão com retenção em estado local.
- [ ] Testes de componentes (Camada D) validando cálculo de divergência na UI, disparo de requisição e persistência de dados.
