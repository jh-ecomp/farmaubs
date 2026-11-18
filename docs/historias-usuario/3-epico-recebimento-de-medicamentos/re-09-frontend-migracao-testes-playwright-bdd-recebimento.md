# RE-09 test(recebimento): Migração da Suíte de Testes de Frontend de Recebimento (Vitest -> Playwright BDD e E2E Full-Stack)

---

- **Épico**: Recebimento de Medicamentos (RF008, RF024, RF028, NF001, NF002, NF007)
- **Camada**: Frontend Web (`apps/frontend`) — Camada D e E2E Full-Stack (Camadas C + D)
- **Requisitos Funcionais**: RF008 (Entrada de Remessas CAF/DLOG), RF024 (Alerta de Validade Curta < 6 meses e Bloqueio de Vencidos), RF028 (Histórico Ontem/Hoje, Termo SUS A4, Exportação XLSX e Estorno)
- **Requisitos Não-Funcionais**: NF001 (Interface de Bancada), NF007 (Download Rápido)
- **ADRs Vinculadas**: ADR-011 (React 19 + Tailwind CSS), ADR-013 (TanStack Query), ADR-022 (`@farmaubs/shared`), ADR-030 (Estratégia de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-035 (Moonrepo)

---

## 1. História de usuário

> **Como** engenheiro de software do FarmaUBS,  
> **quero** migrar os testes de frontend do Épico 3 (Cabeçalho da Guia CAF `RE-05`, Busca de Produtos, Fabricante e Validade `RE-06`, Efetivação Transacional da Carga `RE-07` e Histórico com Termo SUS Impresso, Exportação `.xlsx` e Estorno `RE-08`) do Vitest para **Playwright + `playwright-bdd`**,  
> **para que** os cenários Gherkin de recebimento já especificados nas histórias `RE-05` a `RE-08` sejam validados no navegador real com emulação de impressão A4 (`@media print`), captura de download binário `.xlsx` e execução E2E Full-Stack.

---

## 2. Escopo da migração e funcionalidades do Playwright aplicadas

1. **Arquivos Vitest mapeados na transição**:
   - `apps/frontend/src/features/recebimento/components/CabecalhoRecebimentoForm.spec.tsx` (`RE-05`)
   - `apps/frontend/src/features/recebimento/components/ItemRecebimentoForm.spec.tsx` (`RE-06`)
   - `apps/frontend/src/features/recebimento/pages/RecebimentoPage.spec.tsx` (`RE-07`)
   - `apps/frontend/src/features/recebimento/components/HistoricoRecebimentosPainel.spec.tsx` (`RE-08`)
2. **Recursos nativos do Playwright exigidos**:
   - **Emulação de Folha de Impressão A4 (`page.emulateMedia({ media: 'print' })`)**: Validar que, ao abrir o modal do *Termo de Recebimento de Carga SUS* (`RE-08`), apenas `#termoRecebimentoPrintArea` permanece visível e elementos `.no-print` ficam ocultos.
   - **Download Binário Nativo (`page.waitForEvent('download')`)**: Validar a exportação real do arquivo `recebimentos_ubs_...xlsx`.
   - **Auditoria WCAG 2.1 AA (`@axe-core/playwright`)**: Validar acessibilidade e foco aprisionado nos modais de Termo SUS e de Estorno Justificado.

---

## 3. Estrutura técnica dos arquivos BDD

- **Modalidade 1 — Teste de Sistema de Frontend (`moon run frontend:test-bdd`)**:
  - `apps/frontend/e2e/features/sistema/recebimento-conferencia-sistema.feature`
  - `apps/frontend/e2e/features/sistema/historico-recebimento-sistema.feature`
- **Modalidade 2 — Teste E2E Full-Stack (`moon run frontend:test-e2e`)**:
  - `apps/frontend/e2e/features/fullstack/recebimento-fullstack.feature`
- **Step Definitions**:
  - `apps/frontend/e2e/steps/recebimento.steps.ts`

---

## 4. Cenários de teste em BDD (Gherkin — camada D & E2E)

```gherkin
# language: pt
Funcionalidade: Conferência de Guia CAF, Termo SUS A4, Exportação XLSX e Estorno (RE-05 a RE-08)

  Cenário: Registro completo de guia CAF com aviso de validade curta (< 180 dias) e efetivação da entrada
    Dado que o farmacêutico acessou a tela de recebimentos da UBS
    Quando ele preencher a guia "GUIA-CAF-2026/089" com origem "CAF Central"
    E adicionar o medicamento "Dipirona Sódica 500mg" do fabricante "Farmanguinhos" com lote "LT-DIP-99" e validade em 120 dias
    Então o alerta visual de validade curta deve ser exibido exigindo ciência do profissional
    Quando ele confirmar a ciência e clicar em "Finalizar e Confirmar Recebimento"
    Então a entrada deve ser gravada com sucesso e o formulário deve ser limpo

  Cenário: Emissão do Termo de Recebimento de Carga SUS com emulação de impressão A4 (@media print) e download XLSX
    Dado que o farmacêutico acessou a aba de histórico de recebimentos filtrada em "Ontem e Hoje"
    Quando ele clicar em "Comprovante" na guia "GUIA-CAF-2026/089" e o navegador entrar em modo de impressão ("media: print")
    Então a área oficial "#termoRecebimentoPrintArea" deve estar visível e os controles de navegação ocultos
    Quando ele fechar o modal e clicar em "Exportar (.xlsx)"
    Então o arquivo Excel ".xlsx" deve ser baixado nativamente pelo navegador
```

---

## 5. Checklist de DoD e aceitação

- [ ] Cenários Gherkin das histórias `RE-05`, `RE-06`, `RE-07` e `RE-08` migrados para `.feature` e automatizados com `playwright-bdd`.
- [ ] Emulação `@media print` (`page.emulateMedia({ media: 'print' })`) validada para o Termo de Recebimento do SUS.
- [ ] Download nativo de `.xlsx` (`page.waitForEvent('download')`) e estorno justificado validados.
- [ ] Execução aprovada em `moon run frontend:test-bdd` e `moon run frontend:test-e2e` com zero violações no `@axe-core/playwright`.
