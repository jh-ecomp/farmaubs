## ADR-026 - Observabilidade

### Status
🟢 Decidido e documentado — última atualização: 18/11/2026

### Contexto

O FarmaUBS operará em VPS única (`ADR-021`) atendendo farmácias de UBSs em tempo real, com meta de disponibilidade de **99,5% mensais (`NF004`)**, tempo de resposta de **<= 2s/3s (`NF007`)** e worker assíncrono do *outbox pattern* rodando no mesmo container da API (`ADR-023`).

Sem observabilidade mínima antes do Go-Live, a equipe enfrenta três riscos operacionais imediatos:
1. **Ficar cega a quedas:** só descobrir que a aplicação caiu quando um farmacêutico ligar reclamando.
2. **Disco cheio silencioso:** logs de containers Docker sem rotação ou crescimento do banco derrubando `hml` e `prod` simultaneamente (`ADR-025`).
3. **Vazamento de PII em logs:** o `ADR-027` exige que nenhum segredo, senha, token, CPF ou CNS apareça em logs de aplicação ou rastreamento de erros (`NF010`).

#### Opções avaliadas

**A - Stack Enxuta SaaS (Free Tier) + Uptime Externo (`Pino` + `Sentry` + `BetterStack / Uptime Kuma`)**

Instrumenta o NestJS com **Pino** (`nestjs-pino`) gerando logs JSON estruturados com redação automática (*redaction*) de campos sensíveis (`password`, `cpf`, `cns`, `authorization`, `cookie`) e rotação de logs no Docker (`max-size: 10m`, `max-file: 5`). Conecta o **Sentry** (camada gratuita) no Backend e Frontend para capturar exceções com stack trace. Usa **Uptime Kuma** (em instância externa gratuita/barata) ou **BetterStack** para monitorar `GET /api/v1/health` a cada 1 minuto e disparar alertas (Telegram/Slack/E-mail), complementado por alertas básicos de disco/CPU/RAM na VPS (ex.: Netdata ou script simples).

Vantagens:
- Consumo quase nulo de RAM/CPU na VPS de produção (essencial quando `hml` e `prod` dividem a mesma máquina).
- Tempo de configuração muito baixo (horas, não dias) e alertas externos funcionam mesmo se a VPS inteira sair do ar.
- Sentry entrega diagnóstico imediato de erros de React e NestJS sem precisar garimpar arquivos de log.

Desvantagens:
- Os logs completos ficam apenas nos arquivos rotacionados da VPS (sem busca centralizada histórica avançada em nuvem, a menos que enviados a um agregador).
- Dependência de limites do *free tier* de terceiros (Sentry/BetterStack), que podem exigir plano pago caso o volume de erros/eventos cresça muito.

**B - Stack Self-Hosted na VPS (`Grafana + Loki + Prometheus + Promtail + Postgres Exporter`)**

Sobe uma stack completa de observabilidade em containers Docker (preferencialmente em uma segunda micro-VPS separada, ou na própria VPS se houver folga de RAM): **Promtail** coleta logs JSON dos containers para o **Loki**; **Prometheus** coleta métricas da VPS (`node_exporter`), containers (`cAdvisor`), API NestJS e PostgreSQL (`postgres_exporter`); e o **Grafana** centraliza dashboards e alertas.

Vantagens:
- Controle 100% dos dados em infraestrutura própria (zero envio de telemetria para SaaS de terceiros, facilitando auditorias rígidas de LGPD).
- Sem limites artificiais de retenção ou custo por volume de logs/métricas conforme o produto cresce.
- Visibilidade profunda do PostgreSQL (locks `SELECT ... FOR UPDATE`, conexões ativas, cache hit ratio, tamanho de partições).

Desvantagens:
- Overhead de RAM/CPU/Disco relevante (Grafana + Loki + Prometheus consomem facilmente 1–2 GB de RAM).
- Se rodar na mesma VPS da aplicação e a VPS cair, o monitoramento cai junto — exigindo pelo menos um check externo para uptime.
- Maior esforço de manutenção e curva de aprendizado para uma equipe júnior.

**C - Plataforma Unificada via OpenTelemetry (`OTel Collector` + `Grafana Cloud Free` / `SigNoz` / `Datadog`)**

Instrumenta a API NestJS com **OpenTelemetry SDK** (logs, métricas e traces distribuídos) exportando via OTLP para uma plataforma gerenciada com camada gratuita generosa (como **Grafana Cloud Free** — 50 GB logs, 10k séries de métricas, 50 GB traces/mês) ou **SigNoz**.

Vantagens:
- Padrão aberto da indústria (*OpenTelemetry*): zero *vendor lock-in* de instrumentação — trocar o backend de observabilidade no futuro é apenas mudar a URL do exportador.
- Correlaciona automaticamente *Traces* (quanto tempo levou a query no Postgres vs. o controller NestJS), *Logs* e *Métricas* em um único lugar, excelente para investigar lentidão (`NF007`).

Desvantagens:
- Instrumentação inicial de OpenTelemetry em Node/NestJS exige configuração cuidadosa de sanitização para não vazar parâmetros com PII em spans/queries SQL.
- Em planos gratuitos, há limites mensais de ingestão e retenção reduzida (ex.: 14 dias no Grafana Cloud Free).

### Decisão

Adotar a **Opção A — Stack Enxuta SaaS (Free Tier) + Uptime Externo (`Pino` + `Sentry` + `Uptime Kuma / BetterStack`)**:

1. **Logs Estruturados e Sanitizados:** Configurar o backend NestJS com `pino` (`nestjs-pino`) emitindo JSON em `stdout` com `requestId` e `tenantId`, aplicando redação automática (*redaction*) de `password`, `cpf`, `cns`, `authorization` e `cookie` (`ADR-027`, `NF010`). Configurar rotação de logs no Docker (`max-size: "10m"`, `max-file: "5"`) no `docker-compose.prod.yml` para evitar esgotamento de disco na VPS.
2. **Rastreamento de Erros:** Integrar **Sentry** (camada gratuita) no Backend (`apps/backend`) e no Frontend (`apps/frontend`) com filtro/sanitização de PII (*beforeSend*).
3. **Monitoramento Externo e Recursos:** Monitorar `GET /api/v1/health` a cada 1 minuto via **Uptime Kuma** (em instância externa) ou **BetterStack**, além de alertas de falha de backup (`ADR-020`) e alertas básicos de disco (> 80%), RAM (> 85%) e CPU (> 90%) na VPS.

### Consequências

**Positivas**
- Consumo mínimo de RAM e CPU na VPS compartilhada entre `farmaubs-hml` e `farmaubs-prod` (`ADR-025`).
- Alertas externos continuam funcionando mesmo em queda total da VPS.
- Implantação rápida e diagnóstico imediato de exceções de produção no Sentry.

**Negativas / trade-offs assumidos**
- Logs completos residem apenas nos arquivos rotacionados da VPS (sem busca centralizada de longo prazo em nuvem).
- Sujeito aos limites de eventos do *free tier* do Sentry/BetterStack conforme o tráfego crescer.

### Revisão

Esta decisão deve ser revisitada caso:
- O volume de eventos ultrapasse o *free tier* das ferramentas SaaS ou surja necessidade de busca centralizada de logs e métricas profundas de banco, justificando migrar para Grafana/Loki/Prometheus (Opção B) ou OpenTelemetry (Opção C).

### Decisões relacionadas
- [ADR-021](adr-021-provedor-de-nuvem-e-topologia-de-hospedagem.md) - Provedor de nuvem e topologia de hospedagem (restrição de recursos da VPS única)
- [ADR-023](adr-023-containerizacao-e-orquestracao.md) - Containerização e orquestração (worker outbox e healthchecks)
- [ADR-025](adr-025-estrategia-de-ambientes.md) - Estratégia de ambientes (compartilhamento de VPS entre HML e PROD)
- [ADR-027](adr-027-gestao-de-segredos-e-configuracao.md) - Gestão de segredos e configuração (regra de sanitização de logs)
