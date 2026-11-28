## ADR-020 - Estratégia de backup e disaster recovery

### Status
🟢 Decidido e documentado — última atualização: 18/11/2026

### Contexto

O `ADR-021` definiu hospedagem em **VPS única com Docker Compose**, assumindo explicitamente o risco de ausência de redundância nativa de hardware — se a VPS falhar, o serviço para até recuperação manual. Ao mesmo tempo, o `NF006` do documento de requisitos estabelece metas rígidas de confiabilidade:
- **Backup completo diário** e **backup incremental a cada 4 horas**;
- **Retenção mínima de 30 dias**;
- **Restauração (RTO) em até 4 horas** (e perda máxima de dados / RPO compatível com a janela de 4 horas);
- Conformidade com o `NF010` (LGPD): como o banco armazena CPF/CNS de pacientes, backups armazenados fora da VPS devem ser **criptografados**.

Além disso, armazenar backups apenas no mesmo disco ou no mesmo provedor da VPS não protege contra falha de datacenter, bloqueio de conta ou comprometimento por ransomware.

#### Opções avaliadas

**A - `pg_dump` (diário) + dumps incrementais/agendados a cada 4h com criptografia client-side (`age`/`gpg`) + `rclone` para Object Storage off-site**

Um container/cron na VPS executa `pg_dump -Fc` (formato custom comprimido) diariamente e snapshots/dumps a cada 4h (ou por tabelas/esquema), criptografa o arquivo localmente com chave pública (`age` ou `gpg`, mantendo a chave privada fora da VPS) e envia via `rclone` para um bucket S3-compatível em provedor separado da VPS (ex.: Cloudflare R2 ou Backblaze B2) com política de ciclo de vida de 30+ dias e alerta de falha (ex.: Healthchecks.io).

Vantagens:
- Muito simples de entender, implementar e restaurar (`pg_restore`) — sem necessidade de configurar arquivamento contínuo de WAL no PostgreSQL.
- Custo baixíssimo (Cloudflare R2 possui 10 GB gratuitos e zero taxa de egresso; Backblaze B2 custa ~$6/TB/mês).
- Totalmente portável entre qualquer VPS e qualquer S3-compatível (`ADR-021`).

Desvantagens:
- `pg_dump` a cada 4 horas faz leitura lógica completa do banco: em bancos pequenos (< 10-20 GB) funciona muito bem, mas não é um "incremental" real em nível de bloco — conforme o volume cresce, aumenta o uso de I/O e rede a cada 4 horas.
- RPO limitado ao intervalo exato do cron (até 4h de perda de dados em caso de desastre entre execuções).

**B - `pgBackRest` (ou `WAL-G`) com arquivamento contínuo de WAL (*PITR*) direto para Object Storage off-site**

Configura o PostgreSQL com `archive_mode = on` usando `pgBackRest` (ou `WAL-G`) para enviar continuamente os segmentos de WAL (*Write-Ahead Log*) e executar backup full diário + incremental/diferencial a cada 4 horas, com criptografia AES-256 nativa antes do envio ao Object Storage off-site (Cloudflare R2 / Backblaze B2 / AWS S3).

Vantagens:
- Atende literalmente ao `NF006` com **incremental real** (apenas blocos/WALs alterados) e habilita **PITR (*Point-in-Time Recovery*)**: permite restaurar o banco para qualquer segundo exato antes de um erro humano ou incidente (RPO de segundos/minutos, muito melhor que 4h).
- Compressão e criptografia nativas integradas à ferramenta, além de verificação automática de integridade dos backups.
- Escalável para dezenas ou centenas de gigabytes sem gargalo de `pg_dump` a cada 4h.

Desvantagens:
- Curva de aprendizado e configuração inicial mais alta no PostgreSQL (ajuste de `postgresql.conf`, `archive_command`, permissões no container).
- Exige atenção redobrada no procedimento de restore (DR Runbook) e testes periódicos, pois um erro na cadeia de WALs pode invalidar a restauração se não for monitorado.

**C - Migrar apenas o PostgreSQL para Banco Gerenciado Externo com PITR nativo (ex.: Neon, Supabase Pro, AWS RDS) mantendo a API/Frontend na VPS**

Revê parcialmente o `ADR-021` apenas para a camada de banco de dados: a API e o Frontend continuam em Docker Compose na VPS de baixo custo, enquanto o PostgreSQL roda em um serviço gerenciado que já inclui backups automáticos, replicação, retenção de 30 dias e PITR em nuvem separada.

Vantagens:
- Elimina quase todo o esforço operacional de gerenciar scripts de backup, criptografia de dump e rotação de WALs.
- Alta disponibilidade e durabilidade gerenciadas pelo provedor (com SLA formal).

Desvantagens:
- Aumenta o custo mensal fixo em dólar (planos com retenção de 30 dias e PITR costumam partir de ~$19–$50+/mês, acima do custo de uma VPS inteira).
- Adiciona latência de rede entre a VPS (API) e o banco gerenciado se não estiverem na mesma região/datacenter — crítico para um sistema que usa sessão server-side no Postgres a cada requisição (`ADR-006`).
- Exige validação rigorosa de compatibilidade com Row-Level Security (`ADR-016`) e particionamento (`ADR-017`).

### Decisão

Adotar como arquitetura-alvo a **Opção B — `pgBackRest` com arquivamento contínuo de WAL (*PITR*) direto para Object Storage off-site**, implantada em **duas fases pragmáticas** conforme a maturidade operacional do projeto:

- **Fase 1 (Release 1 / Piloto — `RL-08`):** `pg_dump -Fc` agendado (a cada 4h / diário) + envio automatizado via `rclone` para bucket privado no **Cloudflare R2** (retenção de 30 dias + script testado `restore-postgres-r2.sh` validando tabelas e políticas de RLS, atendendo `RTO <= 4h` e janela de 4h do `NF006` sem complexidade prematura de WAL em banco de piloto).
- **Fase 2 (Escala Comercial):** evolução para **`pgBackRest` com arquivamento contínuo de WAL (*PITR*)** conforme as definições abaixo.

Definições operacionais da arquitetura completa:
1. **Frequência e Retenção (`NF006`):** Backup *full* diário (madrugada), backup diferencial/incremental a cada **4 horas** e arquivamento contínuo de WAL (`archive_mode = on`), com retenção mínima de **30 dias** no bucket off-site.
2. **Isolamento de Nuvem e Criptografia:** Os backups são criptografados com AES-256 pelo próprio `pgBackRest` antes de sair da VPS e enviados para um bucket S3-compatível em provedor distinto da VPS (ex.: **Cloudflare R2** ou **Backblaze B2**) com versionamento/imutabilidade habilitados.
3. **Recuperação de Desastres (DR) e Teste Periódico:** Manter *runbook* de DR versionado visando **RTO <= 4 horas** e **RPO <= minutos** (melhor que o teto de 4h do `NF006`). Executar **teste prático de restauração trimestral** em ambiente isolado e monitorar falhas de backup/arquivamento com alertas externos (`ADR-026`).

### Consequências

**Positivas**
- Atende integralmente ao `NF006` com incremental real em nível de bloco e capacidade de *Point-in-Time Recovery (PITR)* para qualquer segundo exato.
- Criptografia nativa antes do envio off-site garante conformidade com o `NF010` (LGPD).
- Baixo custo de armazenamento em Object Storage separado da VPS, eliminando o ponto único de falha do `ADR-021`.

**Negativas / trade-offs assumidos**
- Exige configuração inicial cuidadosa do `postgresql.conf` (`archive_mode`, `archive_command`) e do `pgBackRest` no container/volume do PostgreSQL.
- Exige monitoramento contínuo do arquivamento de WAL (se o envio de WAL travar, o disco da VPS pode encher) e disciplina nos testes trimestrais de restauração.

### Revisão

Esta decisão deve ser revisitada caso:
- A equipe opte futuramente por migrar o banco para um serviço PostgreSQL gerenciado com PITR nativo após o produto gerar receita recorrente.

### Decisões relacionadas
- [ADR-006](adr-006-modelo-de-autenticacao-e-autorizacao.md) - Modelo de autenticação (sessões no PostgreSQL)
- [ADR-015](adr-015-sgbd.md) - SGBD (PostgreSQL)
- [ADR-016](adr-016-modelagem-multi-tenant-no-banco.md) - Modelagem multi-tenant no banco (RLS)
- [ADR-021](adr-021-provedor-de-nuvem-e-topologia-de-hospedagem.md) - Provedor de nuvem e topologia de hospedagem (VPS única, risco que este ADR mitiga)
- [ADR-026](adr-026-observabilidade.md) - Observabilidade (alertas de falha de backup)
