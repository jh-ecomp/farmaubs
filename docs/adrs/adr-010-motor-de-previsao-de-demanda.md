## ADR-010 - Motor de previsão de demanda

### Status
🟢 Decidido e documentado — última atualização: 24/07/2026

### Contexto

O RF015 exige que o sistema calcule e exiba uma sugestão de quantidade a pedir para cada medicamento, com base em: consumo médio histórico (mínimo 3 meses, preferencialmente 12 meses para capturar sazonalidade), estoque atual, tempo médio de entrega da CAF (configurável por unidade de saúde, conforme RF026/RF027), aplicando ponto de pedido e estoque de segurança.

Trata-se da funcionalidade mais algorítmica do sistema. O requisito, tal como escrito, corresponde a uma fórmula de gestão de estoque bem estabelecida (ponto de reposição = consumo médio diário × tempo de entrega + estoque de segurança), não a um modelo estatístico ou preditivo sofisticado.

Este ADR decide a abordagem de implementação desse motor de cálculo, considerando: a natureza determinística do que o RF015 efetivamente exige; a necessidade de auditabilidade e explicabilidade da sugestão gerada, relevante em um contexto de gestão de abastecimento de saúde pública onde decisões podem ser questionadas; o volume limitado de dados históricos disponível durante a fase de piloto; e a arquitetura hexagonal já definida no ADR-003, que favorece a formalização de regras de negócio relevantes como casos de uso explícitos.

#### Opções avaliadas

**A - Regra determinística simples, implementada como caso de uso explícito dentro do módulo de pedidos**

Vantagens: corresponde exatamente ao que o RF015 exige — uma fórmula com parâmetros configuráveis por unidade de saúde (limiar de alerta, estoque de segurança, tempo de entrega, já previstos em RF026/RF027), sem elementos probabilísticos ou adaptativos não solicitados pelo requisito. Testável unitariamente de forma direta (ADR-030), com entrada e saída determinísticas, sem necessidade de dataset de treino ou validação estatística. Não introduz infraestrutura nova, residindo inteiramente dentro do monolito modular já decidido (ADR-001). Auditável e explicável para o farmacêutico — a origem de uma sugestão de quantidade é rastreável a uma fórmula determinística, o que é valioso em um contexto de gestão pública de abastecimento.

Desvantagens: não captura sazonalidade de forma sofisticada além de médias móveis simples sobre a janela configurável de 3 a 12 meses — mas essa limitação é consistente com o que o próprio documento de requisitos pede, que menciona apenas "capturar sazonalidade" via essa janela, não um modelo preditivo.

**B - Serviço ou módulo estatístico mais sofisticado (médias móveis ponderadas, suavização exponencial, ou modelo de série temporal)**

Vantagens: potencial de maior precisão de previsão à medida que mais dados históricos de qualidade estejam disponíveis.

Desvantagens: nenhum requisito funcional do documento original exige esse nível de sofisticação nesta fase. Reduz a explicabilidade da sugestão gerada. Exige volume e qualidade de dados históricos superiores ao que a fase de piloto, com poucos meses de operação real, tende a oferecer.

**C - Serviço externo ou extraível desde já (ex.: microsserviço dedicado de previsão)**

Vantagens: isolamento de responsabilidade e possibilidade de escalar o motor de previsão de forma independente.

Desvantagens: contradiz diretamente o ADR-001, que estabeleceu o monolito modular sem justificativa de volumetria para extração de qualquer módulo nesta fase.

### Decisão

Adotar **regra determinística simples** (ponto de pedido e estoque de segurança, com médias móveis sobre a janela configurável de 3 a 12 meses definida pelo RF015), implementada como um **caso de uso explícito** dentro do módulo de pedidos, seguindo a arquitetura hexagonal do ADR-003. Por se tratar da regra de negócio de maior complexidade do domínio, é um candidato natural à formalização como caso de uso nomeado (ex.: `CalcularSugestaoDePedido`), em vez de uma passagem direta simplificada como seria aceitável para funcionalidades puramente CRUD. Essa formalização também facilita o cumprimento do teste unitário obrigatório definido no ADR-030 para todo caso de uso novo do domínio.

### Consequências

**Positivas**
- Implementação proporcional ao que o RF015 efetivamente exige, sem sofisticação não solicitada.
- Sugestão de pedido auditável e explicável ao farmacêutico, relevante em um contexto de gestão pública de abastecimento.
- Testabilidade unitária direta, sem dependência de infraestrutura de dados adicional.
- Nenhuma infraestrutura nova introduzida.

**Negativas / trade-offs assumidos**
- A precisão da sugestão gerada é limitada pela simplicidade do modelo de médias móveis — aceito conscientemente nesta fase, dado o volume de dados históricos disponível e a ausência de exigência de maior sofisticação no documento de requisitos original.

### Revisão

Esta decisão deve ser revisitada, com prioridade a ser avaliada a qualquer momento em que houver dados suficientes para justificá-la, caso surja qualquer uma das seguintes condições:

- Volume histórico de consumo suficiente (idealmente múltiplos ciclos anuais completos) tenha sido acumulado por uma base relevante de UBSs, permitindo avaliar com dados reais se um modelo mais sofisticado produziria ganho de precisão mensurável.
- Farmacêuticos usuários do sistema relatem, de forma recorrente, sugestões de pedido percebidas como imprecisas em cenários de sazonalidade real (ex.: surtos sazonais de dengue ou de doenças respiratórias) não capturados adequadamente pela média móvel simples.
- O roadmap comercial de expansão para múltiplos municípios (ADR-001) atinja uma escala de dados agregados que torne viável e valiosa a aplicação de um algoritmo probabilístico mais sofisticado.

Este gatilho permanece deliberadamente aberto e deve ser reavaliado periodicamente pelo time de arquitetura.

### Decisões relacionadas
- [[ADR-001|Registro de Decisões de Arquitetura 1 ‐ Arquitetura de Software#adr-001---estilo-de-decomposição-e-comunicação-da-arquitetura]] - Estilo de decomposição e comunicação (monolito modular, ausência de justificativa para extração de serviço)
- [[ADR-003|Registro de Decisões de Arquitetura 1 ‐ Arquitetura de Software#adr-003---arquitetura-interna-do-backend-hexagonal--ports--adapters]] - Arquitetura interna do backend (caso de uso explícito para regra de negócio relevante)
- [[ADR-017|Registro de Decisões de Arquitetura 4 ‐ Banco de Dados#adr-017---estratégia-de-particionamento-de-histórico]] - Estratégia de particionamento de histórico (crescimento do volume de dados históricos relevante para a revisão futura)
- ADR-030 - Estratégia de testes (teste unitário obrigatório para o caso de uso deste motor de cálculo)