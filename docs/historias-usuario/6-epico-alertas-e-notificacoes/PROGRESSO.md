# Progresso — Épico 6: Alertas, Notificações e Parâmetros Operacionais

Última atualização: 17/11/2026

## Resumo Executivo

| Métrica | Valor |
| --- | --- |
| **Total de Histórias Mapeadas** | 13 |
| **Entregues** | 0 (0%) |
| **Em Andamento** | 0 (0%) |
| **Pendentes** | 13 (100%) |

```
Progresso: [░░░░░░░░░░░░░░░░░░░░] 0% (0/13 concluídas)
```

---

## Histórias do Épico 6 (Novo Incremento 2)

| Código | Camada | Título | Especificação | Status Redação | Status Implementação |
| --- | --- | --- | --- | --- | --- |
| **AL-01** | Backend | Migrações do schema de alertas, parâmetros operacionais por UBS e fila `outbox_events` (RF022, RF023, RF027, ADR-004, ADR-016) | [al-01-backend-migrations-schema-alertas-parametros-outbox.md](./al-01-backend-migrations-schema-alertas-parametros-outbox.md) | ✅ Redigida | ⏳ Não iniciada |
| **AL-02** | Backend | API de Parâmetros Operacionais da UBS: consulta, atualização de limiares, auditoria e recálculo imediato (RF026, RF027, RF028) | [al-02-backend-api-parametros-operacionais-ubs.md](./al-02-backend-api-parametros-operacionais-ubs.md) | ✅ Redigida | ⏳ Não iniciada |
| **AL-03** | Backend | Motor de Avaliação e API de Alertas: detecção de vencimento próximo e risco de ruptura por cobertura em dias (RF022, RF023) | [al-03-backend-motor-avaliacao-alertas-vencimento-ruptura-api.md](./al-03-backend-motor-avaliacao-alertas-vencimento-ruptura-api.md) | ✅ Redigida | ⏳ Não iniciada |
| **AL-04** | Backend | Worker Outbox e Notificações por E-mail: processamento assíncrono idempotente de alertas críticos (RF022, RF023, ADR-004) | [al-04-backend-worker-outbox-notificacoes-email.md](./al-04-backend-worker-outbox-notificacoes-email.md) | ✅ Redigida | ⏳ Não iniciada |
| **AL-05** | Frontend | Sino de Notificações no Cabeçalho e Drawer Rápido: contador de não lidos, pré-visualização e leitura (RF022, RF023, NF001) | [al-05-frontend-sino-notificacoes-header-drawer-resumo.md](./al-05-frontend-sino-notificacoes-header-drawer-resumo.md) | ✅ Redigida | ⏳ Não iniciada |
| **AL-06** | Frontend | Tela Central de Alertas: abas de Vencimento Próximo e Risco de Ruptura, filtros de criticidade e atalhos (RF022, RF023) | [al-06-frontend-central-alertas-abas-vencimento-ruptura.md](./al-06-frontend-central-alertas-abas-vencimento-ruptura.md) | ✅ Redigida | ⏳ Não iniciada |
| **AL-07** | Frontend | Configuração de Parâmetros Operacionais da UBS: limiar de vencimento, estoque de segurança e *lead time* CAF (RF027, NF009) | [al-07-frontend-modal-pagina-configuracao-parametros-ubs.md](./al-07-frontend-modal-pagina-configuracao-parametros-ubs.md) | ✅ Redigida | ⏳ Não iniciada |
| **AL-08** | Frontend | Widget de Alertas no Dashboard e Modal de Confirmação Obrigatória para Validade Curta (< 6 meses) (RF022, RF023, RF024) | [al-08-frontend-widget-alertas-ativos-dashboard-confirmacao-validade-curta.md](./al-08-frontend-widget-alertas-ativos-dashboard-confirmacao-validade-curta.md) | ✅ Redigida | ⏳ Não iniciada |
| **AL-09** | Frontend | Suíte Integrada Playwright BDD e E2E Full-Stack do Módulo de Alertas, Notificações e Parâmetros | [al-09-frontend-migracao-testes-playwright-bdd-alertas.md](./al-09-frontend-migracao-testes-playwright-bdd-alertas.md) | ✅ Redigida | ⏳ Não iniciada |
| **AL-MOB-01** | Mobile | Central de Alertas no Celular: abas de vencimento próximo e risco de ruptura com leitura por toque (RF022, RF023, ADR-034) | [al-mob-01-central-alertas-vencimento-ruptura-mobile.md](./al-mob-01-central-alertas-vencimento-ruptura-mobile.md) | ✅ Redigida | ⏳ Não iniciada |
| **AL-MOB-02** | Mobile | Notificações Locais/Push no Dispositivo Móvel para Novos Alertas Críticos de Ruptura e Vencimento (RF022, RF023, ADR-034) | [al-mob-02-notificacoes-push-locais-alertas-criticos-mobile.md](./al-mob-02-notificacoes-push-locais-alertas-criticos-mobile.md) | ✅ Redigida | ⏳ Não iniciada |
| **AL-MOB-03** | Mobile | Configuração Rápida de Parâmetros Operacionais da UBS no Celular (RF027, NF009, ADR-034) | [al-mob-03-configuracao-parametros-operacionais-ubs-mobile.md](./al-mob-03-configuracao-parametros-operacionais-ubs-mobile.md) | ✅ Redigida | ⏳ Não iniciada |
| **AL-MOB-04** | Mobile | Alerta Tátil Bloqueante de Confirmação no Recebimento de Lotes com Validade Curta (< 6 meses) no Celular (RF024, ADR-034) | [al-mob-04-alerta-bloqueante-recebimento-validade-curta-mobile.md](./al-mob-04-alerta-bloqueante-recebimento-validade-curta-mobile.md) | ✅ Redigida | ⏳ Não iniciada |
