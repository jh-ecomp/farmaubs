# AL-MOB-04 feat(alertas): Alerta Tátil de Confirmação Obrigatória no Recebimento de Lotes com Validade Curta no Celular (RF024)

---

- **Épico**: Alertas, Notificações e Parâmetros Operacionais (RF024, RF028, NF001, ADR-034)
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF024 (Alertar Recebimento de Medicamentos com Validade Curta < 6 meses), RF028 (Auditoria)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva), NF018 (Rastreabilidade)
- **ADRs Vinculadas**: ADR-022 (`@farmaubs/shared`), ADR-034 (Workspace Mobile Expo)

---

## 1. História de usuário

> **Como** farmacêutico conferindo a chegada de caixas da CAF pelo celular na bancada de recebimento (`RE-MOB-02`),  
> **quero** que o aplicativo exiba um modal de alerta em destaque sempre que eu informar um lote com validade inferior a 6 meses (180 dias), exigindo minha confirmação expressa antes de concluir o registro da entrada,  
> **para que** eu identifique imediatamente na doca/bancada lotes com validade curta enviados pela CAF, decida se aceito ou recuso o item no ato da conferência e deixe a aceitação auditada no sistema (RF024, RF028).

---

## 2. Regras de negócio e casos de borda

1. **Detecção Instantânea ao Informar a Validade**:
   - Utiliza a função compartilhada `lotePossuiValidadeCurtaNoRecebimento(dataValidadeIso)` de `@farmaubs/shared`.
   - Assim que a data de validade digitada for válida porém inferior a **180 dias** da data atual (e maior que a data atual, pois lotes já vencidos são bloqueados na entrada), exibe um banner âmbar imediato no formulário do item: `"⚠️ Atenção: validade curta (restam X dias — menos de 6 meses)"`.
2. **Folha Modal de Confirmação Explícita antes de Efetivar (`RF024`)**:
   - Ao tocar em `"Confirmar Entrada"` contendo um ou mais lotes com validade inferior a 180 dias, abre uma folha modal (`Modal` com `statusBarTranslucent` e `navigationBarTranslucent`) listando os lotes afetados.
   - O farmacêutico deve tocar na chave de confirmação (`"Confirmo ciência do recebimento de lote(s) com validade inferior a 6 meses"`) para liberar o botão `"Prosseguir e Registrar Entrada"`.
   - Envia `confirmacaoValidadeCurta: true` no payload para o backend registrar na trilha de auditoria (`RF028`).

---

## 3. Contratos de dados (`@farmaubs/shared`)

Reutiliza `LIMIAR_VALIDADE_CURTA_RECEBIMENTO_DIAS` (`180`) e `lotePossuiValidadeCurtaNoRecebimento` de `@farmaubs/shared`.

---

## 4. Escopo Técnico da implementação (ADR-034)

- **Componente (`apps/mobile/src/screens/recebimento/ModalConfirmarValidadeCurta.tsx`)**:
  - Integrado ao fluxo de conferência mobile (`RE-MOB-02` / `RE-MOB-03`).
- **Contra-parte Web**: `AL-08`.

---

## 5. Cenários de teste em BDD (Gherkin — camada Mobile)

```gherkin
# language: pt
Funcionalidade: Alerta Bloqueante de Validade Curta no Recebimento Mobile (AL-MOB-04 / RF024)

  Cenário: Exibição de folha de confirmação ao conferir lote com 100 dias de validade no celular
    Dado que o farmacêutico está conferindo uma guia da CAF pelo celular
    E informou o lote "LT-990" com data de validade para daqui a 100 dias
    Quando ele tocar em "Finalizar Recebimento"
    Então o aplicativo deve abrir a folha modal alertando que o lote "LT-990" vence em 100 dias (< 6 meses)
    E somente enviar a requisição após o farmacêutico marcar a confirmação explícita de ciência
```

---

## 6. Checklist de DoD e aceitação

- [ ] Reutilização da calculadora `lotePossuiValidadeCurtaNoRecebimento` de `@farmaubs/shared`.
- [ ] Modal bottom-sheet seguindo o padrão visual e de isolamento de toques do mobile (`SeletorUbs`).
- [ ] Testes unitários (`*.check.ts`) validando o bloqueio sem confirmação e a liberação após aceite.
