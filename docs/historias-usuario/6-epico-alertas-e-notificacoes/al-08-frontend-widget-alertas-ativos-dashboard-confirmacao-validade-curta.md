# AL-08 feat(alertas): Widget de Alertas Ativos no Dashboard e Confirmação Obrigatória de Validade Curta no Recebimento

---

- **Épico**: Alertas, Notificações e Parâmetros Operacionais (RF022, RF023, RF024, RF028, NF001)
- **Camada**: Frontend Web (`apps/frontend`)
- **Requisitos Funcionais**: RF022 (Alertas de Vencimento no Dashboard), RF023 (Alertas de Ruptura no Dashboard), RF024 (Alertar Recebimento de Medicamentos com Validade Curta < 6 meses)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva), NF018 (Auditabilidade da confirmação)
- **ADRs Vinculadas**: ADR-011 (React 19 + Tailwind CSS v4), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA)

---

## 1. História de usuário

> **Como** farmacêutico em operação diária na UBS,  
> **quero** visualizar diretamente na tela inicial (*Dashboard*) um painel resumo com os alertas críticos ativos de vencimento e ruptura, e também receber um diálogo de confirmação explícita sempre que tentar registrar o recebimento de um lote cuja data de validade seja inferior a 6 meses (180 dias),  
> **para que** eu tenha consciência situacional imediata ao entrar no sistema e evite incorporar acidentalmente ao estoque da UBS remessas prestes a vencer sem ciência e registro formal (RF022, RF023, RF024).

---

## 2. Regras de negócio e casos de borda

1. **Painel de Alertas Ativos no Dashboard (`DashboardAlertasWidget`, RF022 e RF023)**:
   - Exibe no quadrante principal do Dashboard da UBS:
     - Contadores rápidos divididos por severidade (`Críticos` em vermelho, `Atenção` em âmbar);
     - Lista compacta com os 5 itens mais urgentes (vencimento ou ruptura) e link direto `"Abrir Central de Alertas"` (`/alertas`).
   - Caso a UBS não possua nenhum alerta ativo, exibe estado positivo verde: `"Estoque saudável: nenhum medicamento em risco de ruptura ou próximo ao vencimento"`.
2. **Diálogo de Confirmação Explícita para Recebimento de Validade Curta (`RF024`)**:
   - No fluxo de Recebimento de Medicamentos (`RE-06` / `RE-07`), ao adicionar ou finalizar a entrada de um lote cuja `dataValidade` seja inferior a **180 dias (6 meses)** a partir da data do recebimento:
     - O sistema **não permite** concluir a entrada silenciosamente;
     - Abre um modal de alerta sanitário em destaque exibindo o medicamento, número do lote, data de validade informada e a quantidade exata de dias restantes;
     - Exige que o farmacêutico marque a caixa de ciência (`"Estou ciente de que este lote possui validade inferior a 6 meses e autorizo sua entrada no estoque da UBS"`) e clique em `"Confirmar Recebimento com Validade Curta"`.
   - O aceite explícito é enviado no payload da entrada (`confirmacaoValidadeCurta: true`) para gravação no log de auditoria (`RF028`).

---

## 3. Contratos de dados (`@farmaubs/shared`)

```typescript
export const LIMIAR_VALIDADE_CURTA_RECEBIMENTO_DIAS = 180;

export function lotePossuiValidadeCurtaNoRecebimento(
  dataValidadeIso: string,
  dataReferenciaIso?: string,
): { validadeCurta: boolean; diasRestantes: number };
```

---

## 4. Escopo Técnico da implementação

- **Componentes**:
  - `apps/frontend/src/pages/Dashboard/components/DashboardAlertasWidget.tsx`
  - `apps/frontend/src/pages/Recebimento/components/ConfirmarValidadeCurtaModal.tsx`
- **Função Compartilhada**: `lotePossuiValidadeCurtaNoRecebimento` em `@farmaubs/shared` reutilizada tanto pelo Frontend Web quanto pelo App Mobile (**AL-MOB-04**).

---

## 5. Cenários de teste em BDD (Gherkin — camada D)

```gherkin
# language: pt
Funcionalidade: Painel de Alertas no Dashboard e Confirmação de Validade Curta no Recebimento (RF022, RF023, RF024)

  Cenário: Exibição de diálogo bloqueante ao receber lote com validade inferior a 6 meses (RF024)
    Dado que o farmacêutico está registrando a entrada do lote "LT-CURTO" com validade para daqui a 120 dias (< 180 dias)
    Quando ele acionar a confirmação da entrada
    Então o sistema deve exibir o modal "Alerta de Recebimento: Lote com Validade Curta (120 dias)"
    E o botão "Confirmar Recebimento" deve permanecer desabilitado até que a caixa de ciência seja marcada
    Quando o farmacêutico marcar a caixa de ciência e confirmar
    Então a entrada deve ser submetida à API com o indicador "confirmacaoValidadeCurta: true"

  Cenário: Visualização de alertas críticos no widget do Dashboard
    Dado que a UBS ativa possui 2 alertas críticos de ruptura e 1 alerta de vencimento próximo
    Quando o farmacêutico acessar a tela de Dashboard
    Então o widget de alertas deve listar os 3 alertas com seus indicadores visuais de criticidade
    E disponibilizar o atalho para a Central de Alertas
```

---

## 6. Checklist de DoD e aceitação

- [ ] Função pura `lotePossuiValidadeCurtaNoRecebimento` implementada e testada em `@farmaubs/shared`.
- [ ] Modal bloqueante de validade curta (< 180 dias) integrado ao fluxo de Recebimento (`RF024`).
- [ ] Widget de alertas ativos integrado ao Dashboard principal (`RF022`, `RF023`).
- [ ] Testes automatizados de componentes (Camada D) aprovados.
