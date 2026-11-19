# RL-03 feat(backend): Adaptador Real de E-mail Transacional e Rotina de Limpeza de Sessões e Relatórios

---

- **Épico**: Release 1 — Prontidão para Produção, CI/CD e Infraestrutura
- **Requisitos Funcionais**: RF001 (Confirmação de cadastro por e-mail), RF022/RF023 (Alertas de vencimento e ruptura por e-mail — Épico 6 / AL-04)
- **Requisitos Não-Funcionais**: NF004 (Estabilidade e uso controlado de disco), NF012 (Expiração de sessões)
- **ADRs Vinculadas**: ADR-003/ADR-033 (Portas e Adaptadores), ADR-006 (Sessões no PostgreSQL), ADR-009 (Retenção de 48h para relatórios temporários), ADR-027 (Credenciais SMTP/API)

---

## 1. História de usuário

> **Como** administrador e farmacêutico responsável da UBS,  
> **quero** que o sistema envie e-mails reais através de um provedor transacional configurável (SMTP/Resend) com timeout seguro e execute automaticamente a limpeza periódica de sessões expiradas e arquivos temporários de relatórios,  
> **para que** notificações de cadastro e alertas críticos do Épico 6 cheguem efetivamente à caixa de entrada sem travar a API, e o banco de dados e o disco da VPS não cresçam indefinidamente.

---

## 2. Regras de negócio e requisitos técnicos

1. **Adaptador Real de E-mail Transacional (Ports & Adapters)**:
   - Manter `ConsoleEmailServiceAdapter` para desenvolvimento local e testes automatizados (`EMAIL_PROVIDER=console`, padrão em `dev`/`test`).
   - Implementar adaptador real configurável por `EMAIL_PROVIDER=smtp` (usando `nodemailer` com `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE`) ou `EMAIL_PROVIDER=resend` (API HTTP do Resend com `RESEND_API_KEY` e `SMTP_FROM`).
   - Aplicar **timeout explícito** de conexão/resposta (ex.: `8000 ms`) em todas as chamadas de envio, garantindo que instabilidade do provedor de e-mail nunca trave requisições HTTP ou o worker do Outbox (`AL-04`).
   - Caso ocorra erro no envio de boas-vindas do cadastro (`RF001`), registrar log estruturado sem expor credenciais SMTP.
2. **Rotina de Limpeza de Sessões Expiradas (`sessions`)**:
   - Criar job agendado (executado 1x por dia na madrugada ou a cada 6 horas, desabilitável em testes via `MAINTENANCE_JOBS_ENABLED=false`) que remove registros da tabela `sessions` com `expira_em < NOW() - INTERVAL '24 hours'` ou revogados há mais de 7 dias.
3. **Rotina de Expurgo de Relatórios Temporários (`ADR-009`)**:
   - No mesmo serviço de manutenção periódica, varrer o diretório configurado em `REPORTS_DIR` (`./storage/reports`) e remover arquivos com idade superior a `REPORTS_RETENTION_HOURS` (padrão `48` horas), evitando esgotamento de disco na VPS única (`ADR-021`).

---

## 3. Escopo de arquivos impactados

- `apps/backend/src/modules/acesso/infrastructure/adapters/smtp-email-service.adapter.ts` (ou `resend-email-service.adapter.ts`)
- `apps/backend/src/modules/acesso/acesso.module.ts` (factory selecionando adaptador por `EMAIL_PROVIDER`)
- `apps/backend/src/common/maintenance/maintenance-cleanup.service.ts` (novo serviço para expurgo de sessões expiradas e relatórios antigos)
- `.env.example` (documentar `EMAIL_PROVIDER`, `RESEND_API_KEY`, `MAINTENANCE_JOBS_ENABLED`)

---

## 4. Cenários de teste em BDD (Gherkin — camadas A e B)

```gherkin
# language: pt
Funcionalidade: Envio Real de E-mail Transacional e Manutenção Periódica de Disco/Sessões

  Cenário: Seleção do adaptador de e-mail conforme variável EMAIL_PROVIDER
    Dado que a variável "EMAIL_PROVIDER" está configurada como "console"
    Quando o módulo de acesso for inicializado
    Então a porta "SERVICO_EMAIL_PORT" deve resolver para "ConsoleEmailServiceAdapter"

  Cenário: Limpeza periódica remove apenas sessões expiradas preservando sessões ativas
    Dado que existem 2 sessões expiradas há mais de 24 horas e 1 sessão ativa na tabela "sessions"
    Quando a rotina de limpeza de sessões for executada
    Então as 2 sessões expiradas devem ser removidas e a sessão ativa deve permanecer intacta

  Cenário: Expurgo de relatórios temporários remove arquivos acima da retenção configurada
    Dado que existem 1 arquivo criado há 72 horas e 1 arquivo criado há 2 horas em "REPORTS_DIR"
    E "REPORTS_RETENTION_HOURS" está configurado como 48
    Quando a rotina de expurgo de relatórios for executada
    Então o arquivo de 72 horas deve ser excluído e o arquivo de 2 horas deve ser mantido
```

---

## 5. Checklist de DoD e aceitação

- [ ] Adaptador real de e-mail (SMTP/Resend) implementado atrás da porta `ServicoEmailPort` com timeout de 8s.
- [ ] Limpeza automática de sessões expiradas testada contra PostgreSQL real (Camada B).
- [ ] Expurgo de arquivos antigos em `REPORTS_DIR` testado unitariamente com diretório temporário (Camada A).
- [ ] Jobs de manutenção respeitam `OnModuleDestroy` (sem timers vazando nos testes Jest).
