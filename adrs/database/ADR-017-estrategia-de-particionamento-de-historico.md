# ADR-017 — Estratégia de Particionamento de Histórico

Criado por: João Henrique

## Status
🟢 Decidido e documentado — 23/07/2026

## Contexto

As tabelas de histórico do FarmaUBS — dispensas (RF010, RF012), movimentações de estoque (RF008, RF009, RF011) e log de auditoria (RF028, NF018) — crescem continuamente ao longo da operação do sistema e, dado o roadmap de expansão para múltiplos municípios (ADR-001), podem atingir volume relevante em poucos anos de operação.

Este ADR tem escopo deliberadamente reduzido: não decide a estratégia completa de retenção, expurgo ou arquivamento em armazenamento frio (isso é responsabilidade do ADR-018, ainda não priorizado). O objetivo aqui é decidir apenas **a chave de particionamento futura** dessas tabelas, de forma que elas já nasçam desenhadas corretamente — trocar a chave de particionamento de uma tabela após ela já conter dados de produção exige uma migração de schema custosa e arriscada, o que este ADR busca evitar por antecipação.

Critério de decisão: a chave de particionamento deve refletir o padrão real de consulta mais comum sobre essas tabelas. Os requisitos funcionais que consultam essas tabelas — RF012 (histórico de dispensas filtrado por período), RF014 (histórico de inventários por período), RF020/RF021 (relatórios por período) e RF028 (log de auditoria filtrado por período) — filtram predominantemente por janela de tempo.

### Opções avaliadas

**A — Particionamento por tempo (competência mês/ano, sobre a coluna de data da operação)**

Vantagens: alinhado ao padrão de consulta real do domínio, no qual praticamente todos os filtros relevantes sobre essas tabelas são por período. Permite *partition pruning* nativo do PostgreSQL — uma consulta filtrando por um intervalo recente toca apenas as partições relevantes, contribuindo diretamente para o cumprimento de NF007 (consultas em até 2 segundos) e NF008 (relatórios em até 30 segundos) à medida que o histórico cresce ao longo dos anos. Torna a futura implementação de arquivamento (ADR-018) direta: uma partição antiga pode ser desanexada (`DETACH PARTITION`) e movida para armazenamento frio sem afetar partições recentes.

Desvantagens: não contribui para isolamento entre tenants — mas isso não é papel esperado do particionamento neste desenho, já resolvido pelo RLS definido nos ADR-002 e ADR-016.

**B — Particionamento por tenant (`municipio_id`)**

Vantagens: isolaria fisicamente os dados de cada cliente em sua própria partição.

Desvantagens: contradiz diretamente a razão de ser da decisão tomada no ADR-002, que optou por isolamento row-level reforçado por RLS especificamente para evitar o overhead operacional de estruturas físicas por tenant (alternativa já comparada e rejeitada naquele ADR frente a schema-per-tenant). Particionar por `municipio_id` recriaria esse overhead em outra camada, exigindo criação de nova partição a cada novo município cliente. Não beneficia o padrão de consulta real do sistema, que filtra predominantemente por período, não por tenant isoladamente.

**C — Particionamento composto (`municipio_id` + período)**

Vantagens: nenhuma vantagem adicional identificada sobre a opção A isoladamente, dado que o isolamento de tenant já é resolvido pelo RLS.

Desvantagens: combina a complexidade de gerenciamento de partição por cliente (desvantagem da opção B) com a granularidade de tempo (já suficiente na opção A), sem benefício adicional. Complexidade desproporcional ao estágio atual do produto, na mesma linha de raciocínio que já levou à rejeição de chaves compostas de tenant no ADR-016.

**D — Não definir chave de particionamento agora, decidindo apenas quando o volume justificar**

Vantagens: nenhum esforço de modelagem adicional no curto prazo.

Desvantagens: é exatamente o risco que este ADR existe para evitar — sem uma coluna de data explícita, não-nula e indexada desenhada desde o início como futura chave de partição, uma decisão tardia exigiria reescrever a tabela inteira com o sistema já em produção, a migração custosa que motivou a criação deste ADR.

## Decisão

Adotar **particionamento por tempo (competência mês/ano)**, sobre a coluna de data de cada operação, como chave de particionamento futura das tabelas `dispensas`, `movimentacoes_estoque` e `log_auditoria`, com as seguintes definições:

- Cada uma dessas tabelas deve possuir, desde a sua criação, uma coluna de data explícita e não-nula (a própria coluna de timestamp da operação, ou uma coluna de competência derivada dela), desenhada como a futura chave de partição.
- Um índice sobre essa coluna é criado desde o início, o que já produz parte do ganho de desempenho de consulta por período mesmo antes de o particionamento físico ser ativado.
- A **implementação física do particionamento declarativo nativo do PostgreSQL permanece adiada** nesta fase — o volume de dados atual não a justifica. A conversão para tabela particionada de fato é registrada como gatilho de revisão explícito (ver seção "Revisão"), a ser executada quando o ADR-018 (retenção/arquivamento) for priorizado, ou quando o volume de linhas atingir um patamar mensurável que comprometa o desempenho de consulta.

## Consequências

**Positivas**
- As tabelas de histórico nascem desenhadas corretamente para uma futura conversão em tabelas particionadas, sem exigir migração custosa de schema em produção quando essa necessidade se tornar real.
- Índice sobre a coluna de data já traz parte do ganho de desempenho de consulta por período desde o primeiro sprint, mesmo sem particionamento físico ativo.
- Caminho direto para a implementação do ADR-018 (arquivamento por desanexação de partições antigas), quando esse ADR for priorizado.

**Negativas / trade-offs assumidos**
- O ganho de desempenho do *partition pruning* em si só se realiza quando o particionamento físico for de fato ativado — até lá, o benefício desta decisão é limitado ao índice sobre a coluna de data e à ausência de necessidade de migração futura.
- Fica sob responsabilidade do time de arquitetura monitorar o crescimento real dessas tabelas para acionar o gatilho de revisão no momento adequado, evitando que a ativação do particionamento físico seja postergada além do necessário.

## Revisão

Esta decisão deve ser revisitada, com prioridade para conversão em tabela particionada de fato, quando ocorrer pelo menos uma das seguintes condições:
- O ADR-018 (política de retenção e expurgo de dados) for priorizado para discussão e implementação.
- O volume de linhas de qualquer uma das tabelas `dispensas`, `movimentacoes_estoque` ou `log_auditoria` atingir um patamar que comece a comprometer, de forma mensurável, o cumprimento de NF007 ou NF008.

## Decisões relacionadas
- ADR-002 — Estratégia de multi-tenancy (isolamento resolvido por RLS, não por particionamento)
- ADR-015 — SGBD (PostgreSQL, suporte nativo a particionamento declarativo)
- ADR-016 — Modelagem multi-tenant no banco (chave primária simples, sem chave composta)
- ADR-018 — Política de retenção e expurgo de dados pessoais (LGPD) — ainda não priorizado
