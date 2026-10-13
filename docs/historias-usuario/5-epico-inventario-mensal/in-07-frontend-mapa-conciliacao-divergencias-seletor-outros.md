# IN-07: Mapa de Conciliação e Divergências: Comparativo em Tempo Real, Seletor de Justificativas e Campo Livre para "Outros"

---

- **Épico**: Inventário Mensal (RF009, RF011, RF013, RF014, RF021, RF028, NF001, NF002, NF003, NF005, NF007, NF008, NF009, NF015)
- **Requisitos Funcionais**: RF013 (Realizar Inventário Mensal - Mapa de Divergências)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva com Semântica de Cores), NF002 (Design Responsivo), NF007 (Feedback Instantâneo)
- **ADRs Vinculadas**: ADR-011 (React 19 + Tailwind CSS), ADR-013 (TanStack Query), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de Usuário

> **Como** farmacêutico responsável pela farmácia da UBS,  
> **quero** acessar o mapa de conciliação do inventário ativo exibindo o comparativo lado a lado entre o saldo teórico e a contagem física, selecionar o motivo sanitário para cada discrepância e dispor de um campo descritivo livre obrigatório caso selecione a opção "Outros",  
> **para que** eu possa justificar detalhadamente todas as sobras e faltas antes de submeter o ciclo para homologação final (RF013).

---

## 2. Regras de Negócio e Casos de Borda

1. **Colunas do Mapa de Conciliação**:
   - `Medicamento & Apresentação`: Nome comercial e princípio ativo;
   - `Lote & Validade`: Código do lote físico e data de vencimento;
   - `Estoque Teórico`: Quantidade congelada na abertura do ciclo;
   - `Contagem Física`: Quantidade digitada pelo conferente;
   - `Diferença (Divergência)`:
     - `0`: Badge verde "Conforme";
     - `+X`: Badge azul suave com sinal de positivo indicando Sobra;
     - `-X`: Badge vermelho com sinal de negativo indicando Falta;
   - `Motivo Sanitário`: Dropdown com as opções padronizadas do sistema;
   - `Justificativa Textual`: Campo de texto inline ou expansível com contador de caracteres.

2. **Comportamento Dinâmico do Seletor "Outros" (Deliberação de 29/09/2026)**:
   - Ao selecionar a opção `OUTROS` no dropdown de motivo:
     - Um campo de texto expandido em destaque surge abaixo da linha;
     - O campo exibe aviso em vermelho: `"O motivo 'Outros' exige detalhamento obrigatório (mínimo de 15 caracteres)"`;
     - A interface exibe contador de caracteres em tempo real (ex.: `12/15 caracteres`);
     - A linha é considerada pendente enquanto o texto tiver menos de 15 caracteres.

3. **Filtros Rápidos do Mapa**:
   - `Todos os Itens`;
   - `Apenas Divergências` (filtra itens com $\text{divergência} \neq 0$);
   - `Pendentes de Justificativa` (filtra itens divergentes que ainda não possuem motivo e justificativa válidos);
   - `Itens Conformes` ($\text{divergência} = 0$).

4. **Painel Inferior de Validação para Homologação**:
   - Exibe sumário em tempo real:
     - Total de Sobras (em unidades físicas);
     - Total de Faltas (em unidades físicas);
     - **Contador Bloqueante de Pendências**: `"X divergências ainda precisam de justificativa para habilitar a homologação"`.

---

## 3. Escopo Técnico & Arquitetural

- **Camada**: D (Testes de Componentes React).
- **Componente Principal**: `apps/frontend/src/features/inventario/components/MapaConciliacaoTabela.tsx`.
- **Props**:
  - `cicloId: string`;
  - `onDivergenciasSaneadasChange?: (todasSaneadas: boolean) => void`.

### Compartilhamento Arquitetural com @farmaubs/shared e App Mobile (apps/mobile - IN-MOB-03)
- **Contratos e Schemas de Justificativa**: Os tipos `InventarioDivergenciaItemDTO`, o enum `MotivoDivergenciaInventario` e o schema Zod `justificarDivergenciaSchema` residem em `@farmaubs/shared/src/contracts/inventario/`.
- **Validação de Mínimo de Caracteres**: A regra de negócio estrita que exige no mínimo 15 caracteres caso o motivo seja `OUTROS` é validada pelo Zod compartilhado, garantindo bloqueio idêntico no front-end web e no celular.
- **Ergonomia Mobile**: No app móvel (**IN-MOB-03**), as divergências são apresentadas em formato de lista de cards táteis com seletor nativo de motivo e bottom sheet para justificativa de texto com contador de caracteres.
- **Diretrizes para Ciclos Independentes de Desenvolvimento**:
  - *Cenário A (Mobile já implementou IN-MOB-03)*: O Frontend Web consome diretamente `InventarioDivergenciaItemDTO`, `MotivoDivergenciaInventario` e `justificarDivergenciaSchema` de `@farmaubs/shared`.
  - *Cenário B (Mobile ainda NÃO implementou IN-MOB-03)*: O Frontend Web publica o schema Zod com a regra de 15 caracteres mínimos para `OUTROS` em `packages/shared/src/contracts/inventario/`, garantindo que o app mobile aplique a mesma validação no input nativo.

---

## 4. Critérios de Aceite (Gherkin BDD)

### Cenário 1: Seleção do motivo "Outros" com abertura de campo livre obrigatório
```gherkin
Dado que o lote apresenta uma falta de 10 unidades
Quando o farmacêutico selecionar a opção "Outros" no dropdown de motivos
Então um campo de texto descritivo deve ser exibido com aviso de 15 caracteres mínimos
E a linha deve permanecer com indicador visual âmbar de pendência
Quando ele digitar "Entrega da CAF descarregada sem presenca do farmaceutico" (54 caracteres)
Então o contador deve indicar conformidade e a linha deve ser marcada como justificada
```

### Cenário 2: Filtro por itens pendentes de justificativa
```gherkin
Dado que o inventário possui 5 divergências, das quais 3 já foram justificadas
Quando o usuário acionar o filtro "Pendentes de Justificativa"
Então a tabela deve listar exclusivamente as 2 linhas que ainda carecem de preenchimento
E o painel inferior deve indicar: "2 divergências pendentes de justificativa"
```

---

## 5. Definition of Done (DoD)

- [ ] Tabela de conciliação implementada com semântica de cores de alto contraste (WCAG 2.1 AA).
- [ ] Validação estrita do motivo "Outros" com contagem dinâmica de caracteres e mensagens acessíveis via `aria-live`.
- [ ] Testes de componentes (Camada D) validando cálculo visual de divergência, comportamento do seletor "Outros" e filtros rápidos.
