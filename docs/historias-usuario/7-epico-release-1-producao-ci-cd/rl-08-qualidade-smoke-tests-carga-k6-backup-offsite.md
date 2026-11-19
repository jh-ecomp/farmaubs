# RL-08 feat(qa/infra): Suíte de Smoke Tests Pós-Deploy, Teste de Carga `k6` e Scripts de Backup/Restore Off-Site

---

- **Épico**: Release 1 — Prontidão para Produção, CI/CD e Infraestrutura
- **Requisitos Não-Funcionais**: NF004 (Disponibilidade), NF006 (Backup automático com retenção de 30 dias e restore <= 4h), NF007 (Tempo de resposta <= 2s/3s), NF014 (Suporte >= 50 usuários simultâneos)
- **ADRs Vinculadas**: ADR-020 (Backup e Disaster Recovery), ADR-024 (Validação pós-deploy em QA/PROD), ADR-025 (Homologação com dados sintéticos)

---

## 1. História de usuário

> **Como** engenheiro responsável pela liberação da Release 1 do FarmaUBS,  
> **quero** dispor de um script automatizado de *Smoke Tests* pós-deploy, um roteiro de teste de carga em `k6` simulando 50 usuários simultâneos e scripts versionados de backup e restauração do PostgreSQL em armazenamento off-site (Cloudflare R2),  
> **para que** cada deploy em QA ou Produção seja verificado automaticamente em segundos, os requisitos não funcionais de desempenho (`NF007` e `NF014`) sejam comprovados com métricas reais e a recuperação de desastres (`NF006`) seja executável de forma reproduzível.

---

## 2. Regras de negócio e requisitos técnicos

1. **Script de *Smoke Tests* Pós-Deploy (`infra/scripts/smoke-test.mjs`)**:
   - Executável via Node 22 nativo (zero dependências externas extras) recebendo `TARGET_URL` e credenciais de uma conta sintética de QA.
   - Verifica em < 30 segundos:
     1. `GET ${TARGET_URL}/api/v1/health` retorna `200` com `status === 'ok'`;
     2. `GET ${TARGET_URL}/` retorna `200` com HTML do frontend;
     3. Requisição sem cookie a rota protegida (`/api/v1/auth/me`) retorna `401`;
     4. Login válido via `POST /api/v1/auth/login` retorna cookie `HttpOnly` e permite consultar rota autenticada;
     5. Logout encerra a sessão corretamente.
   - Retorna exit code `0` em sucesso ou `1` em qualquer falha (permitindo quebrar o job do GitHub Actions em `RL-06`).
2. **Roteiro de Teste de Carga `k6` (`infra/load-tests/k6-ubs-carga.js`)**:
   - Simula **50 usuários virtuais (VUs)** simultâneos (`NF014`) durante rampa de 3 a 5 minutos executando jornada típica de farmácia de UBS (login uma vez por VU, consulta de dashboard/estoque, busca de medicamentos FEFO e histórico de dispensas).
   - Define *thresholds* automáticos alinhados aos requisitos:
     - `http_req_duration: ['p(95)<2000']` (`NF007`);
     - `http_req_failed: ['rate<0.01']` (< 1% de falhas).
   - Permite gerar sumário legível em terminal/JSON para anexar como evidência técnica de validação.
3. **Scripts de Backup e Restauração Off-Site (`infra/scripts/backup-postgres-r2.sh` e `restore-postgres-r2.sh`)**:
   - `backup-postgres-r2.sh`: executa `docker exec <container-postgres> pg_dump -Fc -U $POSTGRES_USER $POSTGRES_DB`, valida integridade/tamanho > 0, envia o dump comprimido via `rclone` para o bucket off-site configurado (ex.: Cloudflare R2), aplica retenção de 30 dias (`rclone delete --min-age 30d`) e opcionalmente notifica um webhook de healthcheck em caso de sucesso/falha.
   - `restore-postgres-r2.sh`: baixa um backup específico do bucket via `rclone` e restaura em um container PostgreSQL via `pg_restore`, validando a contagem de tabelas e status de RLS ativos. *(Base operacional pronta para evoluir para `pgBackRest`/PITR contínuo conforme `ADR-020`).*

---

## 3. Escopo de arquivos impactados

- `infra/scripts/smoke-test.mjs` (novo)
- `infra/load-tests/k6-ubs-carga.js` (novo)
- `infra/scripts/backup-postgres-r2.sh` (novo)
- `infra/scripts/restore-postgres-r2.sh` (novo)

---

## 4. Cenários de validação técnica (BDD)

```gherkin
# language: pt
Funcionalidade: Validação Pós-Deploy, Desempenho sob Carga e Backup Off-Site

  Cenário: Smoke test falha o pipeline se o endpoint de saúde ou login estiver indisponível
    Dado que a aplicação está rodando em "TARGET_URL"
    Quando o script "infra/scripts/smoke-test.mjs" for executado
    Então ele deve validar "/api/v1/health", bloqueio "401" anônimo, login com cookie HttpOnly e logout retornando código 0

  Cenário: Teste de carga comprova suporte a 50 usuários simultâneos dentro do SLA
    Dado que o ambiente de homologação ("farmaubs-hml") está populado com dados sintéticos
    Quando o script "k6 run infra/load-tests/k6-ubs-carga.js" for executado com 50 VUs
    Então o percentil 95 de resposta ("p(95)") deve permanecer abaixo de 2000 ms
    E a taxa de requisições com erro deve ser inferior a 1%

  Cenário: Script de restauração recupera integralmente um backup gerado
    Dado que um backup ".dump" foi gerado por "backup-postgres-r2.sh"
    Quando "restore-postgres-r2.sh" for executado contra um banco PostgreSQL limpo
    Então todas as tabelas, registros e políticas de RLS devem ser restauradas sem erro
```

---

## 5. Checklist de DoD e aceitação

- [ ] `node infra/scripts/smoke-test.mjs` executado com sucesso contra ambiente local Docker Compose.
- [ ] `k6 run infra/load-tests/k6-ubs-carga.js` executado com sucesso validando `p(95) < 2000ms` e 50 VUs.
- [ ] Scripts `backup-postgres-r2.sh` e `restore-postgres-r2.sh` com `set -euo pipefail`, permissão de execução (`chmod +x`) e testados em restauração real contra banco limpo.
