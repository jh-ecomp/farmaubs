# AL-MOB-02 feat(alertas): Notificações Locais Nativas no Dispositivo Móvel para Novos Alertas Críticos (RF022, RF023)

---

- **Épico**: Alertas, Notificações e Parâmetros Operacionais (RF022, RF023, ADR-034)
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF022 (Alertar Medicamentos Próximos ao Vencimento), RF023 (Alertar Risco de Ruptura de Estoque)
- **Requisitos Não-Funcionais**: NF001 (Usabilidade), NF015 (Isolamento pela UBS Ativa)
- **ADRs Vinculadas**: ADR-022 (`@farmaubs/shared`), ADR-034 (Workspace Mobile React Native + `expo-notifications`)

---

## 1. História de usuário

> **Como** farmacêutico responsável autenticado no aplicativo móvel do FarmaUBS,  
> **quero** receber uma notificação nativa no sistema operacional do meu celular quando novos alertas de nível `CRITICO` (lote vencido/prestes a vencer ou risco iminente de ruptura) forem identificados na minha UBS ativa e que, ao tocar na notificação, o aplicativo abra diretamente a Central de Alertas,  
> **para que** eu seja avisado proativamente no celular sem depender apenas da leitura de e-mails no computador (RF022, RF023, ADR-034).

---

## 2. Regras de negócio e casos de borda

1. **Canal Dedicado de Notificação Android (`expo-notifications`)**:
   - Utiliza canal nativo `"farmaubs-alertas-estoque"` com importância alta (`AndroidImportance.HIGH`), separado do canal de expiração de sessão (`AC-MOB-07`).
2. **Deduplicação Local de Notificações Emitidas**:
   - O aplicativo armazena no `SecureStore` / storage local o conjunto de IDs (ou hash) dos alertas críticos já notificados no aparelho para a sessão/dia atual, garantindo que a mesma ocorrência crítica **nunca dispare notificações repetidas** a cada sincronização do resumo.
3. **Deep Linking / Ação ao Toque na Notificação**:
   - A notificação carrega metadado `data: { tipo: 'ALERTA_ESTOQUE_CRITICO', abaDestino: 'VENCIMENTO' | 'RUPTURA', ubsId }`.
   - Ao tocar na notificação na bandeja do Android/iOS, o aplicativo abre diretamente a tela `CentralAlertasScreen` (**AL-MOB-01**) posicionada na aba correspondente.
4. **Degradação Graciosa sem Permissão do SO**:
   - Caso o usuário tenha negado permissão de notificações nativas no aparelho, o aplicativo continua exibindo os badges visuais internos normalmente sem lançar exceções.

---

## 3. Contratos de dados e Lógica Pura

```typescript
export interface NotificacaoCriticaEstoquePayload {
  tipo: 'ALERTA_ESTOQUE_CRITICO';
  ubsId: string;
  abaDestino: 'VENCIMENTO' | 'RUPTURA';
  novosCriticosIds: string[];
}

export function filtrarNovosAlertasCriticosNaoNotificados(
  alertasAtuais: Array<{ id: string; severidade: 'ATENCAO' | 'CRITICO'; status: string }>,
  idsJaNotificados: string[],
): string[];
```

---

## 4. Escopo Técnico da implementação (ADR-034)

- **Serviço (`apps/mobile/src/services/alerta-estoque-notificacao.ts` e `notification.service.ts`)**:
  - Função pura `filtrarNovosAlertasCriticosNaoNotificados` testada em `alerta-estoque-notificacao.check.ts`.
  - Integração com `expo-notifications` (`scheduleNotificationAsync` imediato com `trigger: null`) ao detectar novos IDs críticos na sincronização de `GET /api/v1/alertas`.

---

## 5. Cenários de teste em BDD (Gherkin — camada Mobile)

```gherkin
# language: pt
Funcionalidade: Notificação Nativa de Alertas Críticos de Estoque no Mobile (AL-MOB-02)

  Cenário: Disparo de notificação nativa ao detectar novo alerta crítico inédito na UBS ativa
    Dado que o aplicativo possui permissão de notificação concedida no aparelho
    E o alerta crítico "alerta-101" de ruptura de "Amoxicilina 500 mg" ainda não foi notificado no dispositivo
    Quando o aplicativo sincronizar os alertas da UBS ativa
    Então deve disparar uma notificação nativa informando o alerta crítico na UBS
    E registrar "alerta-101" na lista de alertas já notificados para evitar repetição

  Cenário: Toque na notificação abre diretamente a Central de Alertas na aba correspondente
    Dado que o usuário recebeu uma notificação nativa com destino para a aba "RUPTURA"
    Quando ele tocar na notificação na barra de status do celular
    Então o aplicativo deve abrir a tela Central de Alertas com a aba "Ruptura" selecionada
```

---

## 6. Checklist de DoD e aceitação

- [ ] Canal `"farmaubs-alertas-estoque"` configurado com tratamento seguro (`try/catch`) para Android/Expo.
- [ ] Função pura de deduplicação de IDs notificados validada com testes automatizados (`*.check.ts`).
- [ ] Listener de toque redirecionando para a Central de Alertas na aba correta.
