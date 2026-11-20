# IN-09 test(inventario): Suíte Integrada Playwright BDD e E2E Full-Stack do Módulo de Inventário Mensal

---

- **Épico**: Inventário Mensal (RF009, RF011, RF013, RF014, RF021, RF028, NF005, NF008)
- **Camada**: Frontend Web (`apps/frontend`) — Camada D e E2E Full-Stack (Camadas C + D)
- **Requisitos Funcionais**: RF013 (Contagem Física e Conciliação de Divergências), RF014 (Histórico de Ciclos), RF021 (Ata Oficial e Relatório Mensal XLSX), RF028 (Auditoria de Homologação)
- **Requisitos Não-Funcionais**: NF005 (Autosave Contínuo e Resiliência a Falhas de Rede), NF008 (Emissão Rápida de Ata e Planilha)
- **ADRs Vinculadas**: ADR-011 (React 19 + Tailwind CSS), ADR-014 (Resiliência Offline), ADR-030 (Estratégia de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-035 (Moonrepo)

---

## 1. História de usuário

> **Como** engenheiro de software do FarmaUBS,  
> **quero** consolidar e migrar toda a validação de frontend do Épico 5 (`IN-05` a `IN-08`) para especificações executáveis em **Gherkin (pt-BR)** com **Playwright + `playwright-bdd`** nas modalidades **Sistema de Frontend** (`moon run frontend:test-bdd`) e **E2E Full-Stack** (`moon run frontend:test-e2e`),  
> **para que** o autosave de rascunho com `page.clock` e queda simulada de rede (`context.setOffline`), a exigência de 15 caracteres para o motivo `"Outros"`, a homologação atômica, a impressão A4 da Ata Oficial (`page.emulateMedia({ media: 'print' })`) e o download `.xlsx` sejam validados no navegador real.

---

## 2. Escopo técnico e funcionalidades do Playwright aplicadas

1. **Cobertura consolidada das histórias `IN-05` a `IN-08`**:
   - **Visão Geral e Abertura de Ciclo (`IN-05`)**: Validação de barra de progresso acessível (`role="progressbar"`) e congelamento do snapshot inicial.
   - **Autosave e Resiliência de Rede (`IN-06`, `NF005`, `ADR-014`)**: Uso de `page.clock` para avançar o debounce de salvamento automático e `context.setOffline(true)` / `setOffline(false)` para garantir que nenhuma contagem digitada na bancada seja perdida durante oscilações de rede.
   - **Mapa de Conciliação e Regra `"Outros"` (`IN-07`)**: Validação em tempo real da trava de homologação enquanto houver divergência sem justificativa ou com motivo `"Outros"` inferior a 15 caracteres.
   - **Homologação, Impressão CSS Print da Ata Oficial e Download `.xlsx` (`IN-08`)**: Uso de `page.emulateMedia({ media: 'print' })` para validar o isolamento visual de `#ataOficialPrintArea` e `page.waitForEvent('download')` para a planilha do inventário.

---

## 3. Estrutura técnica dos arquivos BDD

- **Modalidade 1 — Teste de Sistema de Frontend (`moon run frontend:test-bdd`)**:
  - `apps/frontend/e2e/features/sistema/inventario-contagem-conciliacao-sistema.feature`
  - `apps/frontend/e2e/features/sistema/inventario-homologacao-ata-sistema.feature`
- **Modalidade 2 — Teste E2E Full-Stack (`moon run frontend:test-e2e`)**:
  - `apps/frontend/e2e/features/fullstack/inventario-fullstack.feature`
- **Step Definitions**:
  - `apps/frontend/e2e/steps/inventario.steps.ts`

---

## 4. Cenários de teste em BDD (Gherkin — camada D & E2E)

```gherkin
# language: pt
Funcionalidade: Ciclo Completo de Inventário Mensal, Autosave, Conciliação e Ata Oficial A4 (IN-05 a IN-08)

  Cenário: Contagem física com autosave contínuo e retenção local durante oscilação de rede (NF005)
    Dado que o farmacêutico iniciou um ciclo de inventário mensal na UBS
    Quando ele digitar a quantidade física "45" para o lote "LT-DIP-01" e o relógio avançar 1 segundo
    Então o indicador deve confirmar "Todas as contagens salvas em rascunho"
    Quando a conexão do navegador ficar temporariamente offline ("setOffline: true") e ele digitar "18" no próximo lote
    Então o valor digitado deve ser preservado na tela com aviso de sincronização pendente até a reconexão

  Cenário: Conciliação com motivo "Outros", homologação do ciclo, impressão A4 da Ata Oficial e exportação XLSX
    Dado que o ciclo possui uma divergência de falta de 5 unidades no lote "LT-AMX-02"
    Quando o farmacêutico selecionar o motivo "Outros" e preencher "Entrega da CAF descarregada no plantao anterior sem guia"
    E confirmar a homologação do inventário no modal de fechamento
    Então o modal da Ata Oficial deve ser exibido com o código de integridade SHA-256
    E ao emular a mídia de impressão ("media: print"), apenas "#ataOficialPrintArea" deve permanecer visível
    E ao clicar em "Baixar Planilha (.xlsx)", o relatório de inventário deve ser baixado pelo navegador
```

---

## 5. Checklist de DoD e aceitação

- [ ] Suíte `.feature` de Sistema de Frontend e E2E Full-Stack implementada para `IN-05` a `IN-08` usando Playwright + `playwright-bdd`.
- [ ] Testes de autosave (`page.clock`), queda de conexão (`context.setOffline`), impressão A4 (`page.emulateMedia({ media: 'print' })`) e download `.xlsx` aprovados.
- [ ] Auditoria `@axe-core/playwright` sem violações WCAG 2.1 AA em `moon run frontend:test-bdd` e `moon run frontend:test-e2e`.
