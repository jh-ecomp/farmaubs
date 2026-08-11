# ADR-021 — Provedor de Nuvem e Topologia de Hospedagem

Criado por: João Henrique

## Status
🟢 Decidido e documentado — 23/07/2026

## Contexto

A infraestrutura de hospedagem do FarmaUBS precisa ser definida em um contexto de custo mínimo (fase pré-receita, sem contrato institucional hoje, conforme Q6 registrada na fase de levantamento de requisitos arquiteturais), com a restrição adicional de que a arquitetura de software deve permanecer portável em relação ao provedor escolhido, para que a decisão de infraestrutura tomada sob restrição orçamentária temporária não se converta em um lock-in permanente.

Decisões anteriores restringem o espaço de opções:
- O monolito modular (ADR-001) exige um único ambiente de execução de aplicação, não orquestração multi-serviço.
- PostgreSQL com Row-Level Security (ADR-015, ADR-016) exige controle pleno sobre configuração do banco — nem todo serviço de banco gerenciado expõe RLS ou parâmetros avançados de servidor sem restrição.
- O monorepo (ADR-022) produz dois artefatos deployáveis a partir de um único build: a API NestJS e os arquivos estáticos do frontend React/Vite.

### Opções avaliadas

**A — VPS genérica (ex.: Hetzner, DigitalOcean, Contabo) com Docker Compose auto-gerenciado**

Vantagens: opção de menor custo entre as avaliadas para a carga projetada (algumas centenas de requisições simultâneas). Controle pleno sobre a configuração do PostgreSQL, sem depender do que um serviço gerenciado específico expõe ou restringe. Portabilidade máxima — a infraestrutura é composta apenas por containers Docker rodando em uma máquina Linux genérica, sem dependência de recurso proprietário de provedor; migrar de provedor no futuro equivale a trocar de servidor, não a reescrever infraestrutura.

Desvantagens: exige que o desenvolvedor sênior assuma responsabilidade operacional manual — atualização de sistema operacional, backup, monitoramento básico e hardening de segurança inicial. Nenhuma redundância ou alta disponibilidade embutida — uma falha da VPS interrompe o serviço até recuperação manual, reforçando a importância futura do ADR-020 (backup e disaster recovery, ainda não priorizado, mas cujo risco já existe desde a operação inicial).

**B — PaaS com camada gratuita (ex.: Railway, Render, Fly.io)**

Vantagens: deploy simplificado, sem gerenciamento manual de sistema operacional; muitos oferecem PostgreSQL gerenciado integrado.

Desvantagens: camadas gratuitas tipicamente apresentam comportamento de "sleep"/cold-start após período de inatividade, limite de horas mensais de execução, ou expiração após período promocional — comportamento inadequado a um sistema de uso diário real por farmacêuticos em unidades de saúde, mesmo em fase de piloto. A transição para o plano pago desses provedores tende a ter custo por unidade de recurso superior ao de uma VPS equivalente, tornando a economia inicial temporária. Os serviços de PostgreSQL gerenciado desses provedores por vezes restringem extensões e parâmetros avançados de configuração, criando risco de atrito com o desenho de RLS e particionamento já definido nos ADR-016 e ADR-017.

**C — Hyperscaler com camada gratuita (AWS, GCP, Azure)**

Vantagens: camada gratuita cobre uma carga pequena por período limitado (12 meses na AWS) ou com limites permanentes reduzidos (GCP).

Desvantagens: após a camada gratuita, comprovadamente a opção de maior custo entre as avaliadas para a escala de carga projetada — hyperscalers são otimizados para arquiteturas com múltiplos serviços gerenciados, não para um monolito único com um banco PostgreSQL. Complexidade de configuração (gerenciamento de identidade e acesso, redes virtuais, grupos de segurança) desproporcional à escala-alvo já definida no ADR-001, com risco real de consumir tempo do desenvolvedor sênior em configuração de infraestrutura em detrimento do suporte à equipe de desenvolvimento, prioridade definida para este momento do projeto. Apresenta, na prática, maior risco de lock-in que as demais opções caso serviços proprietários (ex.: extensões específicas de banco gerenciado, papéis de IAM entrelaçados) sejam adotados sem cuidado extremo — contrariando diretamente o princípio de portabilidade estabelecido para esta decisão.

**D — Serviço de PostgreSQL gerenciado dedicado (ex.: Neon, Supabase) combinado com VPS/PaaS simples para a aplicação**

Vantagens: combina banco gerenciado com backup automático (adiantando parte do futuro ADR-020) com hospedagem simples da aplicação em uma VPS de baixo custo. Serviços como Neon e Supabase suportam RLS nativamente, por serem PostgreSQL genuíno, não uma abstração proprietária.

Desvantagens: divide a infraestrutura entre dois provedores distintos, adicionando uma peça de configuração e gestão de conta/fatura adicional, ainda que cada componente seja simples isoladamente. Camadas gratuitas desses serviços também apresentam limites (armazenamento, pausa de projeto por inatividade em determinados planos), sujeitas ao mesmo risco identificado na opção B, a depender do plano específico.

## Decisão

Adotar **VPS genérica com Docker Compose auto-gerenciado** (opção A) como topologia de hospedagem do FarmaUBS nesta fase.

Esta escolha é orientada principalmente pelo princípio de portabilidade estabelecido desde a fase de levantamento de requisitos arquiteturais: a infraestrutura de hoje deve ser a mais barata disponível, sem que essa restrição temporária de orçamento se converta em acoplamento permanente da arquitetura de software a um provedor específico. Entre as opções avaliadas, apenas a VPS genérica com Docker oferece portabilidade real e não apenas nominal — não há recurso proprietário de provedor entre o código da aplicação e a máquina de execução, tornando a migração futura para outro provedor uma troca de servidor, não uma reescrita de infraestrutura.

O custo operacional assumido (backup, monitoramento básico, hardening inicial) é reconhecido como trabalho manual de responsabilidade do desenvolvedor sênior, mas de natureza majoritariamente pontual (configuração inicial), distinto do suporte contínuo à equipe de desenvolvimento que é a prioridade definida para este momento do projeto.

**A escolha do provedor de VPS específico permanece deliberadamente em aberto**, a ser decidida pelo desenvolvedor sênior após avaliação comparativa de planos disponíveis no momento da contratação, incluindo considerações de custo, localização de data center e eventuais exigências futuras de hospedagem em território nacional decorrentes de contratos públicos.

## Consequências

**Positivas**
- Menor custo de infraestrutura entre as opções avaliadas para a carga atual, compatível com a fase pré-receita do produto.
- Portabilidade real da arquitetura de software em relação ao provedor de hospedagem, preservando a possibilidade de migração futura sem reescrita de infraestrutura.
- Controle pleno sobre a configuração do PostgreSQL, sem restrição de recursos avançados por parte de um serviço gerenciado.

**Negativas / trade-offs assumidos**
- Responsabilidade operacional manual (atualização de sistema operacional, backup, monitoramento, hardening) recai sobre o desenvolvedor sênior, sem a rede de segurança operacional que um serviço gerenciado ofereceria.
- Ausência de redundância/alta disponibilidade embutida — uma falha da VPS interrompe o serviço até recuperação manual, reforçando a prioridade de, no futuro próximo, tratar formalmente o ADR-020 (backup e disaster recovery).
- A escolha do provedor específico e sua configuração inicial (backup, monitoramento) ainda precisam ser executadas antes de qualquer deploy de produção — este ADR resolve a topologia, não a execução.

## Revisão

Esta decisão deve ser revisitada caso:
- A base de clientes cresça a ponto de a responsabilidade operacional manual sobre uma VPS única se tornar um gargalo real para o desenvolvedor sênior, justificando a migração para um serviço gerenciado ou a introdução de redundância.
- Um contrato público futuro exija formalmente hospedagem em território nacional ou certificação específica de provedor de nuvem, o que influenciaria diretamente a escolha do provedor de VPS específico, ainda em aberto.

## Decisões relacionadas
- ADR-001 — Estilo de decomposição e comunicação (monolito modular, escala-alvo)
- ADR-015 — SGBD (PostgreSQL, controle de configuração necessário)
- ADR-016 — Modelagem multi-tenant no banco (RLS, dependente de configuração plena do banco)
- ADR-022 — Organização de repositórios (monorepo, dois artefatos deployáveis)
- ADR-023 — Containerização e orquestração (detalhamento do uso de Docker sobre esta topologia)
- ADR-020 — Estratégia de backup e disaster recovery (ainda não priorizado, risco já presente desde esta decisão)
