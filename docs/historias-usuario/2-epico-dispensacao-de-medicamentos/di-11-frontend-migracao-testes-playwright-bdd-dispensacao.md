# DI-11 test(dispensacao): Migração e Consolidação da Suíte de Testes de Frontend de Dispensação (Vitest -> Playwright BDD e E2E Full-Stack)

---

- **Épico**: Dispensação de Medicamentos (RF010, RF012, RF028, NF009, NF010, NF017)
- **Camada**: Frontend Web (`apps/frontend`) — Camada D e E2E Full-Stack (Camadas C + D)
- **Requisitos Funcionais**: RF010 (Identificação do Paciente, Busca e Baixa por FEFO), RF012 (Histórico Ontem/Hoje e Exportação XLSX), RF028 (Estorno Justificado)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva), NF010 (Feedback Rápido), NF017 (Validação de CPF e CNS)
- **ADRs Vinculadas**: ADR-011 (React 19 + Tailwind CSS), ADR-013 (TanStack Query), ADR-022 (`@farmaubs/shared`), ADR-030 (Estratégia de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-035 (Moonrepo)

---

## 1. História de usuário

> **Como** engenheiro de software do FarmaUBS,  
> **quero** consolidar e expandir a migração dos testes de frontend do Épico 2 (Identificação Obrigatória do Paciente `DI-06`, Busca Textual e Seletor FEFO `DI-07`, Carrinho com Receita de Antimicrobiano `DI-08`, Fechamento do Atendimento `DI-09` e Painel de Histórico com Exportação `.xlsx` e Estorno `DI-10`) do Vitest para **Playwright + `playwright-bdd`**,  
> **para que** todos os cenários Gherkin das histórias `DI-06` a `DI-10` sejam executados diretamente como especificação viva no navegador real nas modalidades **Sistema de Frontend** (`moon run frontend:test-bdd`) e **E2E Full-Stack** (`moon run frontend:test-e2e`).

---

## 2. Escopo da migração e funcionalidades do Playwright aplicadas

1. **Arquivos Vitest mapeados na transição**:
   - `apps/frontend/src/components/dispensacao/IdentificacaoPacienteForm.spec.tsx` (`DI-06`)
   - `apps/frontend/src/components/dispensacao/BuscaMedicamentoInput.spec.tsx` e `SeletorLoteFefo.spec.tsx` (`DI-07`)
   - `apps/frontend/src/components/dispensacao/CarrinhoReceita.spec.tsx` e `ValidacaoReceitaAntimicrobiano.spec.tsx` (`DI-08`)
   - `apps/frontend/src/pages/Dispensacao/index.spec.tsx` (`DI-09` — PoC base já iniciada)
   - `apps/frontend/src/pages/Dispensacao/HistoricoDispensacoes.spec.tsx` (`DI-10` — PoC base já iniciada)
2. **Recursos nativos do Playwright aplicados**:
   - **Download Binário Nativo (`page.waitForEvent('download')`)**: Verificar a transferência real do arquivo `.xlsx` do histórico de dispensações sem mockar `URL.createObjectURL`.
   - **Validação de Receita de Antimicrobianos (`page.clock`)**: Testar o bloqueio de receitas emitidas há mais de 10 dias com data congelada no navegador.
   - **Auditoria WCAG 2.1 AA (`@axe-core/playwright`)**: Garantir zero violações de acessibilidade no formulário do paciente, combobox WAI-ARIA de medicamentos e modais de confirmação/estorno.

---

## 3. Estrutura técnica dos arquivos BDD

- **Modalidade 1 — Teste de Sistema de Frontend (`moon run frontend:test-bdd`)**:
  - `apps/frontend/e2e/features/sistema/dispensacao-sistema.feature` (já criado na PoC — expandir com cenários de `DI-06`, `DI-07` e `DI-08` para antimicrobianos)
  - `apps/frontend/e2e/features/sistema/historico-dispensacao-sistema.feature` (já criado na PoC)
- **Modalidade 2 — Teste E2E Full-Stack (`moon run frontend:test-e2e`)**:
  - `apps/frontend/e2e/features/fullstack/dispensacao-fullstack.feature` (já criado na PoC)
- **Step Definitions**:
  - `apps/frontend/e2e/steps/dispensacao.steps.ts`

---

## 4. Cenários de teste em BDD (Gherkin — camada D & E2E)

```gherkin
# language: pt
Funcionalidade: Suíte Completa BDD de Dispensação de Medicamentos (DI-06 a DI-10)

  Cenário: Bloqueio de finalização para medicamento antimicrobiano com receita vencida (> 10 dias)
    Dado que o farmacêutico preenche os 4 dados obrigatórios do paciente
    Quando ele adiciona o antimicrobiano "Amoxicilina - 500mg Cápsula" ao carrinho
    E informa uma data de emissão da receita médica anterior a 10 dias
    Então deve ser exibido o alerta de receita de antimicrobiano fora da validade legal
    E o botão "Finalizar Atendimento" deve permanecer desabilitado

  Cenário: Jornada E2E Full-Stack de login, dispensação por lote FEFO, download XLSX e estorno
    Dado que o servidor de backend está com o estoque inicial da UBS de Parnaíba carregado
    Quando o farmacêutico realiza login e conclui a dispensação de "Losartana Potássica"
    E acessa a aba "Histórico de Atendimentos"
    Então o atendimento recém-gravado deve constar como "Concluída" e permitir exportação ".xlsx"
```

---

## 5. Checklist de DoD e aceitação

- [x] PoC base de `DI-09` e `DI-10` implementada e aprovada em `moon run frontend:test-bdd` e `moon run frontend:test-e2e`.
- [x] Cenários complementares de `DI-06` (autocompletar paciente e histórico de 90 dias), `DI-07` (troca manual de lote FEFO) e `DI-08` (validação de receita de antimicrobiano <= 10 dias) migrados para `.feature`.
- [x] Auditoria `@axe-core/playwright` cobrindo todos os estados da bancada de dispensação.
