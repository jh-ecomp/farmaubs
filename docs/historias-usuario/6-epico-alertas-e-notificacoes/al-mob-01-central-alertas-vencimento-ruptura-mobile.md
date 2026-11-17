# AL-MOB-01 feat(alertas): Central de Alertas de Vencimento e Ruptura no Celular (RF022, RF023)

---

- **Épico**: Alertas, Notificações e Parâmetros Operacionais (RF022, RF023, NF001, NF002, NF007)
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF022 (Alertar Medicamentos Próximos ao Vencimento), RF023 (Alertar Risco de Ruptura de Estoque)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva), NF002 (Ergonomia Mobile), NF007 (Resposta Rápida)
- **ADRs Vinculadas**: ADR-006 (RBAC), ADR-007 (API REST), ADR-014 (Resiliência Offline), ADR-022 (`@farmaubs/shared`), ADR-034 (Workspace Mobile Expo)

---

## 1. História de usuário

> **Como** farmacêutico circulando pelas prateleiras da farmácia da UBS com o celular em mãos,  
> **quero** acessar no aplicativo móvel a Central de Alertas da minha UBS ativa dividida entre "Vencimento" e "Ruptura", visualizando cartões de fácil leitura com lote, validade, cobertura em dias e confirmação de leitura por toque,  
> **para que** eu possa localizar fisicamente nas estantes os lotes prestes a vencer para segregá-los ou priorizá-los no balcão sem precisar voltar ao computador (RF022, RF023).

---

## 2. Regras de negócio e casos de borda

1. **Atalho com Contador na Tela Inicial Mobile**:
   - O card de atalho `"Alertas de Estoque"` no Dashboard Mobile exibe um selo numérico com `totalNaoLidos` (vermelho se houver alerta `CRITICO`, laranja se apenas `ATENCAO`).
2. **Seletor Tátil em Duas Abas**:
   - **Aba "Vencimento" (`RF022`)**: exibe cartões de lotes vencidos ou próximos ao vencimento, destacando em fonte grande o código do lote (`numeroLote`), a data de validade (`DD/MM/AAAA`), os dias restantes e o saldo físico do lote;
   - **Aba "Ruptura" (`RF023`)**: exibe cartões de medicamentos com baixa cobertura, destacando o saldo consolidado válido, o consumo médio diário (`CMD`) e os dias de cobertura restantes frente ao prazo da CAF.
3. **Confirmação de Leitura e Cache Offline (ADR-014)**:
   - Botão tátil `"Marcar como lido"` em cada cartão e ação `"Marcar todos como lidos"` no topo.
   - O último resumo e a lista de alertas da UBS ativa são cacheados localmente para consulta de leitura caso o sinal de Wi-Fi oscile dentro do depósito da farmácia.

---

## 3. Contratos de dados (`@farmaubs/shared`)

Compartilha `AlertaEstoqueItemDto`, `ResumoAlertasUbsDto` e `ListarAlertasQueryDto` de `@farmaubs/shared/src/alertas/`.

---

## 4. Escopo Técnico da implementação (ADR-034)

- **Tela e Componentes (`apps/mobile/src/screens/alertas/`)**:
  - `CentralAlertasScreen.tsx`
  - `CardAlertaMobile.tsx`
- **Contra-parte Web**: `AL-05` e `AL-06`.

---

## 5. Cenários de teste em BDD (Gherkin — camada Mobile)

```gherkin
# language: pt
Funcionalidade: Central de Alertas de Vencimento e Ruptura no Mobile (AL-MOB-01)

  Cenário: Visualização de lotes próximos ao vencimento e alternância para aba de ruptura
    Dado que o farmacêutico está autenticado na "UBS Centro - Dr. João Silva Filho" no aplicativo mobile
    Quando ele tocar no atalho "Alertas de Estoque"
    Então a aba "Vencimento" deve listar os lotes com validade próxima ordenados pelos mais críticos
    Quando ele tocar na aba "Ruptura"
    Então a lista deve exibir os medicamentos cuja cobertura em dias é inferior ou igual ao ponto crítico da UBS

  Cenário: Marcação de alerta como lido pelo celular
    Dado que existe um alerta com status "ATIVO" exibido na Central de Alertas Mobile
    Quando o farmacêutico tocar em "Marcar como lido"
    Então o aplicativo deve enviar PATCH para "/api/v1/alertas/:id/lido"
    E o contador de alertas não lidos deve ser decrementado imediatamente
```

---

## 6. Checklist de DoD e aceitação

- [ ] Tela `CentralAlertasScreen` integrada à navegação principal do aplicativo mobile.
- [ ] Alvos de toque com altura mínima de 48dp e contraste acessível.
- [ ] Testes unitários da lógica de filtragem e formatação de cartões (`*.check.ts`) passando com `pnpm --filter @farmaubs/mobile test`.
