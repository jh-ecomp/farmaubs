# DI-07 feat(dispensacao): Busca Textual de Medicamentos e Seletor de Lotes FEFO com alertas de índice terapêutico

---

- **Épico**: Dispensação de Medicamentos (RF010, NF009, NF010)
- **Requisitos Funcionais**: RF010 (Seleção de Medicamentos e Sugestão FEFO)
- **Requisitos Não-Funcionais**: NF001 (Microinterações Fluídas), NF010 (Busca Rápida com Debounce)
- **ADRs Vinculadas**: ADR-011 (React 19 + Tailwind CSS), ADR-013 (TanStack Query), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança e Orquestração com Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico registrando itens na dispensação da UBS,  
> **quero** buscar medicamentos através de uma caixa de pesquisa textual inteligente com autocompletar (sem depender de leitor óptico no MVP), visualizar imediatamente o lote recomendado por FEFO e ter a liberdade de selecionar outro lote físico em estoque,  
> **para que** eu possa incluir o item na dispensação rapidamente, priorizar lotes com validade próxima e ser alertado sobre medicamentos de índice terapêutico estreito ou validade curta (RF010, NF010).

---

## 2. Regras de negócio e casos de borda

1. **Busca Textual sem Leitor de Código de Barras**:
   - Campo de entrada com pesquisa instantânea com debounce de 250ms.
   - A pesquisa filtra simultaneamente por princípio ativo, nome comercial ou forma farmacêutica (ex.: ao digitar "losar" ou "50mg", exibe "Losartana Potássica 50mg - Comprimido").
   - Dropdown acessível com navegação pelas teclas de seta (`ArrowDown`, `ArrowUp`) e seleção com `Enter`.

2. **Apresentação e Pré-seleção Automática do Lote FEFO**:
   - Ao selecionar um medicamento, o componente consulta a rota `/api/v1/dispensacao/medicamentos/:id/lotes-fefo`.
   - O lote com vencimento mais próximo é pré-selecionado automaticamente por padrão, com badge de destaque verde:  
     `[Sugerido pelo Sistema (FEFO)] Lote: LOT-2026-X | Validade: 15/11/2026 | Saldo: 120 un.`
   - O farmacêutico pode clicar em "Trocar Lote" para abrir um seletor visual com todos os lotes que possuem saldo disponível na UBS (ex.: caso já haja um lote com embalagem aberta na bancada).

3. **Badges de Alerta Clínico e de Validade**:
   - **Validade Curta (< 30 dias)**: Tag destacada em laranja/âmbar `⚠️ Vence em X dias`.
   - **Índice Terapêutico Estreito** (ex.: Digoxina, Lítio, Varfarina, Carbamazepina): Badge roxo/azul informando `Atenção: Medicamento de Índice Terapêutico Estreito — oriente a posologia e confirme a dosagem`.
   - **Lotes com saldo zero ou vencidos**: Não são selecionáveis e aparecem desabilitados visualmente com texto explicativo.

4. **Entrada de Quantidade**:
   - Campo numérico com validação em tempo real:
     - Quantidade mínima: 1 unidade.
     - Quantidade máxima permitida: não pode ultrapassar o saldo disponível no lote selecionado.
     - Botões rápidos de acréscimo (+1, +10, +30) para agilizar o lançamento de cartelas completas.

---

## 3. Contratos de dados e protocolo HTTP

### 3.1 Consumo no Frontend (`catalogo.service.ts`)
- `GET /api/v1/dispensacao/medicamentos?busca={termo}`: Retorna lista de `MedicamentoBuscaDto`.
- `GET /api/v1/dispensacao/medicamentos/:id/lotes-fefo`: Retorna `SugestaoFefoResultado`.

### 3.2 Compartilhamento Arquitetural com `@farmaubs/shared` e App Mobile (`apps/mobile` - DI-MOB-02)
- **Contratos e Tipos Exportados em `packages/shared/src/dispensacao/catalogo.types.ts`**:
  - `MedicamentoBuscaDto`: `{ id: string; nomeComercial: string; principioAtivo: string; formaFarmaceutica: string; antimicrobiano: boolean; indiceTerapeuticoEstreito: boolean }`.
  - `LoteEstoqueDto`: `{ id: string; numeroLote: string; dataValidade: string; saldoDisponivel: number; diasAteVencimento: number; sugeridoFefo: boolean }`.
  - `SugestaoFefoResultado`: `{ medicamentoId: string; loteSugerido: LoteEstoqueDto; outrosLotes: LoteEstoqueDto[] }`.
- **Regras Puras Reutilizáveis**:
  - Cálculo de dias até vencimento (`calcularDiasAteVencimento(dataValidade: string): number`).
  - Classificação visual de criticidade de lote (`obterCriticidadeValidade(dias: number): 'NORMAL' | 'ALERTA' | 'CRITICO' | 'VENCIDO'`).
- **Paridade com Mobile**:
  - Web (`apps/frontend`) e Mobile (`apps/mobile` - `DI-MOB-02`) compartilham os mesmos contratos de busca e regras de ordenação FEFO, variando exclusivamente a camada de apresentação (HTML/Tailwind vs React Native `<FlatList>` com touch cards).
- **Diretrizes para Ciclos Independentes de Desenvolvimento**:
  - *Cenário A (Mobile já implementou DI-MOB-02)*: O Frontend Web consome diretamente as tipagens de `MedicamentoBuscaDto`, `LoteEstoqueDto` e as funções utilitárias `calcularDiasAteVencimento` e `obterCriticidadeValidade` já testadas em `@farmaubs/shared`.
  - *Cenário B (Mobile ainda NÃO implementou DI-MOB-02)*: O Frontend Web define e exporta as interfaces e helpers puros em `packages/shared/src/dispensacao/catalogo.types.ts`, assegurando que o time Mobile tenha o algoritmo FEFO e badges prontos para uso.

---

## 4. Escopo Técnico da implementação

### Frontend (`apps/frontend/src/`)
- **`components/dispensacao/BuscaMedicamentoInput.tsx`**:
  - Campo de busca textual com autocomplete, estado de carregamento e lista suspensa acessível (`role="listbox"` e `aria-activedescendant`).
- **`components/dispensacao/SeletorLoteFefo.tsx`**:
  - Exibição do lote sugerido com botão de alternância manual para dropdown com os demais lotes disponíveis.
- **`components/dispensacao/AlertaIndiceTerapeutico.tsx`**:
  - Banner informativo clínico para medicamentos críticos.
- **Testes da Camada D**:
  - `components/dispensacao/BuscaMedicamentoInput.spec.tsx`: Testar busca textual com debounce, navegação via teclado e seleção de item.
  - `components/dispensacao/SeletorLoteFefo.spec.tsx`: Testar pré-seleção automática do lote FEFO e alternância manual para outro lote.

---

## 5. Cenários de teste em BDD (Gherkin — camada D)

```gherkin
# language: pt
Funcionalidade: Busca Textual e Seleção de Lote FEFO (Camada D)

  Cenário: Busca textual de medicamento sem uso de código de barras
    Dado que o farmacêutico está na tela de dispensação
    Quando digitar "paracetamol" no campo de busca de medicamentos
    Então a lista suspensa deve sugerir os medicamentos correspondentes
    E o usuário pode selecionar o item pressionando a tecla Enter

  Cenário: Pré-seleção automática do lote com vencimento mais próximo (FEFO)
    Dado que o medicamento selecionado possui dois lotes com saldos positivos
    Quando os lotes forem carregados na tela
    Então o lote com a data de validade mais próxima deve vir marcado como sugerido
    E o botão de adicionar deve utilizar esse lote por padrão

  Cenário: Limitação da quantidade digitada ao saldo físico do lote
    Dado que o lote selecionado possui saldo de 20 comprimidos
    Quando o farmacêutico digitar "25" no campo de quantidade
    Então o sistema deve exibir alerta de saldo insuficiente
    E o botão de adicionar item ao atendimento deve ficar desabilitado
```

---

## 6. Checklist de DoD e aceitação

- [ ] Campo de busca puramente textual sem dependência de hardware de leitura de código de barras.
- [ ] Lote com menor data de validade pré-selecionado por padrão com badge FEFO.
- [ ] Possibilidade de trocar manualmente o lote para outro com saldo positivo.
- [ ] Alertas visuais para medicamentos de validade curta e índice terapêutico estreito.
- [ ] Testes da Camada D (Vitest) aprovados com cobertura de interação e acessibilidade.
