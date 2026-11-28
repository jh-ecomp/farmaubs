# RL-08 feat(qa/infra): Suíte de Smoke Tests Pós-Deploy, Testes de Carga e Estresse `k6` (Load & Stress) e Scripts de Backup/Restore Off-Site

---

- **Épico**: Release 1 — Prontidão para Produção, CI/CD e Infraestrutura
- **Requisitos Não-Funcionais**: NF004 (Disponibilidade), NF006 (Backup automático com retenção de 30 dias e restore <= 4h), NF007 (Tempo de resposta <= 2s/3s), NF014 (Suporte >= 50 usuários simultâneos)
- **ADRs Vinculadas**: ADR-020 (Backup e Disaster Recovery — Fase 1), ADR-024 (Validação pós-deploy em QA/PROD), ADR-025 (Homologação com dados sintéticos)

---

## 1. História de usuário

> **Como** engenheiro responsável pela liberação da Release 1 do FarmaUBS,  
> **quero** dispor de um script automatizado de *Smoke Tests* pós-deploy, roteiros separados de **Teste de Carga (*Load Test*)** e **Teste de Estresse (*Stress Test*)** em `k6` e scripts versionados de backup e restauração do PostgreSQL em armazenamento off-site (Cloudflare R2),  
> **para que** cada deploy em QA ou Produção seja verificado automaticamente em segundos, os requisitos não funcionais de desempenho nominal (`NF007` e `NF014`) e comportamento sob sobrecarga extrema sejam demonstrados com métricas auditáveis e a recuperação de desastres (`NF006`) seja executável de forma reproduzível.

---

## 2. Regras de negócio e requisitos técnicos

1. **Script de *Smoke Tests* Pós-Deploy (`infra/scripts/smoke-test.mjs`)**:
   - Executável via Node 22 nativo (zero dependências externas extras) recebendo `TARGET_URL`, `SMOKE_MODE` (`full` para HML — padrão; `readonly` para PROD) e, no modo `full`, credenciais da conta sintética de QA (`QA_SMOKE_EMAIL`, `QA_SMOKE_PASSWORD`).
   - Verifica em < 30 segundos:
     1. `GET ${TARGET_URL}/api/v1/health` retorna `200` com `status === 'ok'` e `checks.database === 'up'`;
     2. `GET ${TARGET_URL}/` retorna `200` com HTML do frontend (`lang="pt-BR"`);
     3. Requisição sem cookie à rota protegida `GET ${TARGET_URL}/api/v1/acesso/me` retorna `401`;
     4. *(Modo `full` — HML)*: Login válido via `POST ${TARGET_URL}/api/v1/acesso/login` retorna `200` com `Set-Cookie` contendo `farmaubs_session` e `HttpOnly` (e `Secure` quando HTTPS), permitindo consultar `GET ${TARGET_URL}/api/v1/acesso/me` (`200`);
     5. *(Modo `full` — HML)*: Logout via `POST ${TARGET_URL}/api/v1/acesso/logout` retorna `204 No Content` e invalida a sessão (`GET /api/v1/acesso/me` subsequente com o mesmo token retorna `401`).
   - Retorna exit code `0` em sucesso ou `1` em qualquer falha (permitindo quebrar o job do GitHub Actions em `RL-06`).
2. **Roteiro de Teste de Carga Nominal — *Load Test* (`infra/load-tests/k6-ubs-load.js`)**:
   - **Objetivo:** comprovar atendimento ao SLA sob a carga nominal simultânea exigida por `NF007` e `NF014` em `farmaubs-hml`.
   - **Estratégia de sessão compatível com Rate Limit:** a função `setup()` autentica previamente na rota `POST /api/v1/acesso/login` (respeitando ou desabilitando pontualmente o rate limit de login em HML) e compartilha o token/cookie válido com os VUs, evitando falso negativo `429` no primeiro segundo da rampa.
   - **Perfil de carga:** rampa `0 → 50 VUs` (1 min), platô sustentado de **50 VUs simultâneos** (3 min) e descida `50 → 0 VUs` (30s), exercitando consultas de estoque/saldos, busca de medicamentos FEFO, histórico de dispensas/recebimentos e `/api/v1/acesso/me`.
   - **Thresholds obrigatórios:** `http_req_duration: ['p(95)<2000']` e `http_req_failed: ['rate<0.01']`, exportando relatório resumo JSON/HTML (`--summary-export`) para apresentação.
3. **Roteiro de Teste de Estresse e Recuperação — *Stress Test* (`infra/load-tests/k6-ubs-stress.js`)**:
   - **Objetivo:** submeter `farmaubs-hml` (com dados sintéticos — **nunca contra `farmaubs-prod` ativo**) a carga progressivamente acima da capacidade nominal para identificar o *knee point* (ponto de degradação), provar ausência de queda de processo/*deadlock* no PostgreSQL e validar auto-recuperação.
   - **Perfil de estresse:** estágios progressivos `0 → 50 VUs` (1 min) → `100 VUs` (1 min) → `150 VUs` (1 min) → `200 VUs` (1 min) → **estágio de recuperação `10 VUs` (1 min)** → `0 VUs`, verificando ao final que `GET /api/v1/health` permanece `200 OK` (`status: 'ok'`) e a latência retorna ao patamar normal no estágio de recuperação.
4. **Scripts de Backup e Restauração Off-Site (`infra/scripts/backup-postgres-r2.sh` e `restore-postgres-r2.sh`)**:
   - `backup-postgres-r2.sh`: carrega variáveis de `/opt/farmaubs/prod/.env`, executa sem TTY (`docker compose -p farmaubs-prod ... exec -T postgres pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"`), valida tamanho > 0, envia via `rclone` para o bucket privado no Cloudflare R2 (`r2:farmaubs-backups`), aplica retenção de 30 dias (`rclone delete --min-age 30d`) e registra log com timestamp.
   - `restore-postgres-r2.sh`: baixa um `.dump` do Cloudflare R2 via `rclone` e restaura em um banco/container PostgreSQL alvo via `pg_restore --clean --if-exists --no-owner`, validando ao final a contagem de tabelas e a presença das políticas de RLS ativas (`pg_policies`). *(Implementa a Fase 1 operacional do `ADR-020`).*

---

## 3. Escopo de arquivos impactados

- `infra/scripts/smoke-test.mjs` (novo)
- `infra/load-tests/k6-ubs-load.js` (novo — Teste de Carga / *Load Test*)
- `infra/load-tests/k6-ubs-stress.js` (novo — Teste de Estresse / *Stress Test*)
- `infra/scripts/backup-postgres-r2.sh` (novo)
- `infra/scripts/restore-postgres-r2.sh` (novo)

---

## 4. Cenários de validação técnica (BDD)

```gherkin
# language: pt
Funcionalidade: Validação Pós-Deploy (Smoke), Carga (Load), Estresse (Stress) e Backup Off-Site

  Cenário: Smoke test valida saúde, bloqueio anônimo, login HttpOnly e logout 204
    Dado que a aplicação está rodando em "TARGET_URL" no modo "full"
    Quando o script "infra/scripts/smoke-test.mjs" for executado
    Então ele deve validar "/api/v1/health", bloqueio "401" em "/api/v1/acesso/me", login em "/api/v1/acesso/login" com cookie HttpOnly e logout "204" em "/api/v1/acesso/logout" retornando código 0

  Cenário: Teste de carga nominal (Load Test) comprova suporte a 50 usuários simultâneos dentro do SLA
    Dado que o ambiente de homologação ("farmaubs-hml") está populado com dados sintéticos
    Quando o script "k6 run infra/load-tests/k6-ubs-load.js" for executado com 50 VUs
    Então o percentil 95 de resposta ("p(95)") deve permanecer abaixo de 2000 ms
    E a taxa de requisições com erro deve ser inferior a 1%

  Cenário: Teste de estresse (Stress Test) identifica limite de saturação e comprova recuperação sem queda da API
    Dado que o ambiente de homologação ("farmaubs-hml") recebe rampa progressiva até 200 VUs seguida de redução para 10 VUs
    Quando o script "k6 run infra/load-tests/k6-ubs-stress.js" concluir os estágios
    Então o container da API e o PostgreSQL devem permanecer operacionais com "/api/v1/health" respondendo HTTP 200 ("status: ok") na fase de recuperação

  Cenário: Script de restauração recupera integralmente um backup gerado
    Dado que um backup ".dump" foi gerado por "backup-postgres-r2.sh"
    Quando "restore-postgres-r2.sh" for executado contra um banco PostgreSQL limpo
    Então todas as tabelas, registros e políticas de RLS devem ser restauradas sem erro
```

---

## 5. Checklist de DoD e aceitação

- [x] `node infra/scripts/smoke-test.mjs` validado nos modos `full` (HML/local) e `readonly` (PROD).
- [x] `k6 run infra/load-tests/k6-ubs-load.js` executado com sucesso comprovando `p(95) < 2000ms` com 50 VUs simultâneos.
- [x] `k6 run infra/load-tests/k6-ubs-stress.js` executado com sucesso demonstrando comportamento sob pico (até 200 VUs) e recuperação automática sem queda do serviço.
- [x] Scripts `backup-postgres-r2.sh` e `restore-postgres-r2.sh` com `set -euo pipefail`, permissão de execução (`chmod +x`) e testados em restauração real contra banco limpo.
