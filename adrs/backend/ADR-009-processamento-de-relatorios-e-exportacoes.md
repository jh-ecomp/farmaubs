# ADR-009 — Processamento de Relatórios e Exportações

Criado por: João Henrique

## Status
🟢 Decidido e documentado — 24/07/2026

## Contexto

O documento de requisitos define três funcionalidades de exportação de arquivo: exportação do pedido mensal para .xlsx (RF017), relatório de perdas por vencimento em .pdf e .xlsx (RF020), e relatório de inventário mensal em .pdf e .xlsx (RF021), este último com SLA de geração e disponibilização em até 30 segundos para períodos de até 24 meses (NF008).

O ADR-004 já reservou o mecanismo de outbox pattern especificamente para RF020 e RF021, caracterizados como "relatórios pesados", deixando RF017 implicitamente fora desse fluxo assíncrono. Este ADR formaliza esse raciocínio e resolve os pontos que ainda restavam em aberto: o mecanismo de notificação ao frontend sobre a conclusão do relatório, o local de armazenamento do arquivo gerado, e um risco técnico específico introduzido pela escolha de Node.js como runtime do backend (ADR-005).

**Risco técnico relevante**: Node.js executa em uma única thread principal (event loop). Caso a geração de um relatório — em especial a geração de PDF, tipicamente feita via renderização de HTML (ex.: Puppeteer) — seja executada de forma síncrona dentro dessa thread, ela bloqueia o processamento de todas as demais requisições da API durante a geração, não apenas a requisição do usuário que solicitou o relatório. Este é um risco de disponibilidade, distinto da simples percepção de lentidão, e precisa ser endereçado independentemente de a geração do relatório ser síncrona ou assíncrona do ponto de vista do fluxo de negócio.

### Análise por funcionalidade

**RF017 — Exportação de pedido mensal**: opera sobre um volume de dados pequeno e conhecido (os itens de um único pedido), sem período configurável de histórico. A geração é rápida e não compete de forma relevante com outras requisições da API. Tratar este caso pelo fluxo assíncrono do outbox introduziria complexidade (identificador de job, polling) sem ganho real, contrariando o princípio de proporcionalidade já aplicado em decisões anteriores (ADR-001, ADR-004).

**RF020 e RF021 — Relatórios de perdas e de inventário**: operam sobre período configurável e, com o crescimento do histórico já antecipado no ADR-017, podem envolver volume de dados significativamente maior — os "relatórios pesados" já identificados como candidatos ao outbox pattern desde o ADR-004.

### Opções avaliadas para o mecanismo de geração de RF020/RF021

**A — Outbox (ADR-004), com geração do arquivo ainda na thread principal do processo**

Vantagens: reaproveita o worker do outbox já decidido, sem infraestrutura nova.

Desvantagens: não resolve o risco de bloqueio do event loop — o worker roda no mesmo container/processo (ADR-023), de modo que, mesmo sendo assíncrono do ponto de vista do fluxo de negócio, a geração do arquivo ainda bloquearia a mesma thread que atende as demais requisições da API.

**B — Outbox (ADR-004), com geração do arquivo executada em `worker_threads` nativo do Node.js, dentro do mesmo container**

Vantagens: resolve o risco de bloqueio do event loop sem exigir processo ou container adicional — a thread de trabalho (`worker_thread`) executa em paralelo real à thread principal. Permanece coerente com a decisão do ADR-023 de manter o worker do outbox no mesmo container da API. Recurso nativo e maduro do ecossistema Node.js, disponível desde versões antigas do runtime, sem dependência de biblioteca externa para a paralelização em si.

Desvantagens: exige código adicional de coordenação (transferência de dados de entrada para a thread de trabalho e recebimento do resultado) em comparação a uma geração direta — custo pequeno e proporcional ao risco mitigado.

**C — Processo ou container dedicado à geração de relatórios**

Vantagens: isolamento completo de recursos para a geração de relatórios, sem risco de disputar CPU com a API principal.

Desvantagens: antecipa exatamente a extração que os ADR-004 e ADR-023 já registraram como gatilho de revisão futura, não como decisão necessária no estágio atual — desproporcional ao volume real de relatórios gerados por dia nesta fase do produto (poucas UBSs parceiras).

## Decisão

1. **RF017 (exportação de pedido)**: processado de forma **síncrona**, dentro do ciclo request-response normal da API, sem passar pelo mecanismo de outbox.
2. **RF020 e RF021 (relatórios de perdas e inventário)**: processados de forma **assíncrona via outbox pattern** (ADR-004), com a geração do arquivo — em especial a geração de PDF — executada em **`worker_threads`**, de modo a não bloquear a thread principal do processo Node.js que atende as demais requisições da API.
3. **Notificação ao frontend sobre a conclusão do relatório**: via **polling simples**, seguindo o estilo REST já definido no ADR-007 (ex.: `GET /api/v1/relatorios/:jobId/status`). Não é adotado WebSocket ou Server-Sent Events, dado que não há requisito de notificação em tempo real e o SLA de até 30 segundos do NF008 é plenamente compatível com polling em intervalos curtos.
4. **Armazenamento do arquivo gerado**: em disco local da VPS definida no ADR-021, em um caminho de diretório isolado por `municipio_id`/`unidade_id`. O download do arquivo exige a mesma autenticação e autorização (RBAC, ADR-006) de qualquer outro endpoint da API — nunca um link estático de acesso público.
5. **Política de expurgo de arquivos gerados**: arquivos de relatório gerados há mais de 48 horas são removidos automaticamente do disco local, evitando acúmulo indefinido de espaço em disco na VPS de custo mínimo.

## Consequências

**Positivas**
- Proporcionalidade entre complexidade de implementação e volume real de dados de cada funcionalidade — RF017 permanece simples, RF020/RF021 recebem o tratamento assíncrono que seu volume potencial justifica.
- Risco de bloqueio do event loop por geração de PDF mitigado sem necessidade de infraestrutura adicional, preservando a decisão de manter o worker do outbox no mesmo container (ADR-023).
- Mecanismo de notificação (polling) simples, coerente com o estilo REST já adotado, sem introduzir tecnologia de comunicação em tempo real desnecessária.
- Custo de armazenamento em disco controlado por política de expurgo automática.

**Negativas / trade-offs assumidos**
- Uso de `worker_threads` introduz código de coordenação adicional que a equipe backend júnior precisa compreender, ainda que de escopo limitado a esta funcionalidade específica.
- Armazenamento em disco local da VPS (não em armazenamento externo dedicado) significa que a disponibilidade dos arquivos de relatório está atrelada à disponibilidade da própria VPS — consistente com a topologia de hospedagem já aceita no ADR-021, sem agravá-la.
- Polling do frontend gera requisições periódicas adicionais à API enquanto um relatório está em processamento — volume desprezível dado o baixo número de relatórios gerados simultaneamente nesta fase.

## Revisão

Esta decisão deve ser revisitada caso:
- O volume ou a frequência de geração de relatórios cresça a ponto de `worker_threads` não ser suficiente para isolar adequadamente o impacto no event loop principal, justificando a extração para um processo ou container dedicado (opção C).
- Surja um requisito de notificação em tempo real sobre a conclusão de relatórios, que o polling não atenda de forma satisfatória.
- O volume de arquivos gerados exija uma política de expurgo mais sofisticada ou armazenamento externo dedicado, em vez de disco local da VPS.

## Decisões relacionadas
- ADR-004 — Estratégia de comunicação entre módulos internos (outbox pattern, origem da distinção síncrono/assíncrono)
- ADR-005 — Linguagem e framework do backend (Node.js, origem do risco de bloqueio do event loop)
- ADR-006 — Modelo de autenticação e autorização (aplicado ao download de relatórios)
- ADR-007 — Estratégia de API (padrão REST para o endpoint de status de geração)
- ADR-017 — Estratégia de particionamento de histórico (crescimento de volume que caracteriza RF020/RF021 como "pesados")
- ADR-021 — Provedor de nuvem e topologia de hospedagem (armazenamento em disco local da VPS)
- ADR-023 — Containerização e orquestração (worker do outbox no mesmo container)
