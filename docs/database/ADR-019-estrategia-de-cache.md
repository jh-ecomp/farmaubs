# ADR-019 — Estratégia de Cache

Criado por: João Henrique

## Status
🟢 Decidido e documentado — 24/07/2026

## Contexto

Os dashboards de indicadores (RF018) e a curva ABC (RF019) exibem dados calculados — consumo médio diário e mensal, tempo médio de permanência em prateleira, cobertura de estoque em dias, classificação ABC — não simples leituras diretas de tabela. O NF007 exige carregamento do dashboard em até 3 segundos e retorno de consultas/filtros em até 2 segundos, para bases de até 12 meses de histórico.

Com a volumetria atual (poucas UBSs parceiras, teto de planejamento de algumas centenas de requisições simultâneas, conforme já caracterizado desde a fase de levantamento de requisitos arquiteturais), é provável que consultas diretas ao PostgreSQL, mesmo recalculando os indicadores a cada requisição, já atendam ao NF007 sem necessidade de cache. No entanto, o NF007 é um requisito contínuo, não uma validação pontual — à medida que o histórico cresce ao longo dos anos (motivação da própria estratégia de particionamento do ADR-017), consultas de agregação sobre os indicadores tendem a ficar mais custosas.

### Opções avaliadas

**A — Sem cache, consulta direta ao PostgreSQL a cada requisição**

Vantagens: nenhuma infraestrutura nova; nenhuma complexidade de invalidação de cache, historicamente uma fonte comum de erro em software; dado sempre atualizado, sem risco de exibir indicador desatualizado ao farmacêutico. Com os índices já antecipados no ADR-017 (coluna de data indexada) e a volumetria atual, atende provavelmente ao NF007 sem esforço adicional no curto prazo.

Desvantagens: o tempo de consulta tende a crescer com o volume de histórico acumulado ao longo dos anos, podendo eventualmente comprometer o NF007 sem nenhuma camada de mitigação prevista desde já.

**B — Cache de aplicação em memória (in-process, ex.: `cache-manager` do NestJS, sem Redis)**

Vantagens: nenhuma infraestrutura nova — executa dentro do próprio processo Node.js já decidido no ADR-005. Resolve o caso de uso mais comum: o mesmo farmacêutico atualizando repetidamente a mesma tela de dashboard em um curto intervalo de tempo. Simples de implementar e de remover, caso se mostre desnecessário.

Desvantagens: o cache não é compartilhado entre múltiplas instâncias da aplicação, caso ela venha a ser escalada horizontalmente no futuro — cada instância manteria seu próprio cache, potencialmente inconsistente entre si. O cache é perdido a cada reinício do container — aceitável, dado que os dados armazenados são inteiramente recalculáveis a partir do banco de dados, não constituindo perda de informação.

**C — Redis dedicado**

Vantagens: cache compartilhado entre múltiplas instâncias da aplicação, caso essa necessidade venha a existir; suporta mecanismos de invalidação mais sofisticados (pub/sub, TTL granular por chave).

Desvantagens: introduz infraestrutura nova — mais um serviço para operar, monitorar e manter na VPS de custo mínimo definida no ADR-021, sem justificativa de necessidade real no cenário atual. Resolve um problema de escala horizontal que o ADR-001 já caracterizou como não necessário nesta fase, dado o teto de volumetria projetado.

## Decisão

Adotar **cache de aplicação em memória** (opção B), com **TTL curto (60 a 120 segundos)**, aplicado especificamente aos endpoints de indicadores e dashboard definidos em RF018 e RF019.

Esta escolha equilibra proporcionalidade entre custo e benefício: é mais barato e operacionalmente mais simples que Redis — que resolveria um problema de escala horizontal inexistente no cenário atual — e mais resiliente ao crescimento contínuo do volume de histórico do que a ausência total de cache, amortecendo o custo crescente de consultas de agregação sem introduzir infraestrutura adicional.

## Consequências

**Positivas**
- Redução do custo de consultas de agregação repetidas em curtos intervalos de tempo, sem infraestrutura adicional.
- Nenhuma complexidade de invalidação distribuída de cache, dado que o TTL curto naturalmente expira o dado sem necessidade de mecanismo explícito de invalidação.
- Mitigação parcial e antecipada do risco de degradação de desempenho à medida que o histórico cresce ao longo dos anos, sem custo de infraestrutura hoje.

**Negativas / trade-offs assumidos**
- Um indicador exibido pode estar até 60–120 segundos desatualizado em relação ao estado real do banco de dados — aceitável dado que os indicadores de RF018/RF019 são de natureza analítica e gerencial, não operações que exigem consistência imediata.
- Caso a aplicação venha a ser escalada horizontalmente no futuro (múltiplas réplicas atrás de um balanceador de carga), o cache em memória por instância deixa de ser suficiente, exigindo reavaliação desta decisão.

## Revisão

Esta decisão deve ser revisitada caso:
- A aplicação passe a ser executada em múltiplas instâncias/réplicas simultâneas, cenário em que o cache em memória por instância se torna insuficiente e a introdução de Redis passa a se justificar.
- O tempo de consulta dos indicadores, mesmo com o cache em memória, comece a comprometer o cumprimento do NF007 de forma mensurável, à medida que o histórico cresce.

## Decisões relacionadas
- ADR-005 — Linguagem e framework do backend (NestJS, suporte nativo a cache em memória)
- ADR-001 — Estilo de decomposição e comunicação (ausência de necessidade de escala horizontal nesta fase)
- ADR-017 — Estratégia de particionamento de histórico (crescimento de volume que motiva esta decisão)
- ADR-021 — Provedor de nuvem e topologia de hospedagem (restrição de custo mínimo de infraestrutura)
