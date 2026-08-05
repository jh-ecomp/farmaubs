# ADR-030 — Estratégia de Testes

Criado por: João Henrique

## Status
🟢 Decidido e documentado — 23/07/2026

## Contexto

A arquitetura hexagonal definida no ADR-003 isola o domínio (regras de negócio) da infraestrutura, com o objetivo explícito, entre outros, de tornar o domínio testável sem dependência de banco de dados ou framework web. Este ADR formaliza a estratégia de testes que se apoia nessa separação, além de tratar pontos de risco específicos já identificados por decisões anteriores:

- Multi-tenancy via Row-Level Security (ADR-002, ADR-016) é uma política de segurança que, se falhar silenciosamente, tem consequência grave — vazamento de dados entre municípios clientes.
- Controle de concorrência em operações de estoque via bloqueio pessimista (ADR-008) e o mecanismo de outbox pattern (ADR-004) são pontos onde erros sutis de concorrência e consistência tendem a se esconder.
- O ambiente de homologação (ADR-025) já existe como destino natural de validação antes de produção.
- A equipe de desenvolvimento é majoritariamente júnior, favorecendo uma estratégia objetiva e de fácil verificação em revisão de código, em vez de um framework de testes elaborado que exija julgamento experiente para ser aplicado corretamente.

### Camadas de teste avaliadas e adotadas

**A — Testes unitários de domínio (casos de uso e regras de negócio)**

Escopo: lógica pura contida nas portas da arquitetura hexagonal — cálculo de FEFO (RF010), sugestão de pedido mensal e regras de ponto de pedido/estoque de segurança (RF015), cálculo de curva ABC (RF019), entre outras regras de negócio relevantes. Executados com mock das portas de infraestrutura (repositório, e-mail, geração de arquivo), sem banco de dados real nem framework web em execução. A facilidade de escrever esses testes é, em si, um indicador da integridade da fronteira hexagonal definida no ADR-003 — dificuldade em isolar uma regra de negócio para teste unitário é sinal de vazamento dessa fronteira. Ferramenta: Jest, já integrado ao boilerplate padrão do NestJS (ADR-005).

**B — Testes de integração de adaptadores (contra banco de dados real)**

Escopo: verificação de que o adaptador de repositório aplica corretamente o escopo de tenant definido no ADR-016, que o `SELECT ... FOR UPDATE` do ADR-008 bloqueia como esperado sob concorrência, e que o mecanismo de outbox do ADR-004 grava e processa eventos corretamente. Executados contra um PostgreSQL real, não mockado, subido via Docker Compose (ADR-023), reaproveitando a mesma stack já utilizada no ambiente de desenvolvimento local, com um banco de dados de teste efêmero.

**Teste obrigatório de RLS**: por se tratar de uma camada de segurança crítica e silenciosa (ADR-002), é obrigatório um teste de integração dedicado que tenta deliberadamente ler ou escrever dados associados a um `municipio_id` diferente do contexto de sessão ativo, verificando que a política de RLS bloqueia o acesso. Este teste não é opcional e deve acompanhar qualquer mudança em política de RLS.

**C — Testes end-to-end (e2e) via API**

Escopo: os fluxos críticos de ponta a ponta descritos no NF001 (registro de entrada, registro de dispensa, geração de pedido, consulta de dashboard), executados chamando a API NestJS real contra um banco de dados de teste, sem mock. Cobertura seletiva, não exaustiva — os requisitos funcionais classificados como Essencial no documento de requisitos original são os candidatos primários; requisitos classificados como Importante ou Desejável não exigem cobertura e2e obrigatória nesta fase.

**D — Testes de frontend**

Escopo enxuto, compatível com uma equipe de um único desenvolvedor de frontend sem par: testes de componente para lógica de formulário crítica (ex.: validação de quantidade dispensada, seleção de lote sugerido por FEFO), utilizando Testing Library. Testes end-to-end de interface (ex.: Playwright, Cypress) não são adotados nesta fase — o custo de manutenção de e2e de UI para uma equipe de frontend de uma única pessoa tende a superar o benefício no estágio atual do produto; a cobertura de fluxo crítico de ponta a ponta já é obtida pela camada C, testando via API.

### Meta de cobertura

Foi deliberadamente rejeitada uma meta percentual genérica de cobertura de código, por ser uma métrica facilmente satisfeita com testes triviais sem valor real de verificação. Em seu lugar, adota-se uma **regra de obrigatoriedade por tipo de mudança**, mais objetiva de seguir por uma equipe júnior e diretamente direcionada aos pontos de maior risco já identificados pelos ADRs anteriores.

## Decisão

Adotar as quatro camadas de teste descritas acima (unitário de domínio, integração de adaptadores, e2e via API, componente de frontend), com a seguinte regra de obrigatoriedade por tipo de mudança, aplicada em revisão de código:

1. Todo caso de uso novo no domínio (ADR-003) exige teste unitário correspondente antes do merge.
2. Toda mudança em política de Row-Level Security ou em lógica de bloqueio de concorrência de estoque (ADR-008) exige teste de integração correspondente antes do merge, sem exceção, dado o risco de segurança e de integridade de dados associado.
3. Todo requisito funcional classificado como Essencial no documento de requisitos original deve ter pelo menos um teste e2e cobrindo o caminho feliz, antes de ser disponibilizado no primeiro piloto real com as UBSs parceiras.

**Onde os testes são executados**: localmente, pelo desenvolvedor, antes de cada push — sem gate automático de execução obrigatória nesta fase, já que o pipeline de CI/CD (ADR-024) ainda não foi priorizado no primeiro backlog. Testes de integração e e2e sobem o banco de dados de teste via Docker Compose (ADR-023), reaproveitando o mesmo modelo mental já usado no ambiente de desenvolvimento local. O gate de qualidade, nesta fase, é a revisão de código humana, com verificação explícita da regra de obrigatoriedade acima por parte do revisor.

## Consequências

**Positivas**
- Estratégia de testes objetiva e de fácil verificação em revisão de código, adequada ao perfil majoritariamente júnior da equipe.
- Cobertura obrigatória concentrada exatamente nos pontos de maior risco já identificados pelos ADRs anteriores (RLS, concorrência de estoque, fluxos essenciais), em vez de dispersa por uma meta percentual genérica.
- A dificuldade de escrever testes unitários de domínio funciona como um sinal precoce de degradação da fronteira hexagonal definida no ADR-003.

**Negativas / trade-offs assumidos**
- Sem gate automático de CI nesta fase, a aplicação da regra de obrigatoriedade depende de disciplina de revisão de código humana — risco de inconsistência que deve ser reforçado explicitamente pelo desenvolvedor sênior até que o ADR-024 seja tratado.
- Ausência de testes e2e de interface (UI) significa que regressões visuais ou de interação de frontend não detectadas pelos testes de componente só serão percebidas manualmente — aceito dado o tamanho da equipe de frontend nesta fase.
- Requisitos funcionais não classificados como Essencial não têm cobertura e2e obrigatória, ficando expostos a um risco maior de regressão não detectada automaticamente.

## Revisão

Esta decisão deve ser revisitada caso:
- O ADR-024 (pipeline de CI/CD) seja priorizado, momento em que a execução de testes deve ser automatizada como gate de merge, em vez de depender de disciplina manual.
- A ausência de testes e2e de UI se mostre, na prática, insuficiente à medida que a equipe de frontend cresça além de um único desenvolvedor.
- A regra de obrigatoriedade por tipo de mudança se mostre insuficiente para prevenir regressões reais observadas em produção, justificando a extensão da cobertura obrigatória a outras categorias de mudança.

## Decisões relacionadas
- ADR-002 / ADR-016 — Multi-tenancy e Row-Level Security (teste de integração obrigatório)
- ADR-003 — Arquitetura interna do backend (base da testabilidade do domínio)
- ADR-004 — Estratégia de comunicação entre módulos internos (outbox pattern, testes de integração)
- ADR-008 — Consistência transacional em operações de estoque (teste de integração obrigatório)
- ADR-023 — Containerização e orquestração (banco de teste via Docker Compose)
- ADR-024 — Pipeline de CI/CD (ainda não priorizado; automação futura do gate de testes)
- ADR-025 — Estratégia de ambientes (homologação como destino de validação e2e)
