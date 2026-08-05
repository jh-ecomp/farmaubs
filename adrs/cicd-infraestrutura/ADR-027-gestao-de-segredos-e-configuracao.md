# ADR-027 — Gestão de Segredos e Configuração

Criado por: João Henrique

## Status
🟢 Decidido e documentado — 24/07/2026

## Contexto

O sistema depende de diversas credenciais e valores de configuração sensíveis: credenciais de conexão ao PostgreSQL (ADR-015), segredo de assinatura de sessão (ADR-006), credenciais do serviço de e-mail transacional (RF001, RF003, RF022 — ainda sem ADR formal de integração), e futuramente qualquer chave de API de serviço de terceiro. Este ADR decide onde esses segredos residem e como cada ambiente (desenvolvimento local, homologação, produção — ADR-025) obtém o valor correto sem risco de vazamento.

Decisões anteriores restringem e orientam o espaço de opções:
- O ADR-023 já estabeleceu `docker-compose.dev.yml`/`.prod.yml` como mecanismo de diferenciação entre ambientes — a gestão de segredos deve se encaixar nesse padrão já existente, não introduzir um mecanismo paralelo.
- O ADR-022 (monorepo) favorece um único ponto de configuração acessível a backend e frontend, ainda que cada aplicação consuma apenas o que lhe é pertinente.
- O ADR-021 (VPS única, sem serviços gerenciados de hyperscaler) descarta de imediato cofres de segredo nativos de provedores de nuvem (ex.: AWS Secrets Manager), que exigiriam exatamente a infraestrutura já rejeitada por custo e complexidade desproporcionais.

### Opções avaliadas

**A — Arquivos `.env` por ambiente, nunca versionados, com `.env.example` versionado no repositório**

Vantagens: mecanismo simples e amplamente conhecido, de baixa curva de aprendizado para a equipe júnior. Integra-se diretamente ao Docker Compose já decidido no ADR-023, via diretiva `env_file`, com um arquivo `.env` distinto por ambiente (`.env.dev` local de cada desenvolvedor, `.env.hml` e `.env.prod` residentes apenas na VPS de produção/homologação definida no ADR-021/ADR-025). O arquivo `.env.example`, versionado no monorepo, documenta quais variáveis de configuração existem, sem expor valores reais, resolvendo o problema de onboarding sem risco de vazamento de segredo. Nenhuma infraestrutura nova, nenhum custo adicional.

Desvantagens: a distribuição do `.env.prod` para a VPS de produção é manual, sem automação — aceitável dado que a promoção entre ambientes já é manual por decisão do ADR-025, e o pipeline de CI/CD (ADR-024) ainda não foi priorizado. Não há rotação automática de segredo nem histórico de acesso — risco aceito nesta fase, dado o tamanho pequeno da equipe e a relação de confiança direta entre seus membros, registrado como gatilho de revisão.

**B — Cofre de segredos dedicado (ex.: HashiCorp Vault, Doppler, Infisical)**

Vantagens: rotação de segredo, auditoria de acesso, segredo nunca armazenado em texto plano em disco.

Desvantagens: introduz infraestrutura nova, seja autogerenciada (custo operacional adicional na VPS de custo mínimo) seja como dependência de um serviço de terceiro (custo financeiro recorrente). Resolve um problema de escala e conformidade que a equipe de 5 pessoas, nesta fase do produto, não possui — descartada por desproporção, na mesma linha de raciocínio já aplicada à rejeição de Redis no ADR-019 e de Kubernetes no ADR-023.

**C — Variáveis de ambiente definidas diretamente no sistema operacional da VPS, sem arquivo `.env`**

Vantagens: nenhuma vantagem de segurança real sobre a opção A, dado que o segredo continua residindo em texto plano em algum lugar do sistema.

Desvantagens: sem um arquivo `.env.example` versionado, não há forma acessível de documentar quais variáveis de configuração existem, prejudicando o onboarding da equipe de forma mais severa que a opção A, sem ganho de segurança equivalente.

## Decisão

Adotar **arquivos `.env` por ambiente**, nunca versionados no controle de código-fonte (`.gitignore` cobrindo `.env*`, com exceção explícita de `.env.example`), com a diretiva `env_file` do Docker Compose apontando para o arquivo correspondente a cada ambiente (desenvolvimento, homologação, produção), coerente com a estrutura de composição já definida nos ADR-023 e ADR-025.

Regras específicas de gestão de segredo adotadas:

1. **Segredo de assinatura de sessão** (ADR-006): gerado uma única vez por ambiente, nunca reaproveitado entre desenvolvimento, homologação e produção.
2. **Procedimento de rotação manual**: nesta fase, sem automação de rotação de segredo. Em caso de vazamento suspeito, o procedimento de rotação (substituição do valor no `.env` de produção seguida de reinício do container correspondente) deve estar documentado em local acessível a toda a equipe (ex.: `CONTRIBUTING.md` ou documento equivalente do monorepo), não apenas de conhecimento informal de quem configurou o ambiente originalmente.
3. **Nenhum segredo exposto em log**: nenhum segredo (credencial, token, senha) deve aparecer em log de aplicação, incluindo logs de erro que capturem corpo de requisição/resposta — corpo de requisição/resposta deve ser sanitizado antes de qualquer registro em log, ponto a ser reforçado quando a estratégia de observabilidade (ADR-026) for tratada formalmente.

## Consequências

**Positivas**
- Mecanismo simples e de baixa curva de aprendizado, plenamente integrado à estrutura de containerização já decidida.
- Onboarding facilitado pela documentação de variáveis via `.env.example`, sem exposição de valores reais.
- Nenhum custo ou complexidade de infraestrutura adicional.

**Negativas / trade-offs assumidos**
- Distribuição manual de segredos de produção, sem automação — risco aceito dado o estágio atual do projeto e a ausência de pipeline de CI/CD.
- Ausência de rotação automática e de trilha de auditoria de acesso a segredos — adequado ao tamanho e à confiança da equipe atual, mas não escalável indefinidamente.
- Segredos residem em texto plano nos arquivos `.env` das máquinas onde são utilizados (máquinas de desenvolvimento dos desenvolvedores e VPS de homologação/produção) — reforça a necessidade de disciplina individual de segurança (ex.: não compartilhar `.env` fora dos canais apropriados).

## Revisão

Esta decisão deve ser revisitada caso:
- A equipe cresça a ponto de a ausência de trilha de auditoria de acesso a segredos se tornar um risco real de rastreabilidade.
- Surja exigência contratual ou legal (ex.: cláusula de edital público) de rotação formal e auditável de segredos.
- O pipeline de CI/CD (ADR-024) seja priorizado, momento em que a distribuição de segredos para deploy automatizado precisa ser reavaliada, possivelmente introduzindo um mecanismo mais robusto que arquivos `.env` distribuídos manualmente.

## Decisões relacionadas
- ADR-006 — Modelo de autenticação e autorização (segredo de sessão)
- ADR-015 — SGBD (credenciais de conexão ao PostgreSQL)
- ADR-021 — Provedor de nuvem e topologia de hospedagem (VPS única, ausência de cofre de segredo gerenciado)
- ADR-022 — Organização de repositórios (monorepo, `.env.example` compartilhado)
- ADR-023 — Containerização e orquestração (`env_file` no Docker Compose)
- ADR-025 — Estratégia de ambientes (arquivo `.env` distinto por ambiente)
- ADR-026 — Observabilidade (ainda não priorizado; sanitização de logs)
