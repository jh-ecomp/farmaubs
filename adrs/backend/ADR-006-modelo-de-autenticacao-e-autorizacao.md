# ADR-006 — Modelo de Autenticação e Autorização

Criado por: João Henrique

## Status
🟢 Decidido e documentado — 20/07/2026

## Contexto

O documento de requisitos já fixa boa parte das regras de autenticação e autorização, restando como decisão arquitetural a forma técnica de implementá-las:

- Hash de senha: bcrypt, fator de custo mínimo 12 (NF011).
- Bloqueio de conta após 5 tentativas de login inválidas, por 15 minutos (RF002).
- Redefinição de senha via link válido por 2 horas, com mensagem genérica caso o e-mail não exista, para não expor cadastros (RF003).
- Autenticação em dois fatores (2FA) via TOTP, opcional para todos os perfis (NF011).
- Timeout de sessão após 60 minutos de inatividade, com aviso 5 minutos antes do encerramento (NF012).
- Controle de acesso baseado em perfil — RBAC — para os perfis Farmacêutico Responsável, Farmacêutico Residente, Gestor/Coordenador e Administrador, cada usuário associado a uma ou mais unidades de saúde (RF001, NF009).

A decisão em aberto é a arquitetura técnica de gerenciamento de sessão: sessão server-side versus token stateless (JWT). Esta decisão se apoia no ADR-005 (NestJS), no ADR-002 (isolamento multi-tenant por `municipio_id`/`unidade_id`) e no ADR-003 (arquitetura hexagonal, isolando o mecanismo de autenticação atrás de uma porta).

Critério relevante herdado dos ADRs anteriores: a volumetria projetada (algumas centenas de requisições simultâneas) não justifica arquiteturas otimizadas para escala horizontal massiva, e a restrição de custo mínimo de infraestrutura favorece soluções sem componentes adicionais (ex.: Redis, ainda não priorizado — ver ADR-019).

### Opções avaliadas

**A — Sessão server-side (armazenada no PostgreSQL)**

Vantagens: revogação imediata e trivial — bloqueio de conta (RF002), logout (RF004) e expiração por inatividade (NF012) exigem que o acesso seja interrompido de forma imediata, o que uma sessão server-side resolve com uma simples atualização ou remoção de registro, mantendo o servidor como fonte única da verdade. Não introduz infraestrutura nova: uma tabela de sessões no mesmo PostgreSQL já em uso. A volumetria projetada não aproxima o custo de uma consulta adicional por requisição de qualquer limite relevante de desempenho (NF007).

Desvantagens: cada requisição autenticada realiza uma consulta adicional ao banco — irrelevante na escala atual, mas é o trade-off clássico frente a uma solução stateless.

**B — JWT stateless**

Vantagens: validação do token não depende de consulta ao banco de dados, vantagem relevante em cenários de escala horizontal massiva.

Desvantagens: a revogação imediata exigida por RF002 e NF012 obriga, na prática, a manutenção de uma lista de tokens revogados (blacklist) — o que recria estado server-side de forma mais complexa que a opção A, exigindo verificação do token e da blacklist a cada requisição. Para a volumetria projetada deste sistema, o benefício de escala horizontal do JWT não compensa a complexidade adicional introduzida — o mesmo padrão de raciocínio que levou à rejeição de micro-serviços no ADR-001 por desproporção entre complexidade e volumetria real.

## Decisão

Adotar **sessão server-side, armazenada no PostgreSQL**, como mecanismo de gerenciamento de autenticação, com as seguintes definições de design:

1. **Escopo de tenant na sessão**: a sessão carrega `usuario_id`, perfil(is) de acesso e a lista de `municipio_id`/`unidade_id` associados ao usuário. O Guard de autorização do NestJS lê esse escopo diretamente da sessão, sem recalculá-lo a cada requisição, alimentando o controle de acesso definido no ADR-002 (RLS) e no ADR-003 (aplicação do escopo de tenant na camada de aplicação).
2. **2FA (TOTP)**: opt-in por usuário, conforme NF011. O segredo TOTP é armazenado criptografado em repouso, seguindo o mesmo padrão de proteção exigido para dados sensíveis pelo NF010, ainda que não se trate de dado de paciente. Implementação via biblioteca padrão do ecossistema Node (ex.: `otplib`), sem dependência de serviço externo.
3. **Timeout com aviso**: a sessão possui expiração deslizante, renovada a cada requisição, acompanhada de um timestamp de expiração absoluta enviado ao frontend. O frontend utiliza esse timestamp para disparar o aviso 5 minutos antes do encerramento, conforme NF012 — o contrato de dados necessário para essa funcionalidade nasce nesta decisão, ainda que sua exibição seja responsabilidade do módulo de frontend.
4. **Ponto de extensão para autenticação institucional futura**: o mecanismo de autenticação é isolado atrás de uma porta (`AuthProvider`), seguindo a arquitetura hexagonal do ADR-003. O adaptador inicial implementa e-mail/senha local com sessão server-side; a estrutura permite substituição futura por um adaptador de autenticação institucional (ex.: integração gov.br via OAuth2), relevante dado o roadmap comercial B2G identificado no ADR-001, sem exigir reescrita da lógica de autorização/RBAC que consome a sessão.

## Consequências

**Positivas**
- Revogação imediata de acesso (bloqueio, logout, timeout) implementada de forma simples e confiável, sem necessidade de blacklist de tokens.
- Nenhuma infraestrutura adicional além do PostgreSQL já decidido, mantendo o custo de infraestrutura mínimo.
- Isolamento do mecanismo de autenticação atrás de uma porta, preservando a possibilidade de evolução para autenticação institucional (gov.br) sem retrabalho na camada de autorização.

**Negativas / trade-offs assumidos**
- Overhead de uma consulta adicional ao banco por requisição autenticada — aceito dado que a volumetria projetada não aproxima esse custo de qualquer limite relevante de desempenho.
- Caso a base de clientes cresça muito além do cenário projetado, o modelo de sessão server-side pode exigir introdução de um cache (ex.: Redis, já discutido como possibilidade no ADR-019) para reduzir a carga de consultas de sessão sobre o banco principal.

## Revisão

Esta decisão deve ser revisitada caso:
- A volumetria real de requisições autenticadas cresça a ponto de a consulta de sessão a cada requisição se tornar um gargalo de desempenho mensurável.
- Surja um requisito de integração com autenticação institucional (gov.br ou similar) que exija adaptação do `AuthProvider` além do previsto nesta decisão.

## Decisões relacionadas
- ADR-002 — Estratégia de multi-tenancy (escopo `municipio_id`/`unidade_id` carregado na sessão)
- ADR-003 — Arquitetura interna do backend (isolamento do mecanismo de autenticação via porta)
- ADR-005 — Linguagem e framework do backend (NestJS, Guards de autorização)
- ADR-019 — Estratégia de cache (possível evolução futura para cache de sessão)
