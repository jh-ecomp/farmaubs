# ES-11 test(estoque): Suíte Integrada Playwright BDD e E2E Full-Stack do Módulo de Controle de Estoque

---

- **Épico**: Controle de Estoque (RF005, RF009, RF011, RF018, RF020, RF022, RF023, RF028)
- **Camada**: Frontend Web (`apps/frontend`) — Camada D e E2E Full-Stack (Camadas C + D)
- **Requisitos Funcionais**: RF009/RF011 (Ajustes Manuais Justificados), RF018 (Cards de Criticidade), RF020 (Relatório de Perdas XLSX), RF022 (Destaque Laranja de Validade), RF028 (Ficha de Rastreabilidade do Lote)
- **ADRs Vinculadas**: ADR-011 (React 19 + Tailwind CSS), ADR-022 (`@farmaubs/shared`), ADR-030 (Estratégia de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-035 (Moonrepo)

---

## 1. História de usuário

> **Como** engenheiro de software do FarmaUBS,  
> **quero** consolidar e migrar toda a validação de frontend do Épico 4 (`ES-06` a `ES-10`) para uma suíte automatizada em **Gherkin (pt-BR)** com **Playwright + `playwright-bdd`** nas modalidades **Sistema de Frontend** (`moon run frontend:test-bdd`) e **E2E Full-Stack** (`moon run frontend:test-e2e`), substituindo mocks estáticos de JSDOM/Vitest,  
> **para que** o contraste real do alerta laranja (`RF022`), a expansão em cascata de lotes, o ajuste transacional justificado (`RF009`/`RF011`), a linha do tempo de rastreabilidade (`RF028`) e o download do relatório `.xlsx` (`RF020`) sejam verificados de ponta a ponta no navegador real.

---

## 2. Escopo técnico e funcionalidades do Playwright aplicadas

1. **Cobertura consolidada das histórias `ES-06` a `ES-10`**:
   - **Cards de Métricas e Filtro Rápido (`ES-06`)**: Clique no card laranja de validade no mês corrente filtrando imediatamente a tabela principal.
   - **Tabela de Saldos e Contraste Real do Badge Laranja (`ES-07`)**: Expansão do accordion por medicamento e auditoria de contraste computado via `@axe-core/playwright`.
   - **Barra de Filtros com Debounce (`ES-08`)**: Avanço de 300ms no `page.clock` para busca textual sem espera artificial.
   - **Modal de Ajuste Rápido e Ficha de Rastreabilidade (`ES-09`)**: Submissão de baixa por avaria, bloqueio de motivo `"Outro"` com menos de 20 caracteres e conferência imediata do evento na linha do tempo do lote.
   - **Exportação de Relatório de Perdas `.xlsx` (`ES-10`)**: Captura real do stream binário via `page.waitForEvent('download')`.

---

## 3. Estrutura técnica dos arquivos BDD

- **Modalidade 1 — Teste de Sistema de Frontend (`moon run frontend:test-bdd`)**:
  - `apps/frontend/e2e/features/sistema/estoque-saldos-ajustes-sistema.feature`
  - `apps/frontend/e2e/features/sistema/estoque-relatorios-sistema.feature`
- **Modalidade 2 — Teste E2E Full-Stack (`moon run frontend:test-e2e`)**:
  - `apps/frontend/e2e/features/fullstack/estoque-fullstack.feature`
- **Step Definitions**:
  - `apps/frontend/e2e/steps/estoque.steps.ts`

---

## 4. Cenários de teste em BDD (Gherkin — camada D & E2E)

```gherkin
# language: pt
Funcionalidade: Jornada Completa de Controle de Estoque, Ajuste Justificado e Relatórios XLSX (ES-06 a ES-10)

  Cenário: Filtragem por card de validade no mês corrente, expansão de lote com badge laranja e auditoria WCAG 2.1 AA
    Dado que o farmacêutico autenticado acessa o painel de Controle de Estoque da UBS
    Quando ele clicar no cartão "Lotes Vencendo no Mês"
    E expandir a linha do medicamento filtrado na tabela de saldos
    Então o lote correspondente deve exibir o badge de validade na cor laranja
    E a tela de estoque não deve apresentar violações de contraste ou acessibilidade WCAG 2.1 AA

  Cenário: Ajuste rápido de saída por avaria com reflexo imediato na Ficha de Rastreabilidade e exportação XLSX
    Dado que o farmacêutico expandiu os lotes do medicamento "Losartana Potássica 50mg"
    Quando ele acionar "Ajuste (+/-)" no lote "LT-LOS-01", registrar saída de 2 unidades por "Avaria Física / Quebra" e confirmar
    Então o saldo do lote na tabela deve ser decrementado em 2 unidades
    E ao abrir a "Ficha de Rastreabilidade" daquele lote, o ajuste recém-realizado deve constar no topo da linha do tempo
    Quando ele abrir o modal "Exportar (.xlsx)" e baixar o relatório de "Perdas por Vencimento e Avarias"
    Então o arquivo Excel ".xlsx" deve ser baixado nativamente pelo navegador
```

---

## 5. Checklist de DoD e aceitação

- [x] Suíte `.feature` de Sistema de Frontend e E2E Full-Stack implementada para `ES-06` a `ES-10` sem dependência de mocks de serviços em JSDOM.
- [x] Auditoria `@axe-core/playwright` aprovada validando o contraste do alerta laranja (`RF022`).
- [x] Download nativo de `.xlsx` e atualização de saldo/rastreabilidade validados em `moon run frontend:test-bdd` e `moon run frontend:test-e2e`.
