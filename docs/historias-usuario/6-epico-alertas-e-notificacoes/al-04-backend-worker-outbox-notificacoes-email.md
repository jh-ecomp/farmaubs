# AL-04 feat(alertas): Worker Outbox e Envio Assíncrono de Notificações por E-mail ao Farmacêutico Responsável

---

- **Épico**: Alertas, Notificações e Parâmetros Operacionais (RF022, RF023, RF027, ADR-004)
- **Requisitos Funcionais**: RF022 (Alertar Medicamentos Próximos ao Vencimento por e-mail), RF023 (Alertar Risco de Ruptura de Estoque), RF027 (Preferências de notificação da UBS)
- **Requisitos Não-Funcionais**: NF003 (Português Brasil), NF015 (Isolamento Multi-tenant), NF018 (Rastreabilidade de Eventos)
- **ADRs Vinculadas**: ADR-001 / ADR-004 (Transactional Outbox no PostgreSQL com Worker in-process), ADR-003 / ADR-033 (Portas e Adaptadores), ADR-030 (Pirâmide de Testes — Camadas A e B)

---

## 1. História de usuário

> **Como** farmacêutico responsável pela UBS,  
> **quero** receber notificações por e-mail institucional sempre que medicamentos da minha unidade entrarem na faixa de vencimento próximo ou em risco de ruptura de estoque, processadas de forma assíncrona e confiável em segundo plano,  
> **para que** eu tome ciência de situações críticas mesmo antes de abrir o painel do sistema, sem que o envio de e-mail torne lentas as operações de balcão e sem receber mensagens duplicadas sobre o mesmo lote (RF022, RF023, ADR-004).

---

## 2. Regras de negócio e casos de borda

1. **Processamento via Transactional Outbox (ADR-004)**:
   - O worker interno do monolito executa periodicamente (intervalo configurável via variável de ambiente `OUTBOX_POLL_INTERVAL_MS`, padrão `15000` ms) buscando lotes de eventos com `status = 'PENDENTE'` e `proxima_tentativa_em <= NOW()`.
   - Utiliza `SELECT ... FOR UPDATE SKIP LOCKED` no PostgreSQL para garantir segurança caso haja múltiplas instâncias da API rodando simultaneamente.
2. **Respeito às Preferências da UBS (RF027)**:
   - Antes de disparar o e-mail, o handler verifica em `parametros_operacionais_ubs`:
     - Se o alerta for de vencimento e `notificar_email_vencimento = false`, marca o evento como `PROCESSADO` (ignorado por preferência da unidade) sem enviar e-mail;
     - Se o alerta for de ruptura e `notificar_email_ruptura = false`, procede da mesma forma.
3. **Destinatários Qualificados**:
   - Os e-mails de alerta de uma UBS são enviados para todos os usuários ativos (`users.ativo = true`) vinculados àquela unidade (`user_units.ativo = true`) com perfil `FARMACEUTICO_RESPONSAVEL`.
4. **Idempotência e Retentativa com Backoff Exponencial**:
   - A chave `idempotency_key` no formato `alerta:${ubsId}:${tipoAlerta}:${produtoId}:${loteId ?? 'consolidado'}:${YYYY-MM-DD}` garante que no máximo 1 notificação por item/tipo seja disparada por dia.
   - Em caso de falha transitória do servidor SMTP/provedor de e-mail, o worker incrementa `tentativas` (máximo de 5 tentativas) e agenda `proxima_tentativa_em` com *backoff* exponencial ($2^{\text{tentativas}} \times 30\text{s}$). Após a 5ª falha, marca `status = 'FALHA'` com registro do erro em `erro_mensagem`.

---

## 3. Contratos de dados e Porta de E-mail

```typescript
export interface PayloadEventoAlertaOutbox {
  alertaId: string;
  municipioId: string;
  ubsId: string;
  ubsNome: string;
  tipoAlerta: 'VENCIMENTO_PROXIMO' | 'VENCIDO' | 'RISCO_RUPTURA' | 'ESTOQUE_ZERADO';
  severidade: 'ATENCAO' | 'CRITICO';
  produtoNome: string;
  apresentacao: string;
  numeroLote: string | null;
  dataValidade: string | null;
  diasParaVencer: number | null;
  saldoAtual: number;
  coberturaDias: number | null;
  pontoPedidoDias: number | null;
  detectadoEm: string;
}

export interface NotificacaoAlertaEmailDto {
  destinatarios: Array<{ nome: string; email: string }>;
  ubsNome: string;
  assunto: string;
  corpoTexto: string;
  corpoHtml: string;
}
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-033)

- **Domínio / Portas (`apps/backend/src/modules/alertas/domain/ports/`)**:
  - `OutboxRepositoryPort`: busca com lock `SKIP LOCKED`, marcação de sucesso e agendamento de *retry*.
  - `NotificadorEmailAlertaPort`: interface agnóstica para envio do template de alerta sanitário (reutilizando/estendendo a infraestrutura de e-mail do módulo de Acesso).
- **Aplicação (`apps/backend/src/modules/alertas/application/use-cases/`)**:
  - `ProcessarEventosOutboxAlertasUseCase`: lógica pura de orquestração dos eventos pendentes, verificação de flags da UBS e controle de tentativas.
- **Infraestrutura (`apps/backend/src/modules/alertas/infrastructure/workers/`)**:
  - `OutboxAlertasPollingWorker`: serviço de ciclo de vida NestJS (`OnModuleInit` / `OnModuleDestroy`) que aciona o caso de uso em intervalo configurável (desativável em testes de unidade via flag).

---

## 5. Cenários de teste em BDD (Gherkin — camadas A e B)

```gherkin
# language: pt
Funcionalidade: Processamento Assíncrono do Outbox e Envio de E-mail de Alertas (ADR-004)

  Cenário: Envio de e-mail para o Farmacêutico Responsável ao processar evento pendente no Outbox
    Dado que existe um evento "PENDENTE" na tabela "outbox_events" referente a um alerta crítico de ruptura de "Insulina NPH" na "UBS Centro - Dr. João Silva Filho"
    E a UBS possui "notificar_email_ruptura" igual a true
    E o usuário "farma.parnaiba@farmaubs.dev" é o Farmacêutico Responsável ativo vinculado à UBS
    Quando o worker do Outbox executar um ciclo de processamento
    Então o adaptador de e-mail deve ser chamado enviando o alerta para "farma.parnaiba@farmaubs.dev"
    E o evento na tabela "outbox_events" deve passar para o status "PROCESSADO" com "processed_at" preenchido

  Cenário: Falha temporária no serviço de e-mail agenda nova tentativa com backoff sem perder o evento
    Dado que existe um evento "PENDENTE" com 0 tentativas na tabela "outbox_events"
    E o serviço de envio de e-mail está temporariamente indisponível
    Quando o worker do Outbox tentar processar o evento
    Então o status do evento deve permanecer "PENDENTE" com "tentativas" igual a 1
    E "proxima_tentativa_em" deve ser postergada para o futuro com a mensagem de erro registrada

  Cenário: Supressão de envio quando a notificação por e-mail estiver desativada nos parâmetros da UBS
    Dado que a UBS desativou a opção "notificar_email_vencimento" em seus parâmetros operacionais
    Quando o worker processar um evento de "VENCIMENTO_PROXIMO" daquela UBS
    Então nenhum e-mail deve ser disparado
    E o evento deve ser marcado como "PROCESSADO"
```

---

## 6. Checklist de DoD e aceitação

- [ ] `ProcessarEventosOutboxAlertasUseCase` implementado em TypeScript puro (Camada A).
- [ ] Query SQL utilizando `FOR UPDATE SKIP LOCKED` validada em teste de integração no PostgreSQL (Camada B).
- [ ] Template de e-mail em português brasileiro claro, informando UBS, medicamento, lote/validade ou cobertura em dias e link para a Central de Alertas.
- [ ] Retentativa com *backoff* exponencial e limite máximo de 5 falhas testados.
