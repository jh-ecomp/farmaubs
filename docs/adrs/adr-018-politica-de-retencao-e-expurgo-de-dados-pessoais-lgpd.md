## ADR-018 - Política de retenção e expurgo de dados pessoais (LGPD)

### Status
🟢 Decidido e documentado — última atualização: 18/11/2026

### Contexto

O FarmaUBS trata dados pessoais comuns de profissionais (nome, e-mail institucional) e **dados pessoais sensíveis vinculados à saúde** de pacientes (CPF, Cartão Nacional de Saúde — CNS e histórico de dispensação de medicamentos em `RF010` e `RF012`), além de logs de auditoria (`RF028`, `NF018`).

O `NF010` exige conformidade com a **Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD)**, o `ADR-025` proíbe dados reais de pacientes fora de produção, e o `ADR-027` exige sanitização de logs. Além disso, o `ADR-017` já estruturou as tabelas `dispensas`, `movimentacoes_estoque` e `log_auditoria` com chave de particionamento por tempo (competência mês/ano) justamente para viabilizar futuras rotinas de retenção e arquivamento.

Um ponto crítico do domínio de saúde pública é o conflito aparente entre **minimização/eliminação de dados (LGPD)** e **guarda regulatória (ANVISA/SUS/controle de estoque)**:
- Dados agregados e quantitativos de movimentação de medicamentos **não podem ser apagados** sem corromper o histórico de estoque, curva ABC (`RF019`), previsão de demanda (`RF015`) e auditoria contábil/sanitária.
- Já a **vinculação direta ao paciente** (CPF/CNS/nome) possui base legal específica (tutela da saúde / cumprimento de obrigação legal) e precisa de prazo claro de retenção e mecanismo de anonimização ou expurgo.

#### Opções avaliadas

**A - Anonimização progressiva *in-place* (preservando histórico de estoque/consumo)**

Após o prazo de retenção definido (ex.: 2 anos para dispensas comuns e 5 anos para antimicrobianos/controlados, ou conforme regra municipal), um job agendado (cron/worker) substitui os campos identificadores do paciente (`cpf`, `cns`, `nome`) por valores anonimizados irreversíveis (ex.: `ANONIMIZADO` ou hash com salt descartável) diretamente nas tabelas/partições antigas, mantendo intactos os registros de quantidade, lote, data e UBS. Inclui fluxo administrativo para anonimização sob demanda de um titular específico (Art. 18 da LGPD), quando não houver impedimento legal.

Vantagens:
- Preserva 100% da integridade referencial do estoque, da curva ABC (`RF019`) e do motor de previsão de demanda (`ADR-010`).
- Baixíssima complexidade operacional: não exige gerenciar armazenamento frio externo nem pipelines de reidratação para relatórios históricos de > 24 meses (`NF008`).
- Atende diretamente ao princípio de minimização da LGPD sem quebrar regras sanitárias de rastreabilidade de lotes.

Desvantagens:
- Não reduz o tamanho físico do banco de dados ao longo dos anos (apenas remove a identificação pessoal dos registros antigos).
- Exige cuidado na modelagem para que logs de auditoria (`log_auditoria`) e tabelas de outbox também tenham seus payloads antigos anonimizados, evitando vazamento residual de CPF/CNS em JSONBs.

**B - Arquivamento frio via `DETACH PARTITION` (ADR-017) + exclusão da base ativa**

Aproveita o particionamento mensal definido no `ADR-017`: após a janela quente operacional (ex.: 24 meses, alinhada ao `NF008`), as partições antigas de `dispensas` e `log_auditoria` são desanexadas (`ALTER TABLE ... DETACH PARTITION`), exportadas em formato comprimido e criptografado (ex.: Parquet ou dump SQL criptografado com `age`/`gpg`) para um Object Storage frio (Cloudflare R2 / Backblaze B2 / S3 Glacier) e removidas do PostgreSQL ativo. Após o prazo legal máximo (ex.: 5 ou 20 anos conforme norma sanitária), o arquivo frio é excluído definitivamente.

Vantagens:
- Mantém o banco PostgreSQL ativo enxuto, rápido e com baixo custo de disco SSD na VPS (`ADR-021`).
- Separa claramente dados operacionais recentes de dados de guarda legal/histórica em armazenamento de custo ínfimo.
- Evita rodar `UPDATE` em massa em milhões de linhas antigas (que geraria *bloat* e *vacuum* pesado no Postgres).

Desvantagens:
- Maior complexidade de implementação e manutenção (scripts de *detach*, exportação, verificação de integridade, catálogo de arquivos frios).
- Caso um auditor ou gestor solicite um histórico de paciente de 3 anos atrás, exige processo manual de restauração do arquivo frio.
- Se um titular pedir exclusão/anonimização pontual de um dado já arquivado em arquivo imutável frio, reescrever arquivos antigos é trabalhoso.

**C - Expurgo físico direto (*Hard Delete* / `DROP PARTITION`) após prazo de retenção**

Define uma janela fixa de retenção (ex.: 5 anos) para dados vinculados a pacientes e logs de auditoria. Ao vencer o prazo, um job executa `DROP PARTITION` (ou `DELETE`) removendo permanentemente os registros antigos do banco de dados, sem arquivamento frio.

Vantagens:
- Implementação mais simples e rápida de todas (especialmente via `DROP TABLE` de partições antigas, operação instantânea e sem *vacuum*).
- Garante eliminação total e definitiva dos dados pessoais ao fim do ciclo de vida, reduzindo superfície de exposição em caso de vazamento futuro.

Desvantagens:
- Destrói o histórico quantitativo de consumo/dispensação junto com o dado pessoal, inviabilizando análises históricas de longo prazo e auditoria retrospectiva de lotes caso um órgão de controle exija histórico superior à janela escolhida.
- Risco jurídico/regulatório elevado se o prazo de `DROP` conflitar com prazos legais de guarda de prontuário/receituário no serviço público (SUS/CFM/ANVISA).

### Decisão

Adotar a **Opção A — Anonimização progressiva *in-place* após 5 anos** (preservando o histórico quantitativo de estoque e consumo).

Regras operacionais definidas:
1. **Janela de retenção de identificação pessoal:** Dados identificadores de pacientes (`cpf`, `cns`, `nome`) vinculados a dispensas e seus respectivos payloads em `log_auditoria` / *outbox* são mantidos por **5 (cinco) anos** a partir da data da operação (cobrindo prazos de guarda sanitária/regulatória de medicamentos controlados e antimicrobianos).
2. **Anonimização automática após 5 anos:** Um job agendado mensalmente substitui os campos identificadores dos registros com idade superior a 5 anos por valores anonimizados irreversíveis (`ANONIMIZADO` / hash com salt descartável), mantendo intactos medicamento, lote, quantidade, data e unidade de saúde.
3. **Direitos do titular (Art. 18 da LGPD):** Solicitações pontuais de eliminação/anonimização são tratadas via rotina administrativa de anonimização *in-place* quando não houver obrigação legal de guarda.

### Consequências

**Positivas**
- Preserva integralmente a consistência do histórico de estoque, curva ABC (`RF019`) e motor de previsão de demanda (`ADR-010`).
- Simplicidade operacional: dispensa pipelines de arquivamento frio e reidratação para consultas históricas.
- Concilia a minimização de dados da LGPD (`NF010`) com as exigências sanitárias de rastreabilidade de lotes.

**Negativas / trade-offs assumidos**
- O volume físico em disco do PostgreSQL continua crescendo ao longo do tempo (mitigável futuramente caso necessário com o particionamento já preparado no `ADR-017`).
- Exige disciplina para garantir que novos campos JSONB de auditoria/outbox também sejam cobertos pela rotina de anonimização.

### Revisão

Esta decisão deve ser revisitada caso:
- O crescimento de volume físico em disco após múltiplos anos passe a degradar custos de VPS/backup, justificando combinar a anonimização com `DETACH PARTITION` para armazenamento frio (Opção B).
- Alterações na legislação sanitária (ANVISA/SUS) ou contratos municipais exijam prazo distinto de 5 anos.

### Decisões relacionadas
- [ADR-015](adr-015-sgbd.md) - SGBD (PostgreSQL)
- [ADR-016](adr-016-modelagem-multi-tenant-no-banco.md) - Modelagem multi-tenant no banco (RLS)
- [ADR-017](adr-017-estrategia-de-particionamento-de-historico.md) - Estratégia de particionamento de histórico (base para arquivamento/expurgo por competência)
- [ADR-025](adr-025-estrategia-de-ambientes.md) - Estratégia de ambientes (proibição de dados reais em homologação)
- [ADR-027](adr-027-gestao-de-segredos-e-configuracao.md) - Gestão de segredos e configuração (sanitização de logs)
