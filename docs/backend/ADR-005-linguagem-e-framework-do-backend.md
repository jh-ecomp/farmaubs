# ADR-005 — Linguagem e Framework do Backend

Criado por: João Henrique

## Status
🟢 Decidido e documentado — 20/07/2026

## Contexto

A equipe de desenvolvimento é composta por 5 pessoas: um desenvolvedor sênior (responsável por decisões de arquitetura, CI/CD, infraestrutura, integrações e qualidade de processo), dois desenvolvedores backend júnior, um desenvolvedor frontend júnior e um desenvolvedor júnior dedicado a banco de dados. Nesta fase inicial, o sênior estará dividido entre dar suporte direto aos quatro desenvolvedores e avançar em suas próprias frentes.

Este ADR é bloqueante para o ADR-006 (autenticação/autorização), ADR-007 (estratégia de API) e ADR-008 (consistência transacional), e define a stack sobre a qual a dupla de desenvolvedores backend júnior vai trabalhar diretamente no primeiro backlog.

Critérios de decisão relevantes para este contexto específico:
- Aderência natural à arquitetura hexagonal definida no ADR-003 (módulos, injeção de dependência, portas e adaptadores), de forma que a estrutura correta seja o caminho de menor resistência para desenvolvedores júnior, não algo que dependa inteiramente de disciplina manual supervisionada.
- Bom suporte a PostgreSQL e Row-Level Security, sem necessidade de contornos ou bibliotecas de terceiros pouco maduras (ADR-002).
- Ecossistema maduro para as necessidades específicas do domínio: geração de arquivos XLSX/PDF (RF017, RF020, RF021), envio de e-mail transacional (RF001, RF003, RF022), e processamento de jobs em background compatível com o outbox pattern do ADR-004.
- Custo de execução compatível com hospedagem em VPS de baixo custo (restrição confirmada no ADR-001/ADR-002, decisão de provedor ainda pendente no ADR-021).
- Mercado de trabalho amplo no Brasil e disponibilidade de material de estudo em português, dado o perfil júnior da maior parte da equipe de backend.

### Opções avaliadas

**A — Node.js + TypeScript (NestJS)**

Vantagens: NestJS já é estruturado nativamente em módulos com injeção de dependência, funcionando como um guia estrutural que aproxima a organização do framework da arquitetura hexagonal definida no ADR-003, reduzindo a chance de desvio estrutural por parte de desenvolvedores júnior. TypeScript captura uma classe relevante de erros em tempo de compilação. Ecossistema npm maduro para geração de XLSX (`exceljs`), PDF (`pdf-lib`/`puppeteer`) e envio de e-mail (`nodemailer`). Execução leve e de baixo custo em VPS. Mercado de trabalho JavaScript/TypeScript é o mais amplo no Brasil atualmente, com abundância de material de estudo em português.

Desvantagens: a superfície de decoradores e metaprogramação do NestJS pode ser inicialmente confusa para um desenvolvedor júnior, até a internalização do funcionamento da injeção de dependência.

**B — Python + Django**

Vantagens: o Django Admin gera um painel administrativo com esforço mínimo, atrativo para telas internas de administração (RF025, RF026). ORM maduro, com migrations sólidas.

Desvantagens: Django é opinativo em torno do padrão MVC/MTV tradicional, exigindo mais esforço manual e disciplina para impor a arquitetura hexagonal do ADR-003, já que o framework não guia estruturalmente nessa direção. O Django Admin, principal vantagem da opção, é também um convite a vazar regra de negócio para dentro de views/admin — exatamente o risco que o ADR-003 busca evitar.

**C — Python + FastAPI**

Vantagens: framework leve, adequado para APIs, com tipagem via Pydantic oferecendo benefício de detecção antecipada de erros semelhante ao TypeScript. Boa curva de aprendizado para desenvolvedores com alguma base prévia em Python.

Desvantagens: oferece menos estrutura organizacional pronta que o NestJS — a organização hexagonal precisaria ser inteiramente desenhada pela equipe, sem o framework empurrando na direção correta, o que pesa mais em um time majoritariamente júnior do que em um cenário com desenvolvedores sênior trabalhando sozinhos. Ecossistema de geração de XLSX/PDF é adequado, porém um pouco menos maduro que o do Node para os formatos específicos exigidos.

**D — Java (Spring Boot) ou C# (.NET)**

Vantagens: extremamente maduros para arquitetura em camadas/hexagonal, fortemente tipados, com excelente suporte a PostgreSQL e RLS.

Desvantagens: verbosidade e cerimônia mais altas, com curva de aprendizado mais dura para desenvolvedores júnior e ciclo de feedback (compilação/execução) mais lento no dia a dia. Consumo de memória/CPU em runtime mais alto, pesando na restrição de custo da VPS de baixo custo já assumida. Setup inicial de projeto (build tool, contêiner de injeção de dependência, configuração) tem mais peças móveis para dois desenvolvedores júnior absorverem sem supervisão constante.

## Decisão

Adotar **Node.js com TypeScript, utilizando o framework NestJS**, como stack de backend.

Esta escolha é orientada primariamente pela aderência natural do NestJS à arquitetura hexagonal já definida no ADR-003 — a estrutura de módulos, providers e injeção de dependência do framework mapeia diretamente para o conceito de módulo de domínio, porta e adaptador, servindo como um guia estrutural que reduz a probabilidade de desvio arquitetural por parte da dupla de desenvolvedores backend júnior. Soma-se a isso o ecossistema maduro para os requisitos de geração de arquivos e envio de e-mail transacional, o custo de execução compatível com a restrição de infraestrutura de baixo custo, e a disponibilidade de mercado de trabalho e material de estudo em português, adequados ao perfil atual da equipe.

## Consequências

**Positivas**
- Estrutura de módulos do NestJS funciona como andaime para a arquitetura hexagonal do ADR-003, reduzindo a curva de supervisão necessária do desenvolvedor sênior sobre a dupla júnior de backend.
- TypeScript reduz uma classe relevante de erros antes mesmo da execução, importante em um time com volume alto de código escrito por desenvolvedores júnior.
- Ecossistema maduro cobre diretamente as necessidades de exportação de arquivos (RF017, RF020, RF021) e envio de e-mail transacional (RF001, RF003, RF022), sem necessidade de bibliotecas de terceiros pouco maduras.
- Custo de execução baixo, compatível com a restrição de infraestrutura assumida desde o ADR-001.

**Negativas / trade-offs assumidos**
- A dupla de desenvolvedores backend júnior precisará de um período inicial de acompanhamento mais próximo do sênior para internalizar o funcionamento de decoradores e injeção de dependência do NestJS, antes de ganhar autonomia plena.
- A escolha por Node.js/TypeScript implica que a geração de PDF via `puppeteer` (quando aplicável) tem footprint de memória mais alto que alternativas nativas — ponto a observar ao dimensionar a VPS no ADR-021.

## Revisão

Esta decisão deve ser revisitada caso:
- A curva de aprendizado da dupla júnior com NestJS se mostre, na prática, mais custosa do que o esperado, a ponto de comprometer a velocidade de entrega do primeiro backlog.
- Uma necessidade futura de processamento pesado (ex.: geração de relatório para grande volume histórico) exija uma linguagem com melhor desempenho computacional do que a stack escolhida oferece.

## Decisões relacionadas
- ADR-003 — Arquitetura interna do backend (hexagonal / ports & adapters)
- ADR-006 — Modelo de autenticação/autorização
- ADR-007 — Estratégia de API
- ADR-008 — Consistência transacional em operações de estoque
- ADR-021 — Provedor de nuvem e topologia de hospedagem
