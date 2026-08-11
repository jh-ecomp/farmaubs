# ADR-010 — Motor de Previsão de Demanda

Criado por: João Henrique

## Status
🟢 Decidido e documentado — 24/07/2026

## Contexto

O RF015 exige que o sistema calcule e exiba uma sugestão de quantidade a pedir para cada medicamento, com base em: consumo médio histórico (mínimo 3 meses, preferencialmente 12 meses para capturar sazonalidade), estoque atual, tempo médio de entrega da CAF (configurável por unidade de saúde, conforme RF026/RF027), aplicando ponto de pedido e estoque de segurança.

Trata-se da funcionalidade mais algorítmica do sistema — não uma operação CRUD, mas um cálculo sobre série histórica de consumo. O requisito, tal como escrito, corresponde a uma fórmula de gestão de estoque bem estabelecida (ponto de reposição = consumo médio diário × tempo de entrega + estoque de segurança), não a um modelo estatístico ou preditivo sofisticado.

Este ADR decide a abordagem de implementação desse motor de cálculo, considerando: a natureza determinística do que o RF015 efetivamente exige; a necessidade de auditabilidade e explicabilidade da sugestão gerada, relevante em um contexto de gestão de abastecimento de saúde pública onde decisões podem ser questionadas; o volume limitado de dados históricos disponível durante a fase de piloto (poucos meses de operação real); e a arquitetura hexagonal já definida no ADR-003, que favorece a formalização de regras de negócio relevantes como casos de uso explícitos.

### Opções avaliadas

**A — Regra determinística simples, implementada como caso de uso explícito dentro do módulo de pedidos**

Vantagens: corresponde exatamente ao que o RF015 exige — uma fórmula com parâmetros configuráveis por unidade de saúde (limiar de alerta, estoque de segurança, tempo de entrega, já previstos em RF026/RF027), sem elementos probabilísticos ou adaptativos não solicitados pelo requisito. Testável unitariamente de forma direta (ADR-030), com entrada e saída determinísticas, sem necessidade de dataset de treino ou validação estatística. Não introduz infraestrutura nova, residindo inteiramente dentro do monolito modular já decidido (ADR-001), como qualquer outro caso de uso do domínio. Auditável e explicável para o farmacêutico — a origem de uma sugestão de quantidade é rastreável a uma fórmula determinística, característica valiosa em um contexto de gestão pública de abastecimento de medicamentos.

Desvantagens: não captura sazonalidade de forma sofisticada além de médias móveis simples sobre a janela configurável de 3 a 12 meses — mas esta limitação é consistente com o que o próprio documento de requisitos pede, que menciona apenas "capturar sazonalidade" via essa janela, não um modelo preditivo.

**B — Serviço ou módulo estatístico mais sofisticado (médias móveis ponderadas, suavização exponencial, ou modelo de série temporal)**

Vantagens: potencial de maior precisão de previsão à medida que mais dados históricos de qualidade estejam disponíveis.

Desvantagens: nenhum requisito funcional do documento original exige esse nível de sofisticação nesta fase — introduzi-lo agora seria resolver um problema não colocado na mesa, o mesmo risco de over-engineering já evitado em outras decisões (ADR-001, ADR-004). Reduz a explicabilidade da sugestão gerada, diminuindo a auditabilidade valiosa neste contexto. Exige volume e qualidade de dados históricos superiores ao que a fase de piloto, com poucos meses de operação real, tende a oferecer — a ferramenta certa, porém no momento errado do produto.

**C — Serviço externo ou extraível desde já (ex.: microsserviço dedicado de previsão)**

Vantagens: isolamento de responsabilidade e possibilidade de escalar o motor de previsão de forma independente.

Desvantagens: contradiz diretamente o ADR-001, que estabeleceu o monolito modular sem justificativa de volumetria para extração de qualquer módulo nesta fase. Não há razão técnica atual para isolar este cálculo como serviço separado.

## Decisão

Adotar **regra determinística simples** (ponto de pedido e estoque de segurança, com médias móveis sobre a janela configurável de 3 a 12 meses definida pelo RF015), implementada como um **caso de uso explícito** dentro do módulo de pedidos, seguindo a arquitetura hexagonal do ADR-003 — por se tratar da regra de negócio de maior complexidade do domínio, é um candidato natural à formalização como caso de uso nomeado (ex.: `CalcularSugestaoDePedido`), em vez de uma passagem direta e simplificada como seria aceitável para funcionalidades puramente CRUD. Esta formalização também facilita o cumprimento do teste unitário obrigatório definido no ADR-030 para todo caso de uso novo do domínio.

## Consequências

**Positivas**
- Implementação proporcional ao que o RF015 efetivamente exige, sem sofisticação não solicitada.
- Sugestão de pedido auditável e explicável ao farmacêutico, relevante em um contexto de gestão pública de abastecimento.
- Testabilidade unitária direta, sem dependência de infraestrutura de dados adicional.
- Nenhuma infraestrutura nova introduzida, mantendo a proporcionalidade já estabelecida desde o ADR-001.

**Negativas / trade-offs assumidos**
- A precisão da sugestão gerada é limitada pela simplicidade do modelo de médias móveis — aceito conscientemente nesta fase, dado o volume de dados históricos disponível e a ausência de exigência de maior sofisticação no documento de requisitos original.

## Revisão

Esta decisão deve ser revisitada, com prioridade a ser avaliada a qualquer momento em que houver dados suficientes para justificá-la, caso surja qualquer uma das seguintes condições:

- Volume histórico de consumo suficiente (idealmente múltiplos ciclos anuais completos) tenha sido acumulado por uma base relevante de UBSs, permitindo avaliar com dados reais se um modelo mais sofisticado produziria ganho de precisão mensurável.
- Farmacêuticos usuários do sistema relatem, de forma recorrente, sugestões de pedido percebidas como imprecisas em cenários de sazonalidade real (ex.: surtos sazonais de dengue ou de doenças respiratórias) não capturados adequadamente pela média móvel simples.
- O roadmap comercial de expansão para múltiplos municípios (ADR-001) atinja uma escala de dados agregados que torne viável e valiosa a aplicação de um algoritmo probabilístico mais sofisticado — médias móveis ponderadas, suavização exponencial, ou um modelo de série temporal propriamente dito — como evolução do motor de previsão de demanda.

Este gatilho permanece deliberadamente aberto e deve ser reavaliado periodicamente pelo time de arquitetura, não apenas mediante ocorrência de um evento específico único.

## Decisões relacionadas
- ADR-001 — Estilo de decomposição e comunicação (monolito modular, ausência de justificativa para extração de serviço)
- ADR-003 — Arquitetura interna do backend (caso de uso explícito para regra de negócio relevante)
- ADR-017 — Estratégia de particionamento de histórico (crescimento do volume de dados históricos relevante para a revisão futura)
- ADR-030 — Estratégia de testes (teste unitário obrigatório para o caso de uso deste motor de cálculo)
