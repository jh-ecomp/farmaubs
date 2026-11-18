# AL-09 test(alertas): Suíte Integrada Playwright BDD e E2E Full-Stack do Módulo de Alertas, Notificações e Parâmetros

---

- **Épico**: Alertas, Notificações e Parâmetros Operacionais (RF022, RF023, RF024, RF026, RF027, RF028)
- **Camada**: Frontend Web (`apps/frontend`) — Camada D e E2E Full-Stack (Camadas C + D)
- **Requisitos Funcionais**: RF022 (Alertas de Vencimento Próximo), RF023 (Alertas de Risco de Ruptura por Cobertura), RF024 (Confirmação Bloqueante para Validade Curta < 6 meses), RF027 (Parâmetros Operacionais da UBS)
- **ADRs Vinculadas**: ADR-006 (RBAC), ADR-011 (React 19 + Tailwind CSS v4), ADR-030 (Estratégia de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-035 (Moonrepo)

---

## 1. História de usuário

> **Como** engenheiro de software do FarmaUBS,  
> **quero** consolidar e migrar toda a validação de frontend do Épico 6 (`AL-05` a `AL-08`) para uma suíte automatizada em **Gherkin (pt-BR)** com **Playwright + `playwright-bdd`** nas modalidades **Sistema de Frontend** (`moon run frontend:test-bdd`) e **E2E Full-Stack** (`moon run frontend:test-e2e`), em vez de testes isolados em Vitest/JSDOM,  
> **para que** o sino de notificações no cabeçalho (`AL-05`), a Central de Alertas em duas abas (`AL-06`), o simulador de parâmetros operacionais com trava RBAC (`AL-07`) e o modal bloqueante de recebimento com validade curta `< 180 dias` (`AL-08` / `RF024`) sejam validados de ponta a ponta no navegador real.

---

## 2. Escopo técnico e funcionalidades do Playwright aplicadas

1. **Cobertura consolidada das histórias `AL-05` a `AL-08`**:
   - **Sino de Notificações e Drawer Rápido (`AL-05`)**: Verificação do badge numérico por severidade (`bg-red-600` vs `bg-amber-500`), fechamento por tecla `Escape` e invalidação reativa após movimentações de estoque.
   - **Central de Alertas em Duas Abas (`AL-06`)**: Navegação por teclado entre as abas `"Próximos ao Vencimento"` e `"Risco de Ruptura"` (`role="tablist"`), acionamento dos atalhos operacionais (`"Priorizar na Dispensação (FEFO)"` e `"Baixar por Vencimento"`) e auditoria de contraste WCAG 2.1 AA com `@axe-core/playwright`.
   - **Simulador e RBAC de Parâmetros da UBS (`AL-07`)**: Edição dinâmica da equação `Lead Time CAF + Estoque de Segurança` pelo `FARMACEUTICO_RESPONSAVEL` e verificação de modo somente leitura para `FARMACEUTICO_RESIDENTE`.
   - **Widget no Dashboard e Confirmação Bloqueante de Validade Curta `< 180 dias` (`AL-08`, `RF024`)**: Congelamento de data via `page.clock` para testar a exigência do aceite explícito (`confirmacaoValidadeCurta: true`) no recebimento de lotes com vencimento inferior a 6 meses.

---

## 3. Estrutura técnica dos arquivos BDD

- **Modalidade 1 — Teste de Sistema de Frontend (`moon run frontend:test-bdd`)**:
  - `apps/frontend/e2e/features/sistema/alertas-sino-central-sistema.feature`
  - `apps/frontend/e2e/features/sistema/alertas-parametros-validade-curta-sistema.feature`
- **Modalidade 2 — Teste E2E Full-Stack (`moon run frontend:test-e2e`)**:
  - `apps/frontend/e2e/features/fullstack/alertas-fullstack.feature`
- **Step Definitions**:
  - `apps/frontend/e2e/steps/alertas.steps.ts`

---

## 4. Cenários de teste em BDD (Gherkin — camada D & E2E)

```gherkin
# language: pt
Funcionalidade: Jornada Completa de Alertas de Vencimento, Ruptura, Parâmetros da UBS e Validade Curta (AL-05 a AL-08)

  Cenário: Recálculo imediato de alertas ao alterar parâmetros operacionais da UBS pelo Farmacêutico Responsável
    Dado que o farmacêutico responsável autenticado acessou a "Central de Alertas"
    Quando ele abrir "Configurar Parâmetros da UBS", alterar o "Tempo Médio de Entrega da CAF" para "20" dias e salvar
    Então o simulador deve ter exibido o novo ponto crítico antes do envio
    E o contador do sino no cabeçalho e a aba "Risco de Ruptura" devem atualizar imediatamente os itens em alerta
    E a tela não deve apresentar violações críticas de acessibilidade WCAG 2.1 AA

  Cenário: Bloqueio e confirmação obrigatória no recebimento de lote com validade inferior a 6 meses (RF024)
    Dado que o farmacêutico está registrando uma entrada de medicamento com validade para daqui a 120 dias
    Quando ele tentar finalizar o recebimento
    Então o modal bloqueante de validade curta deve exigir a marcação da caixa de ciência antes de enviar "confirmacaoValidadeCurta: true"
```

---

## 5. Checklist de DoD e aceitação

- [ ] Suíte `.feature` de Sistema de Frontend e E2E Full-Stack implementada para `AL-05` a `AL-08` usando Playwright + `playwright-bdd`.
- [ ] Validação de RBAC (`FARMACEUTICO_RESPONSAVEL` vs `FARMACEUTICO_RESIDENTE`), confirmação de validade curta (`RF024`) e recálculo reativo do sino aprovados.
- [ ] Auditoria `@axe-core/playwright` sem violações WCAG 2.1 AA em `moon run frontend:test-bdd` e `moon run frontend:test-e2e`.
