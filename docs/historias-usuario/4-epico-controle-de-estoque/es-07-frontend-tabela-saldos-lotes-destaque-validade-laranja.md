# ES-07: Tabela Principal de Saldos: Visão por Medicamento, Expansão de Lotes e Badges de Validade em Laranja

---

- **Épico**: Controle de Estoque (RF005, RF006, RF007, RF009, RF011, RF018, RF020, RF022, RF023, RF028, NF001, NF002, NF003, NF007, NF009, NF015)
- **Requisitos Funcionais**: RF005 (Catálogo de Medicamentos e Apresentações), RF022 (Alerta Visual de Validade em Laranja)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva com Expansão em Cascata), NF002 (Design Responsivo em Tablets e Desktops), NF007 (Performance de Renderização)
- **ADRs Vinculadas**: ADR-011 (React 19 + Tailwind CSS), ADR-013 (TanStack Query), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de Usuário

> **Como** farmacêutico ou operador de farmácia da UBS,  
> **quero** visualizar os saldos de medicamentos da unidade em uma tabela limpa e responsiva, com agrupamento por medicamento e capacidade de expandir as linhas para inspecionar os lotes individuais, identificando imediatamente os lotes com vencimento no mês corrente através de badges destacados na cor laranja,  
> **para que** eu possa consultar rapidamente o estoque de bancada e priorizar os lotes com validade crítica durante a rotina diária (RF005, RF022).

---

## 2. Regras de Negócio e Casos de Borda

1. **Estrutura Hierárquica em Cascata (Accordion)**:
   - **Linha Principal (Medicamento)**:
     - Coluna 1: Nome do Medicamento, Concentração e Forma Farmacêutica;
     - Coluna 2: Princípio Ativo (DCI);
     - Coluna 3: Categoria Clínica da REMUME (badge neutro);
     - Coluna 4: Saldo Total na UBS (soma de todos os lotes);
     - Coluna 5: Status de Estoque (badge verde "Regular", âmbar "Baixo Estoque", vermelho "Zerado");
     - Coluna 6: Botão expansor com chevron (`aria-expanded="true/false"` e `aria-controls`).
   - **Subtabela Expandida (Lotes Físicos daquele Medicamento)**:
     - Detalha cada lote cadastrado com saldo na UBS:
       - Código do Lote (com fonte monoespaçada);
       - Fabricante / Laboratório (ex.: EMS, Prati-Donaduzzi, Fiocruz);
       - Data de Validade no formato `DD/MM/AAAA`;
       - **Badge Semântico de Validade**:
         - **Laranja vibrante** (`bg-amber-100 text-amber-800 border-amber-300`): Lote com vencimento no **mês corrente** ou em prazo inferior a 90 dias (conforme deliberação de 29/09/2026);
         - **Verde** (`bg-emerald-100 text-emerald-800`): Lote com validade regular (> 90 dias);
         - **Vermelho** (`bg-rose-100 text-rose-800`): Lote vencido com saldo remanescente;
       - Saldo físico individual do lote;
       - Ações por lote: botão "Ajuste Rápido (+/-)" e botão "Ficha de Rastreabilidade".

2. **Ordenação Inteligente dos Lotes (FEFO)**:
   - Os lotes no interior da linha expandida são ordenados prioritariamente por **data de validade crescente** (os que vencem primeiro aparecem no topo), facilitando a separação física correta na prateleira.

3. **Controles de Paginação Acessíveis**:
   - Rodapé com indicador de página atual, total de registros e botões de navegação ("Anterior", "Próxima") com navegação por teclado e rótulos `aria-label`.

---

## 3. Escopo Técnico & Arquitetural

- **Camada**: D (Testes de Componentes React).
- **Componente**: `apps/frontend/src/features/estoque/components/TabelaSaldosEstoque.tsx`.
- **Props**:
  - `medicamentos: MedicamentoSaldoItemDto[]`;
  - `carregando: boolean`;
  - `onAbrirAjuste: (lote: LoteEstoqueDto, medicamento: MedicamentoSaldoItemDto) => void`;
  - `onAbrirRastreabilidade: (lote: LoteEstoqueDto, medicamento: MedicamentoSaldoItemDto) => void`.

### Compartilhamento Arquitetural com @farmaubs/shared e App Mobile (apps/mobile - ES-MOB-02)
- **Modelos e DTOs Unificados**: Os tipos `MedicamentoSaldoItemDto`, `LoteEstoqueDto` e o enum `StatusValidadeLote` residem em `@farmaubs/shared/src/contracts/estoque/`.
- **Lógica de Agrupamento e Ordenação FEFO**: O utilitário `ordenarLotesPorFEFO(lotes)` e o avaliador de status de validade `calcularStatusValidade(validadeDate)` são funções puras exportadas de `@farmaubs/shared/src/domain/estoque/fefo-helpers.ts`. No mobile, em vez de uma tabela desktop com accordion, o componente equivalente `SaldosEstoqueListMobile` usa cards táteis expansíveis com touch targets otimizados (44x44pt).
- **Padronização Visual**: A cor de alerta laranja de vencimento próximo (`#D97706` / `text-amber-700`) é compartilhada entre tokens web e mobile para consistência visual da marca FarmaUBS.
- **Diretrizes para Ciclos Independentes de Desenvolvimento**:
  - *Cenário A (Mobile já implementou ES-MOB-02)*: O Frontend Web consome diretamente `MedicamentoSaldoItemDto`, `LoteEstoqueDto` e a função pura `ordenarLotesPorFEFO` já testada em `@farmaubs/shared`.
  - *Cenário B (Mobile ainda NÃO implementou ES-MOB-02)*: O Frontend Web publica as tipagens e helpers de FEFO em `packages/shared/src/domain/estoque/fefo-helpers.ts`, assegurando que a lista mobile tenha o contrato pronto.

---

## 4. Critérios de Aceite (Gherkin BDD)

### Cenário 1: Expansão de linha de medicamento e exibição de badge laranja para lote do mês corrente
```gherkin
Dado que o medicamento "Losartana Potássica 50mg" possui 2 lotes cadastrados
E o lote "LT-LOS-01" vence no mês corrente e o lote "LT-LOS-02" vence daqui a 1 ano
Quando o farmacêutico clicar no botão de expandir da linha da Losartana
Então a subtabela de lotes deve ser exibida
E o lote "LT-LOS-01" deve apresentar o badge de validade com a cor laranja
E o lote "LT-LOS-02" deve apresentar o badge de validade com a cor verde
```

### Cenário 2: Acionamento do botão de ajuste rápido na linha do lote
```gherkin
Dado que a subtabela do lote "LT-LOS-01" está expandida
Quando o usuário clicar no botão de ação "Ajuste (+/-)" daquele lote
Então o callback "onAbrirAjuste" deve ser acionado recebendo os dados do lote e do produto
```

---

## 5. Definition of Done (DoD)

- [ ] Tabela implementada em React 19 com suporte a expansão e colapso de linhas.
- [ ] Badges de validade implementados com a cor laranja acordada e contraste WCAG 2.1 AA (> 4.5:1).
- [ ] Testes de componentes (Camada D) validando comportamento do accordion, renderização condicional de badges e eventos de clique.
