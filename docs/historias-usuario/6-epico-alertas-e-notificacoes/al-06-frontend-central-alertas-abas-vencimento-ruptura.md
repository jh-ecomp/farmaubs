# AL-06 feat(alertas): Tela Central de Alertas com Abas de Vencimento Próximo e Risco de Ruptura

---

- **Épico**: Alertas, Notificações e Parâmetros Operacionais (RF022, RF023, NF001, NF002, NF007)
- **Camada**: Frontend Web (`apps/frontend`)
- **Requisitos Funcionais**: RF022 (Alertar Medicamentos Próximos ao Vencimento), RF023 (Alertar Risco de Ruptura de Estoque)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva em 2 Abas), NF002 (Design Responsivo), NF003 (Português Brasil), NF007 (Tempo de Resposta < 2s)
- **ADRs Vinculadas**: ADR-011 (React 19 + Tailwind CSS v4), ADR-013 (TanStack Query), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA)

---

## 1. História de usuário

> **Como** farmacêutico responsável, residente ou gerente da UBS,  
> **quero** uma tela dedicada de Central de Alertas estruturada em duas abas principais ("Próximos ao Vencimento" e "Risco de Ruptura"), com cartões de resumo por criticidade, filtros rápidos e botões de ação direta (como abrir dispensação priorizando o lote FEFO ou registrar baixa por descarte),  
> **para que** eu possa analisar todos os itens críticos da farmácia e tomar providências operacionais imediatas em poucos cliques (RF022, RF023, NF001).

---

## 2. Regras de negócio e casos de borda

1. **Estrutura em Duas Abas Canônicas (conforme concepção e protótipo)**:
   - **Aba 1 — Próximos ao Vencimento (`aba=VENCIMENTO`, RF022)**:
     - Lista todos os lotes com validade expirada (`VENCIDO`) ou dentro do limiar configurado (`VENCIMENTO_PROXIMO`);
     - Colunas exibidas: Medicamento & Apresentação, Código do Lote & Fabricante, Saldo do Lote, Data de Validade (`DD/MM/AAAA`), Prazo Restante (ex.: `"Vence em 14 dias"` ou `"Vencido há 3 dias"`), Severidade (`Crítico` em vermelho para $\le 30$ dias/vencido; `Atenção` em âmbar/laranja para $31$ até o limiar) e Ações Rápidas;
     - Ações da linha:
       - Se não vencido: `"Priorizar na Dispensação (FEFO)"` (leva para `/dispensacao` com o medicamento pré-selecionado);
       - Se vencido: `"Baixar por Vencimento"` (abre modal de ajuste de saída com motivo `VALIDADE_VENCIDA` pré-preenchido).
   - **Aba 2 — Risco de Ruptura (`aba=RUPTURA`, RF023)**:
     - Lista todos os medicamentos cujo saldo consolidado válido possui cobertura inferior ou igual ao ponto crítico (`cafLeadTimeDays + estoqueSegurancaDias`);
     - Colunas exibidas: Medicamento & Apresentação, Saldo Consolidado Válido, Consumo Médio Diário (`CMD`), Cobertura Estimada (em dias), Meta Mínima da UBS (`Lead Time CAF + Segurança`), Severidade (`Estoque Zerado` / `Crítico` em vermelho quando cobertura $\le \text{Lead Time CAF}$; `Atenção` em âmbar quando entre $\text{Lead Time CAF}$ e $\text{Ponto Crítico}$) e Ações Rápidas;
     - Ação da linha: `"Ver Lotes no Estoque"` (leva para `/estoque` filtrado pelo medicamento).
2. **Cabeçalho da Página e Filtros**:
   - Quatro cards sintetizadores no topo: Total de Alertas Ativos, Vencimentos Críticos ($\le 30$d / Vencidos), Rupturas Críticas ($\le$ Prazo CAF) e Parâmetros Vigentes da UBS (ex.: `"Limiar: 90d | CAF: 15d + 7d seg."`).
   - Botão `"⚙️ Configurar Parâmetros da UBS"` (visível/habilitado para `ADMINISTRADOR` e `FARMACEUTICO_RESPONSAVEL`, abrindo **AL-07**).
   - Barra de filtro por texto (nome ou lote), seletor de severidade (`Todos`, `Apenas Críticos`, `Apenas Atenção`) e botão `"🔄 Reavaliar Agora"`.

---

## 3. Contratos de dados e Protocolo HTTP

Utiliza os contratos compartilhados de `@farmaubs/shared`:
- `GET /api/v1/alertas?aba=VENCIMENTO|RUPTURA&severidade=...&busca=...`
- `GET /api/v1/alertas/resumo`
- `POST /api/v1/alertas/reavaliar`
- `PATCH /api/v1/alertas/:id/lido`

---

## 4. Escopo Técnico da implementação

- **Camada**: D (Testes de Sistema BDD e E2E Full-Stack em Gherkin com Playwright + `playwright-bdd` e `@axe-core/playwright`).
- **Página Principal**: `apps/frontend/src/pages/Alertas/index.tsx` (rota `/alertas` adicionada ao menu lateral de navegação).
- **Subcomponentes**:
  - `AbaAlertasVencimento.tsx`
  - `AbaAlertasRuptura.tsx`
  - `CardsResumoAlertas.tsx`
- **Testes da Camada D (Playwright BDD)**:
  - `apps/frontend/e2e/features/sistema/alertas-central-sistema.feature` (`moon run frontend:test-bdd`): Alternância entre as abas Vencimento e Ruptura, acionamento de atalhos operacionais e auditoria de contraste WCAG 2.1 AA (`@axe-core/playwright`).
  - `apps/frontend/e2e/features/fullstack/alertas-fullstack.feature` (`moon run frontend:test-e2e`): Consulta completa na Central de Alertas e reavaliação sob demanda.
- **Contra-parte Mobile**: `AL-MOB-01`.

---

## 5. Cenários de teste em BDD (Gherkin — camada D)

```gherkin
# language: pt
Funcionalidade: Tela Central de Alertas em Duas Abas (RF022, RF023)

  Cenário: Alternância entre a aba de Próximos ao Vencimento e a aba de Risco de Ruptura
    Dado que o farmacêutico acessou a página "/alertas"
    Quando a aba "Próximos ao Vencimento" estiver selecionada por padrão
    Então a tabela deve listar os lotes com data de validade, dias restantes e saldo do lote
    Quando o farmacêutico clicar na aba "Risco de Ruptura"
    Então a tabela deve exibir os medicamentos com saldo consolidado, consumo médio diário e cobertura estimada em dias

  Cenário: Acionamento de baixa rápida para lote vencido
    Dado que na aba "Próximos ao Vencimento" existe um lote com status "VENCIDO"
    Quando o farmacêutico clicar na ação "Baixar por Vencimento"
    Então deve abrir o modal de ajuste de saída com o lote selecionado e o motivo "VALIDADE_VENCIDA"
```

---

## 6. Checklist de DoD e aceitação

- [ ] Rota `/alertas` registrada e acessível no menu lateral da aplicação Web.
- [ ] Abas implementadas com semântica ARIA (`role="tablist"`, `role="tab"`, `role="tabpanel"`).
- [ ] Semáforo de cores e ícones distinguindo claramente alertas de `ATENCAO` (laranja/âmbar) e `CRITICO` (vermelho), sem depender exclusivamente de cor (WCAG 2.1 AA auditado com `@axe-core/playwright`).
- [ ] Testes automatizados da Camada D em Gherkin (pt-BR) com Playwright + `playwright-bdd` (`moon run frontend:test-bdd` e `moon run frontend:test-e2e`) cobrindo renderização das abas, filtros e ações.
