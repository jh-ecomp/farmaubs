# AL-05 feat(alertas): Sino de Notificações no Cabeçalho e Drawer Rápido de Alertas

---

- **Épico**: Alertas, Notificações e Parâmetros Operacionais (RF022, RF023, NF001, NF002, NF007)
- **Camada**: Frontend Web (`apps/frontend`)
- **Requisitos Funcionais**: RF022 (Alertar Medicamentos Próximos ao Vencimento), RF023 (Alertar Risco de Ruptura de Estoque)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva), NF002 (Design Responsivo), NF007 (Resposta Ágil)
- **ADRs Vinculadas**: ADR-011 (React 19 + Tailwind CSS v4), ADR-013 (TanStack Query), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA)

---

## 1. História de usuário

> **Como** farmacêutico ou gerente navegando em qualquer tela do FarmaUBS Web,  
> **quero** visualizar no cabeçalho superior um ícone de sino com contador numérico de alertas não lidos e, ao clicar nele, abrir uma gaveta rápida (*popover/drawer*) listando os alertas mais críticos da minha UBS ativa com opção de marcar como lido ou ir direto para a Central de Alertas,  
> **para que** eu perceba imediatamente quando um lote entrar em faixa de vencimento ou quando uma dispensação deixar um medicamento em risco de ruptura, sem precisar interromper a tarefa que estou realizando (RF022, RF023, NF001).

---

## 2. Regras de negócio e casos de borda

1. **Contador no Sino do Cabeçalho (`HeaderAlertasBell`)**:
   - Consome `GET /api/v1/alertas/resumo` para a UBS ativa no contexto.
   - Se `totalNaoLidos > 0`:
     - Exibe badge numérico sobre o ícone de sino (ex.: `4`, ou `99+` se ultrapassar 99);
     - Cor do badge: **vermelho** (`bg-red-600`) se `totalCriticos > 0`, ou **âmbar/laranja** (`bg-amber-500`) se houver apenas alertas de nível `ATENCAO`.
   - Se `totalNaoLidos === 0`: oculta o badge numérico e exibe o ícone discreto.
2. **Atualização Reativa entre Operações**:
   - A query `['alertas-resumo', ubsAtivaId]` é invalidada automaticamente pelo TanStack Query sempre que o usuário concluir uma dispensação, efetivar um recebimento, registrar um ajuste de estoque, alterar a UBS ativa ou salvar novos parâmetros operacionais.
3. **Gaveta Rápida (*Dropdown / Drawer*)**:
   - Exibe até os 5 alertas mais prioritários (`CRITICO` primeiro);
   - Cada item mostra:
     - Selo colorido de severidade (`Crítico` em vermelho ou `Atenção` em laranja);
     - Nome do medicamento + apresentação;
     - Resumo direto (ex.: `"Lote LT-2026C9 vence em 18 dias (35 unid.)"` ou `"Cobertura para 9 dias — abaixo do prazo CAF (15d)"`);
     - Botão rápido `"Marcar como lido"`.
   - Rodapé fixo com dois botões:
     - `"Marcar todos como lidos"` (desabilitado se `totalNaoLidos === 0`);
     - `"Ver todos na Central de Alertas →"` (navega para `/alertas` — **AL-06**).

---

## 3. Contratos de dados e Integração (`@farmaubs/shared`)

Reutiliza integralmente os contratos definidos em `@farmaubs/shared/src/alertas/`:
- `ResumoAlertasUbsDto` (`GET /api/v1/alertas/resumo`)
- `AlertaEstoqueItemDto` (`GET /api/v1/alertas?limite=5&apenasNaoLidos=true`)

---

## 4. Escopo Técnico da implementação

- **Camada**: D (Testes de Sistema BDD e E2E Full-Stack em Gherkin com Playwright + `playwright-bdd` e `@axe-core/playwright`).
- **Componentes (`apps/frontend/src/features/alertas/components/`)**:
  - `HeaderAlertasBell.tsx`
  - `AlertasQuickDrawer.tsx`
- **Hooks (`apps/frontend/src/hooks/useAlertas.ts`)**:
  - `useResumoAlertas(ubsId)`
  - `useMarcarAlertaLido()`
  - `useMarcarTodosAlertasLidos()`
- **Testes da Camada D (Playwright BDD)**:
  - `apps/frontend/e2e/features/sistema/alertas-sino-drawer-sistema.feature` (`moon run frontend:test-bdd`): Teste de sistema do contador no cabeçalho, abertura da gaveta por teclado (`Escape`), marcação de leitura e auditoria WCAG 2.1 AA (`@axe-core/playwright`).
  - `apps/frontend/e2e/features/fullstack/alertas-fullstack.feature` (`moon run frontend:test-e2e`): Integração real do sino com o motor de alertas da UBS.
- **Contra-parte Mobile**: `AL-MOB-01` (compartilha os mesmos contratos e helpers de formatação de rótulos de severidade em `@farmaubs/shared`).

---

## 5. Cenários de teste em BDD (Gherkin — camada D)

```gherkin
# language: pt
Funcionalidade: Sino de Notificações e Gaveta Rápida de Alertas no Cabeçalho (AL-05)

  Cenário: Exibição de badge vermelho quando há alertas críticos não lidos
    Dado que a UBS ativa possui 3 alertas não lidos sendo 1 de severidade "CRITICO" e 2 de "ATENCAO"
    Quando o cabeçalho principal da aplicação for renderizado
    Então o botão do sino deve exibir o contador "3" com destaque visual vermelho
    E possuir rótulo de acessibilidade "3 alertas não lidos, incluindo alertas críticos"

  Cenário: Abertura da gaveta rápida e marcação de todos os alertas como lidos
    Dado que o usuário clicou no ícone do sino e abriu a gaveta com 3 alertas não lidos
    Quando ele clicar em "Marcar todos como lidos"
    Então deve ser disparada a requisição POST para "/api/v1/alertas/marcar-todos-lidos"
    E o contador de não lidos no sino deve ser atualizado para zero
```

---

## 6. Checklist de DoD e aceitação

- [ ] Componente `HeaderAlertasBell` integrado ao layout autenticado (`AppLayout`).
- [ ] Acessibilidade teclado (`Escape` fecha a gaveta, `aria-expanded`, `aria-haspopup="dialog"`, região `aria-live="polite"` para o contador).
- [ ] Invalidação automática de cache ao trocar de UBS ou concluir movimentações de estoque.
- [ ] Testes automatizados da Camada D em Gherkin (pt-BR) com Playwright + `playwright-bdd` (`moon run frontend:test-bdd` e `moon run frontend:test-e2e`) e `@axe-core/playwright` aprovados.
