# CONTRIBUTING — Guia do Desenvolvedor e Padrões de Engenharia (FarmaUBS)

> **Documento Vivo de Engenharia de Software e Diretriz Padrão de Operação.**  
> Este guia é o **arquivo padrão de diretrizes** para qualquer desenvolvedor e **agente de Inteligência Artificial** operar no monorepo FarmaUBS.
> 
> ⚠️ **REGRA MANDATÓRIA DE EXECUÇÃO:**  
> **Todos os builds e testes devem ser executados OBRIGATORIAMENTE através do Moonrepo** (`moon run <projeto>:<tarefa>`, `moon run :<tarefa>` ou `pnpm moon run ...`), e **NUNCA** via comandos diretos isolados nos pacotes.  
> O Moonrepo garante a compilação ordenada do grafo DAG (ex: `@farmaubs/shared` antes de dependentes), controle de cache criptográfico inteligente e validação estrita dos limites arquiteturais.

---

## Sumário

1. [Visão Geral e Arquitetura dos Projetos](#1-visão-geral-e-arquitetura-dos-projetos)
   - [1.1 Backend (`@farmaubs/backend`)](#11-backend-farmaubsbackend---clean-architecture-pura--nestjs-adr-003-adr-033)
   - [1.2 Frontend (`@farmaubs/frontend`)](#12-frontend-farmaubsfrontend---react--vite-adr-011-adr-012)
   - [1.3 Mobile (`@farmaubs/mobile`)](#13-mobile-farmaubsmobile---react-native--expo-adr-034)
   - [1.4 Pacote Compartilhado (`@farmaubs/shared`)](#14-pacote-compartilhado-farmaubsshared---o-núcleo-agnóstico)
   - [1.5 Orquestração e Governança com Moonrepo (`moon`)](#15-orquestração-e-governança-com-moonrepo-moon-adr-035)
   - [1.6 Infraestrutura (`infra/`)](#16-infraestrutura-infra)
2. [Regras Rígidas de Estrutura de Pastas e Fronteira de Escopo (Guia para Humanos e IA)](#2-regras-rígidas-de-estrutura-de-pastas-e-fronteira-de-escopo-guia-para-humanos-e-ia)
   - [2.1 Princípio Rígido de Isolamento de Escopo (Backend vs Frontend)](#21-princípio-rígido-de-isolamento-de-escopo-backend-vs-frontend)
   - [2.2 Tabela de Correspondência Canônica de Pastas](#22-tabela-de-correspondência-canônica-de-pastas)
   - [2.3 Padrão Canônico de Comentários de Funções (Micro-TSDoc)](#23-padrão-canônico-de-comentários-de-funções-micro-tsdoc)
3. [Política de Retenção de Dados: Soft Delete em vez de Hard Delete](#3-política-de-retenção-de-dados-soft-delete-em-vez-de-hard-delete)
4. [Fluxo de Trabalho Sequencial do Desenvolvedor](#4-fluxo-de-trabalho-sequencial-do-desenvolvedor)
   - [Passo 0: Leitura Obrigatória de Atualizações](#passo-0-leitura-obrigatória-de-atualizações)
   - [Passo 1: Atualizar a branch main](#passo-1-atualizar-a-branch-main)
   - [Passo 2: Sincronizar Variáveis de Ambiente (.env e .env.example)](#passo-2-sincronizar-variáveis-de-ambiente-env-e-envexample)
   - [Passo 3: Criar a Branch de Trabalho](#passo-3-criar-a-branch-de-trabalho)
   - [Passo 4: Ciclo de Desenvolvimento com Moonrepo e Docker](#passo-4-ciclo-de-desenvolvimento-com-moonrepo-e-docker)
   - [Passo 5: Execução de Tarefas, Testes e CI com Moonrepo](#passo-5-execução-de-tarefas-testes-e-ci-com-moonrepo)
   - [Passo 6: Validação Manual Obrigatória (Swagger, Banco e Interface Docker)](#passo-6-validação-manual-obrigatória-swagger-banco-e-interface-docker)
   - [Passo 7: Checklist Pré-Push Sequencial Obrigatório](#passo-7-checklist-pré-push-sequencial-obrigatório)
5. [Padrão de Commits](#5-padrão-de-commits-conventional-commits)
6. [Padrão de Pull Request](#6-padrão-de-pull-request-pr)
   - [6.1 Requisitos para Aprovação](#61-requisitos-para-aprovação)
   - [6.2 Prints e Evidências Obrigatórias por Escopo](#62-prints-e-evidências-obrigatórias-por-escopo)
   - [6.3 Gestão de Débitos Técnicos (Escopo Atual vs Outros Escopos)](#63-gestão-de-débitos-técnicos-escopo-atual-vs-outros-escopos)
   - [6.4 Template Canônico do Corpo do PR](#64-template-canônico-do-corpo-do-pr)
7. [Troubleshooting (Resolução de Problemas Frequentes)](#7-troubleshooting-resolução-de-problemas-frequentes)
   - [7.1 Como Instalar e Executar o Moonrepo CLI (`moon`)](#71-como-instalar-e-executar-o-moonrepo-cli-moon)
   - [7.2 Invalidação e Limpeza do Cache do Moonrepo](#72-invalidação-e-limpeza-do-cache-do-moonrepo)
   - [7.3 Visualização do Grafo de Dependências e Ações do Moon](#73-visualização-do-grafo-de-dependências-e-ações-do-moon)
   - [7.4 `fatal: .git/index: index file smaller than expected` (Windows / OneDrive)](#74-fatal-gitindex-index-file-smaller-than-expected-windows--onedrive)
   - [7.5 Erro de módulo `@farmaubs/shared` não encontrado](#75-erro-de-módulo-farmaubsshared-não-encontrado)
   - [7.6 Conflito de Portas no PostgreSQL (`5432` / `5434` / `5435`)](#76-conflito-de-portas-no-postgresql-5432--5434--5435)
   - [7.7 `Seed de desenvolvimento só pode rodar com NODE_ENV=development`](#77-seed-de-desenvolvimento-só-pode-rodar-com-node_envdevelopment)
   - [7.8 Containers Docker desatualizados ou instáveis](#78-containers-docker-desatualizados-ou-instáveis)
   - [7.9 Erro `Failed to resolve import` ou módulo ausente no container](#79-erro-failed-to-resolve-import-ou-módulo-ausente-no-container)

---

## 1. Visão Geral e Arquitetura dos Projetos

O **FarmaUBS** é organizado como um **Monorepo gerenciado oficialmente pelo Moonrepo (`moon`)** sobre a infraestrutura de pacotes do PNPM ([ADR-022](./docs/adrs/adr-022-organizacao-de-repositorios.md), [ADR-035](./docs/adrs/adr-035-governanca-e-orquestracao-de-monorepo.md)):

```text
farmaubs/
├── .moon/              # Configuração global do Moonrepo
│   ├── workspace.yml   # Registro de projetos (backend, frontend, mobile, shared) e VCS git
│   └── toolchain.yml   # Governança de versões (Node.js 20 LTS, PNPM 11)
├── apps/
│   ├── backend/        # API REST NestJS (Clean Architecture Pura + Ports & Adapters + RLS)
│   │   └── moon.yml    # Tarefas atômicas (dev, build, test, test-bdd, test-schema, test-integration)
│   ├── frontend/       # SPA Web (React 19 + Vite + Tailwind CSS + TanStack Query)
│   │   └── moon.yml    # Tarefas atômicas (dev, build, test, lint, preview)
│   └── mobile/         # App Nativo (React Native + Expo SDK 52 + SecureStore)
│       └── moon.yml    # Tarefas atômicas (start, android, ios, web, typecheck, test)
├── packages/
│   └── shared/         # Tipos, contratos DTO, enums de domínio e utilitários agnósticos
│       └── moon.yml    # Tarefas da biblioteca (build, dev, lint, clean)
├── infra/              # Docker Compose (dev, test, prod) e configurações Nginx
├── pnpm-workspace.yaml # Definição dos workspaces PNPM
└── package.json        # Manifest raiz
```

### 1.1 Backend (`@farmaubs/backend`) — Clean Architecture Pura + NestJS (ADR-003, ADR-033)

O backend adota a **Clean Architecture clássica (inspirada no repositório `royib/clean-architecture-nestJS`)** combinada com **Vertical Slicing** por módulos de domínio.

- **Regra Fundamental de Pureza:** A camada de **Domínio** e os **Casos de Uso** (`application/use-cases/`) são **100% agnósticos de framework**. É expressamente proibido o uso de `@Injectable()`, `@Inject()`, decorators do NestJS ou TypeORM dentro dos Use Cases.
- **NestJS como Adaptador de Infraestrutura:** O NestJS atua exclusivamente na borda (Controllers HTTP, Guards, Interceptors) e na amarração de dependências via *Custom Providers* (`useFactory`).
- **Multi-tenancy com Row-Level Security (RLS):** As tabelas com dados municipais/unidades utilizam RLS nativo do PostgreSQL com propagação via `TenantInterceptor` e `SET LOCAL farmaubs.current_tenant_id`.

#### Anatomia Canônica de um Módulo do Backend:

```text
apps/backend/src/modules/<modulo>/
├── <modulo>.module.ts          # Módulo NestJS: provê useFactory vinculando Portas concretas aos Use Cases
│
├── api/                        # Adaptadores de Entrada (Driving / Inbound)
│   ├── controllers/            # Controllers NestJS (@Controller, @Get, @Post)
│   └── dto/                    # Validação de payload e Swagger (implementando @farmaubs/shared)
│
├── application/                # Camada de Aplicação Pura
│   └── use-cases/              # Casos de uso PUROS (sem decorators de framework)
│       ├── <acao>.use-case.ts  # Instanciável diretamente em testes sem NestJS Test Module
│       └── <acao>.use-case.spec.ts
│
├── domain/                     # O Coração do Negócio (TypeScript Puro)
│   ├── entities/               # Entidades de Domínio ricas e Value Objects
│   ├── ports/                  # Interfaces que ditam contratos de persistência e serviços
│   └── errors/                 # Erros de domínio customizados
│
└── infrastructure/             # Adaptadores de Saída (Driven / Outbound)
    ├── adapters/               # Implementações concretas das portas (ex: TypeORM, Bcrypt)
    └── persistence/            # Entidades físicas TypeORM e Migrações PostgreSQL
```

---

### 1.2 Frontend (`@farmaubs/frontend`) — React + Vite (ADR-011, ADR-012)

O frontend é uma SPA moderna focada em alta responsividade para as farmácias e almoxarifados municipais.

- **Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query (React Query) e React Router DOM.
- **Isolamento de Contratos:** Utiliza estritamente os contratos importados de `@farmaubs/shared`, desacoplando a camada de visualização de tipos privados do servidor.
- **Gerenciamento de Estado de Servidor:** Utiliza TanStack Query com hooks lógicos (`src/hooks/`) e serviços de API (`src/services/`).

---

### 1.3 Mobile (`@farmaubs/mobile`) — React Native + Expo (ADR-034)

O aplicativo móvel atende aos farmacêuticos e operadores de saúde em campo e no trânsito das UBSs.

- **Stack:** React Native 0.76+, Expo SDK 52 (Managed Workflow), TypeScript e `expo-secure-store`.
- **Componentes Nativos:** A camada de UI utiliza componentes visuais nativos (`<View>`, `<Text>`, `<TextInput>`, `<SafeAreaView>`) em vez de tentar compartilhar JSX/DOM com a Web.
- **Compartilhamento Arquitetural:** Compartilha com o backend e frontend todos os DTOs, enums de status e validações através do pacote `@farmaubs/shared`, e adota tokens de cores institucionais do SUS compartilhados conceitualmente.
- **Segurança Mobile:** Tokens de sessão são gravados de forma criptografada por hardware (Keystore no Android e Keychain no iOS) via `sessionService`.

---

### 1.4 Pacote Compartilhado (`@farmaubs/shared`) — O Núcleo Agnóstico

O `@farmaubs/shared` é a única fonte da verdade de contratos entre Backend, Frontend e Mobile.

- **O que DEVE estar no shared:**
  1. **Interfaces de Contrato de API:** Request e Response DTOs, Comandos e Resultados (ex: `LoginRequest`, `LoginResponseDto`, `CadastrarUsuarioComando`).
  2. **Enums de Domínio:** Papéis de acesso (`PerfilCodigo`), status de sessão (`SessionStatus`), status de lote e movimentação.
  3. **Constantes e Rotas:** Mapa de rotas e códigos de erro de negócio.
  4. **Utilitários e Validações Puras:** Validação de CPF/CNS, funções matemáticas de consumo médio e formatações agnósticas.
- **O que NUNCA deve estar no shared:**
  - Código executável acoplado a frameworks (NestJS, React, TypeORM, Expo).
  - Casos de uso de servidor que manipulem banco de dados ou hashing de senhas.

#### Estrutura Canônica do `@farmaubs/shared`:

```text
packages/shared/src/
├── <modulo>/                       # Organizado rigorosamente pelos mesmos módulos de negócio do backend
│   ├── <recurso>.types.ts          # Interfaces de DTOs, comandos, resultados e enums do recurso
│   └── index.ts                    # Barrel export do módulo
├── constants/                      # Constantes compartilhadas do sistema
│   ├── routes.ts                   # Rotas centralizadas da API
│   └── index.ts
├── utils/                          # Funções utilitárias puras (sem dependência de frameworks)
│   ├── formatters.ts               # Formatadores (CPF, telefone, etc.)
│   └── index.ts
└── index.ts                        # Ponto de entrada raiz (re-exporta exclusivamente os submódulos)
```

- **Regras de Organização do `@farmaubs/shared`:**
  1. **Organização Estritamente por Módulo:** Todo tipo, interface de contrato (Request/Response), comando (Command) ou resultado (Result) DEVE residir em `packages/shared/src/<modulo>/<recurso>.types.ts` (ex: `administracao/usuario.types.ts`, `acesso/login.types.ts`).
  2. **Proibido Pastas Genéricas:** NUNCA crie pastas como `packages/shared/src/dto/`, `models/`, `interfaces/` ou similares. DTOs de API pertencem ao respectivo módulo de negócio.
  3. **Proibido Arquivos Soltos na Raiz de `src/`:** Apenas `packages/shared/src/index.ts` deve existir na raiz de `src/`. Não crie arquivos avulsos de re-exportação na raiz (ex: `src/register-user.command.ts`).
  4. **Exportação Modular em Cascata:** Cada submódulo possui seu próprio `index.ts` que exporta seus arquivos `.types.ts`. A raiz `src/index.ts` re-exporta apenas os diretórios de módulos (`export * from "./<modulo>"`).

---

### 1.5 Orquestração e Governança com Moonrepo (`moon`) (ADR-035)

O FarmaUBS adota oficialmente o **Moonrepo (`moon`)** como sistema de build, orquestrador de tarefas e gerador do Grafo Direcionado Acíclico (DAG) de dependências do monorepo:

- **Instalação do Moon CLI:**
  - Instalação recomendada (Global):
    ```bash
    # Via NPM global:
    npm install -g @moonrepo/cli

    # Ou no Windows (PowerShell):
    irm https://moonrepo.dev/install.ps1 | iex

    # Ou no Linux / macOS:
    curl -fsSL https://moonrepo.dev/install.sh | bash
    ```
  - Execução no repositório (via dependência local ou PNPM):
    ```bash
    # Via script configurado na raiz:
    pnpm moon <comando>
    # ou diretamente via pnpm exec:
    pnpm exec moon <comando>
    # ou via pnpm dlx:
    pnpm --package=@moonrepo/cli dlx moon <comando>
    ```

- **Governança de Toolchain (`.moon/toolchain.yml`):**
  - O Moonrepo padroniza o ambiente de execução em todos os sistemas operacionais, amarrando estritamente **Node.js 20 LTS** e **PNPM 11**.
  - Evita inconsistências de versão entre desenvolvedores e agentes de IA ("na minha máquina funciona").

- **Topologia do Grafo e Resolução Automática de Dependências:**
  - Cada workspace declara suas relações via `moon.yml` (`dependsOn: ['shared']`).
  - Quando um desenvolvedor dispara `moon run backend:dev` ou `moon run frontend:test`, o Moon detecta que o projeto depende de `shared:build` e **compila o pacote compartilhado automaticamente** caso esteja desatualizado, eliminando o erro recorrente de módulos não compilados em `dist/`.

- **Cache Inteligente de Tarefas (Task Hashing & `.moon/cache`):**
  - O Moon calcula hashes criptográficos baseando-se estritamente nos arquivos de entrada (`inputs`), variáveis de ambiente e dependências do pacote.
  - Se um arquivo foi modificado apenas no frontend ou mobile, a execução de testes e build do backend retornará **`CACHE HIT (0ms)`**, economizando tempo de CPU e acelerando a esteira de desenvolvimento.

- **Detecção de Alterações Git (`--affected`):**
  - Permite validar com precisão cirúrgica apenas os workspaces impactados pela branch em relação à `main`:
    ```bash
    # Roda testes apenas dos pacotes modificados:
    moon run :test --affected

    # Valida tipos e lint apenas dos pacotes modificados:
    moon check --affected
    ```

- **Inspeção Interativa do Grafo:**
  - Visualizar o grafo de projetos no terminal ou navegador:
    ```bash
    moon project-graph
    ```
  - Visualizar o grafo de ações e paralelismo de uma tarefa:
    ```bash
    moon action-graph :test
    ```

- **Controle Estrito de Fronteiras Arquiteturais:**
  - O Moon impede que workspaces clientes importem arquivos privados ou infraestrutura de servidor, garantindo limites arquiteturais invioláveis.

---

### 1.6 Infraestrutura (`infra/`)

- **`docker-compose.yml` + `docker-compose.dev.yml`:** Ambiente de desenvolvimento com PostgreSQL e API.
- **`docker-compose.test.yml`:** Instância efêmera de PostgreSQL (porta `5435`) para testes automatizados de migrações e schema.
- **`infra/nginx/`:** Servidor web para distribuição estática e proxy reverso em produção.

---

## 2. Regras Rígidas de Estrutura de Pastas e Fronteira de Escopo (Guia para Humanos e IA)

### 2.1 Princípio Rígido de Isolamento de Escopo (Backend vs Frontend)

> [!CAUTION]
> **Fronteira Inviolável de Pacotes:**
> Desenvolvedores e agentes de IA **NUNCA** devem misturar escopos de Backend e Frontend em uma mesma tarefa ou Pull Request.
>
> 1. **Tarefa de Backend:**
>    - Pode criar ou modificar arquivos **exclusivamente** em `apps/backend/` e `packages/shared/`.
>    - É **expressamente proibido** alterar, criar ou deletar qualquer arquivo em `apps/frontend/`.
> 2. **Tarefa de Frontend:**
>    - Pode criar ou modificar arquivos **exclusivamente** em `apps/frontend/` e `packages/shared/`.
>    - É **expressamente proibido** alterar, criar ou deletar qualquer arquivo em `apps/backend/`.
> 3. **Alterações no `@farmaubs/shared`:**
>    - Devem ser rigorosamente aditivas ou manter retrocompatibilidade com a ponta oposta, garantindo que a compilação global (`pnpm build`) nunca quebre.

### 2.2 Tabela de Correspondência Canônica de Pastas

NUNCA crie pastas arbitrárias no projeto. Ao adicionar novas funcionalidades, consulte a tabela de correspondência abaixo:

| Se você precisa criar...                        | Onde DEVE ficar                                                                                | O que NÃO fazer                                                                        |
| :---------------------------------------------- | :--------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------- |
| **Endpoint REST / Rota HTTP**                   | `apps/backend/src/modules/<modulo>/api/controllers/<nome>.controller.ts`                       | ❌ Não crie pastas como `infrastructure/http` ou `controllers` na raiz do módulo.      |
| **Validação de Request / DTO HTTP**             | `apps/backend/src/modules/<modulo>/api/dto/<recurso>.dto.ts`                                   | ❌ Não crie DTOs em pastas isoladas sem implementar a interface de `@farmaubs/shared`. |
| **Caso de Uso / Regra de Negócio**              | `apps/backend/src/modules/<modulo>/application/use-cases/<acao>.use-case.ts`                   | ❌ Não coloque casos de uso dentro de `domain/` ou no controller.                      |
| **Entidade de Domínio Pura / Model de Negócio** | `apps/backend/src/modules/<modulo>/domain/entities/<recurso>.entity.ts`                        | ❌ Não crie pastas como `domain/models/` ou misture entidades de domínio com TypeORM.  |
| **Interface / Contrato de Repositório**         | `apps/backend/src/modules/<modulo>/domain/ports/<recurso>.repository.port.ts`                  | ❌ Não importe TypeORM dentro da pasta `domain/`. Domínio é TypeScript puro.           |
| **Entidade Física TypeORM (Banco de Dados)**    | `apps/backend/src/modules/<modulo>/infrastructure/persistence/entities/<tabela>.entity.ts`     | ❌ Não crie entidades fora de `infrastructure/persistence/entities`.                   |
| **Implementação de Repositório (SQL/TypeORM)**  | `apps/backend/src/modules/<modulo>/infrastructure/adapters/<recurso>-pg.repository.ts`         | ❌ Não faça queries de banco diretamente dentro do use case ou controller.             |
| **Script de Migração SQL**                      | `apps/backend/src/modules/<modulo>/infrastructure/persistence/migrations/<timestamp><Nome>.ts` | ❌ Não utilize `synchronize: true` do TypeORM em hipótese alguma.                      |
| **Tipagem, DTO de Contrato ou Enum no Shared**  | `packages/shared/src/<modulo>/<recurso>.types.ts`                                              | ❌ NUNCA crie pastas `dto/` ou arquivos soltos na raiz de `packages/shared/src/`.      |
| **Componente de Tela React**                    | `apps/frontend/src/pages/<NomeDaPagina>/index.tsx`                                             | ❌ Não misture views inteiras na pasta `components/ui`.                                |

### 2.3 Padrão Canônico de Comentários de Funções (Micro-TSDoc)

Ao escrever ou refatorar funções, use cases, repositórios, handlers e helpers de negócio, inclua **obrigatoriamente** um cabeçalho TSDoc conciso (de 3 a 6 linhas) no início da função. O objetivo é fornecer contexto semântico direto e desprovido de prolixidade para desenvolvedores e agentes de IA:

- **Estrutura Canônica:**
  ```typescript
  /**
   * [Regra de Negócio / RF]: Descreve de forma direta o propósito e a regra central da operação.
   * @param paramNome - Descrição concisa do papel do parâmetro.
   * @returns O resultado entregue pela função em caso de sucesso.
   * @throws {TipoDeErro} Quando a condição X ocorre violando a regra Y.
   */
  ```

- **Exemplo Real no Backend:**
  ```typescript
  /**
   * [RF026 / Topologia UBS]: Consulta as UBSs ativas vinculadas a um município específico ordenadas por nome.
   * @param municipioId - Identificador único UUID do município de lotação.
   * @returns Lista de unidades de saúde formatadas no contrato UnidadeSaudeDto.
   * @throws {BadRequestException} Caso o municipioId seja nulo, vazio ou inválido.
   */
  async executar(municipioId?: string): Promise<UnidadeSaudeDto[]> {
    if (!municipioId?.trim()) {
      throw new BadRequestException("O parâmetro 'municipioId' é obrigatório.");
    }
    return this.unidadeSaudeRepo.buscarPorMunicipio(municipioId.trim());
  }
  ```

---

## 3. Política de Retenção de Dados: Soft Delete em vez de Hard Delete

> [!IMPORTANT]
> **Instrução para Desenvolvedores e Agentes de IA:**
> O FarmaUBS opera em contexto de saúde pública (SUS/LGPD). Registros históricos são
> evidências de rastreabilidade e **não devem ser apagados fisicamente** durante o ciclo
> de vida normal da aplicação.

### Regra Geral

**Nunca utilize `DELETE` permanente em tabelas que contenham dados de histórico operacional.**
Isso inclui — mas não se limita a — sessões de usuário, acessos, movimentações de estoque,
dispensações e logs de auditoria.

Em vez disso, use **soft delete semântico**: marque o registro como inativo por meio de
campos de status ou data já existentes no schema.

### Como Aplicar

| Situação                      | ❌ Não faça                               | ✅ Faça                                                                                |
| ----------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| Revogar sessão de usuário     | `DELETE FROM sessions WHERE id = $1`      | Invocar `auth_revogar_sessao($1)` — seta `status = 'revogada'` e `revogada_em = now()` |
| Desativar usuário             | `DELETE FROM users WHERE id = $1`         | `UPDATE users SET ativo = false`                                                       |
| Cancelar dispensação          | `DELETE FROM dispensacoes WHERE id = $1`  | `UPDATE dispensacoes SET status = 'cancelada', cancelado_em = now()`                   |
| Remover movimentação com erro | `DELETE FROM movimentacoes WHERE id = $1` | Registrar movimentação de estorno com referência ao `id` original                      |

### Controle Operacional Sem Hard Delete

Registros inativos **nunca aparecem nas consultas operacionais**. O controle é feito via
índices e filtros de status nas procedures/queries — o dado permanece no banco para fins
de auditoria sem impacto de performance nas buscas cotidianas.

```sql
-- Exemplo: a procedure auth_buscar_sessao_por_token filtra internamente:
-- WHERE status = 'ativa' AND expira_em > now()
-- Sessões revogadas ficam no banco, mas nunca são retornadas nas buscas do guard.
```

### Quando o Volume Justificar: Arquivamento, Não Deleção

Se uma tabela crescer a ponto de impactar performance (tipicamente dezenas de milhões de
linhas), a estratégia correta é **arquivamento particionado** — nunca deleção massiva:

1. Mover registros antigos para `<tabela>_archive` (ex: `sessions_archive`).
2. Usar particionamento por data (`PARTITION BY RANGE (criado_em)`).
3. Aplicar compressão e índices de leitura na tabela de arquivo.

Essa abordagem mantém o histórico intacto e acessível para auditoria enquanto a tabela
operacional permanece enxuta. A decisão de quando arquivar será tomada como história
dedicada quando o volume justificar.

### Exceção: Anonimização por Direito ao Esquecimento (LGPD Art. 18, VI)

Quando houver requisito legal explícito de "direito ao esquecimento", **anonimize** em
vez de deletar — preserva o evento, remove os dados pessoais identificáveis:

```sql
UPDATE sessions
SET ip_origem  = NULL,
    user_agent = NULL,
    token_hash = 'anonimizado'
WHERE usuario_id = $1;
```

---

## 4. Fluxo de Trabalho Sequencial do Desenvolvedor

> [!IMPORTANT]
> **Fluxo Obrigatório para Desenvolvedores e Agentes de IA:**
> Siga rigorosamente os passos abaixo em ordem sequencial. Não pule etapas nem inverta a ordem das verificações.

### Passo 0: Leitura Obrigatória de Atualizações
Antes de iniciar qualquer análise ou codificação, verifique se há novas instruções, regras de arquitetura ou checklists atualizados no `CONTRIBUTING.md` da branch `main`.

### Passo 1: Atualizar a branch `main`
Sempre comece o dia de trabalho ou uma nova tarefa sincronizando o repositório local com a `main` remota:

```bash
git checkout main
git pull origin main
```

### Passo 2: Sincronizar Variáveis de Ambiente (`.env` e `.env.example`)
1. Compare o seu `.env` local com o `.env.example`.
2. **Ao introduzir novas variáveis de ambiente:**
   - Adicione imediatamente a chave com valor mock/padrão seguro e descrição no `.env.example`.
   - Comunique explicitamente na descrição do PR a inclusão da nova variável para que os demais membros da equipe atualizem seus arquivos `.env`.
3. Para novos segredos criptográficos, utilize:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
4. Cole as chaves geradas em `SESSION_SECRET` e `ENCRYPTION_KEY` se aplicável.

### Passo 3: Criar a Branch de Trabalho
Respeite a regra de isolamento de escopo (Seção 2.1) e o padrão obrigatório de nomenclatura:  
`<tipo>/<numero-da-issue>-<descricao-curta>`

Exemplos:
- **Backend:**
  ```bash
  git checkout -b feat/42-cadastro-medicamentos
  git checkout -b fix/58-ajuste-validacao-cpf
  ```
- **Frontend:**
  ```bash
  git checkout -b feat/105-gestao-usuarios-tabela
  git checkout -b fix/corrige-padding-tabela
  ```

### Passo 4: Ciclo de Desenvolvimento e Infraestrutura Docker
1. **Subir a stack completa com Docker Compose:**
   A infraestrutura Docker deve estar de pé e operacional durante o desenvolvimento:
   ```bash
   docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up -d
   ```
2. **Acompanhar os logs dos serviços:**
   ```bash
   docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml logs -f api
   docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml logs -f frontend
   ```
3. **Verificar a saúde dos containers:**
   Certifique-se de que os containers (`farmaubs-postgres-1`, `farmaubs-api-1`, `farmaubs-frontend-1`) permanecem saudáveis (`healthy` ou ativos sem reiniciar em loop).
4. **Sincronização de dependências com Docker em execução:**
   Quando novas dependências forem adicionadas ao monorepo (após um `git pull`, `git merge` ou `pnpm add`), sincronize os volumes dos containers:
   ```bash
   docker exec -i farmaubs-api-1 pnpm install && docker restart farmaubs-api-1
   docker exec -i farmaubs-frontend-1 pnpm install && docker restart farmaubs-frontend-1
   ```
5. **Debug e desenvolvimento local via Moonrepo (Oficial):**
   O Moonrepo gerencia automaticamente a ordem de compilação dos pacotes. Ao disparar uma tarefa de desenvolvimento, ele compila o `@farmaubs/shared` automaticamente antes de inicializar o servidor de desenvolvimento:
   ```bash
   # Iniciar o backend NestJS com live-reload (compila shared previamente):
   moon run backend:dev

   # Iniciar a SPA frontend React / Vite:
   moon run frontend:dev

   # Iniciar o aplicativo móvel Expo / React Native:
   moon run mobile:start
   ```

   *Alternativa legada sem Moon (direto via PNPM):*
   ```bash
   # Terminal 1: compilação contínua do shared
   pnpm --filter @farmaubs/shared dev

   # Terminal 2: API backend
   pnpm dev:backend

   # Terminal 3: Frontend Vite
   pnpm dev:frontend

   # Terminal 4: Mobile Expo
   pnpm dev:mobile
   ```

### Passo 5: Execução de Tarefas, Testes e CI com Moonrepo

O FarmaUBS adota o **Moonrepo (`moon`)** como orquestrador oficial de tarefas do monorepo. O Moon oferece **execução paralela com respeito ao grafo DAG**, **cache inteligente de hashes criptográficos (`.moon/cache`)** e **detecção cirúrgica de projetos afetados (`--affected`)**.

Desenvolvedores e agentes de IA **devem rodar as validações sem omitir suítes nem utilizar flags que mascarem falhas**:

#### 5.1 Sintaxe de Alvos e Comandos Canônicos do Moonrepo

No Moonrepo, as tarefas são invocadas pelo formato `moon run <projeto>:<tarefa>` ou `moon run :<tarefa>` (para rodar a tarefa em todos os projetos que a implementam):

```bash
# ==============================================================================
# 1. COMANDOS DO DIA A DIA (MAIS RÁPIDOS - COM CACHE E DETECÇÃO DE ALTERAÇÕES)
# ==============================================================================

# Executa testes apenas nos projetos afetados pelas alterações da branch atual em relação à main:
moon run :test --affected

# Executa checagem de tipos e lint apenas nos arquivos/projetos modificados:
moon check --affected

# ==============================================================================
# 2. VALIDAÇÃO COMPLETA DO MONOREPO
# ==============================================================================

# Roda todos os testes de todos os workspaces em paralelo (backend, frontend, mobile):
moon run :test

# Compila todos os workspaces na ordem correta do grafo (shared -> backend, frontend):
moon run :build

# Executa checagem estática global (tipagem TypeScript e linting):
moon check --all

# Executa o pipeline de CI local completo simulando o servidor de integração contínua:
moon ci

# ==============================================================================
# 3. FLAGS DE CONTROLE DE CACHE E DEPURAÇÃO DO MOON
# ==============================================================================

# Força a reexecução ignorando o cache local (.moon/cache):
moon run :test --force
# ou
moon run :test --no-cache

# Exibe um sumário detalhado de tempo de execução e status de cache (CACHE HIT / MISS):
moon run :test --summary

# Exibe logs em nível de depuração detalhado do Moon:
moon run backend:test --log debug
```

#### 5.2 Tabela Canônica de Tarefas por Pacote (Moon Oficial vs PNPM Alternativo)

| Camada / Workspace | Nome | Onde executa | Comando Moon (Oficial) | Comando PNPM (Alternativo) | Objetivo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Camadas A e C (BDD)** | **Especificação Viva BDD / Aceitação** | Raiz / `apps/backend` | `moon run backend:test-bdd` | `pnpm test:bdd` | Executa cenários Gherkin com Cucumber.js + Chai para Casos de Uso e fluxos E2E. |
| **Camada A** | Testes Unitários de Domínio | `apps/backend` | `moon run backend:test` | `pnpm test:backend` | Valida Use Cases e regras puras isoladas via Jest. |
| **Camada B** | Testes de Integração de Schema | `apps/backend` | `moon run backend:test-schema` | `pnpm --filter @farmaubs/backend test:schema` | Sobe banco efêmero na porta 5435 e testa todas as migrações do zero. |
| **Camada B (Limpeza)** | Derrubar Banco Efêmero de Teste | `apps/backend` | `moon run backend:test-schema-down` | `pnpm --filter @farmaubs/backend test:schema:down` | Para e remove o container PostgreSQL de testes na porta 5435. |
| **Camada C** | Testes de Integração / E2E | `apps/backend` | `moon run backend:test-integration` | `pnpm test:integration` | Valida repositórios e endpoints com banco de dados real. |
| **Camada D** | Testes de Componentes Web | `apps/frontend` | `moon run frontend:test` | `pnpm --filter @farmaubs/frontend test` | Valida componentes e interações de tela no React com Vitest. |
| **Mobile** | Checagem de Tipos e Telas | `apps/mobile` | `moon run mobile:typecheck` | `pnpm test:mobile` | Validação estática de TypeScript e telas nativas do Expo. |
| **Build Global** | Verificação de Compilação | Raiz | `moon run :build` | `pnpm build` | Compila `@farmaubs/shared`, backend e frontend respeitando o grafo DAG. |
| **Seed de Dados** | Povoamento de Desenvolvimento | `apps/backend` | `moon run backend:db-seed` | `pnpm db:seed` | Popula o PostgreSQL dev (5434) com dados iniciais e usuários de teste. |

> [!IMPORTANT]
> **Padrão Obrigatório de BDD / Cucumber (Camadas A e C — Qualidade e Negócio):**
> Ao implementar testes que validam **regras de negócio, casos de uso (Camada A) ou fluxos de aceitação/E2E da API (Camada C)**, é **obrigatório seguir o padrão Cucumber.js + Chai**:
> 1. **Especificação Gherkin:** Arquivos `.feature` localizados em `apps/backend/test/features/<modulo>.feature`, escritos em português (`# language: pt`) com palavras-chave canônicas (`Funcionalidade`, `Cenário`, `Dado`, `Quando`, `Então`, `E`, `Esquema do Cenário`).
> 2. **Definição dos Passos (Step Definitions):** Arquivos `.steps.ts` em `apps/backend/test/features/step_definitions/<modulo>.steps.ts`, utilizando `@cucumber/cucumber` (`Given`, `When`, `Then`, `Before`) e asserções com `chai` (`expect`, `assert`).
> 3. **Execução:** Os cenários devem ser validados pelo comando oficial `moon run backend:test-bdd`.
> 
> **Por que testes técnicos não vão para o Cucumber?**
> Testes de migrations puras (`create-*.spec.ts`), isolamento de RLS PostgreSQL (`rls-tenant-isolation.integration.ts`), decorators do NestJS e renderização de componentes React com JSDOM (Camada D) permanecem em Jest/Vitest. O Cucumber destina-se à especificação de comportamento e requisitos de negócio legíveis por stakeholders; forçar detalhes técnicos de baixo nível em Gherkin é um anti-padrão de projeto.

### Passo 6: Validação Manual Obrigatória (Swagger, Banco e Interface Docker)

A execução com sucesso dos testes automatizados **não substitui** a validação manual. Antes de finalizar o trabalho:

- **Se a tarefa for de Backend:**
  1. **Testar via Swagger:** Acesse a documentação interativa em `http://localhost:3000/api/v1/docs` e dispare requisições manuais para os novos endpoints ou rotas modificadas (testando tanto o fluxo feliz quanto cenários de erro 400, 401 e 403).
  2. **Auditar o Banco de Dados:** Conecte-se ao PostgreSQL de desenvolvimento (porta `5434`) via cliente SQL (`psql`, DBeaver, etc.) e inspecione as tabelas afetadas. Certifique-se de que os dados foram persistidos, atualizados ou marcados com soft delete conforme as regras de negócio e de auditoria.
- **Se a tarefa for de Frontend:**
  1. **Obrigatoriedade do Docker Compose:** O desenvolvedor ou agente de IA **DEVE priorizar a aplicação frontend que sobe via Docker Compose** (`http://localhost:5173`), servida pelo container `farmaubs-frontend-1` integrado com o proxy da API, e **NÃO** uma instância local isolada no host. Isso garante a validação no ambiente conteinerizado idêntico ao de produção.
  2. **Testar o Fluxo Visual e Interativo:** Navegue pelas telas afetadas, preenchendo formulários, validando mensagens de erro, estados de carregamento (*loading*), fechamento de modais com a tecla `Escape` e navegação via teclado/foco (WCAG 2.1 AA).
- **Relato Obrigatório:** Ambos os papéis devem relatar explicitamente na descrição do PR se a validação manual foi concluída com sucesso ou se foram encontrados débitos técnicos.

### Passo 7: Checklist Pré-Push Sequencial Obrigatório

> [!CAUTION]
> **Ordem Estrita de Execução Pré-Push com Moonrepo:**
> Execute as 5 etapas a seguir rigorosamente nesta sequência antes de qualquer `git push`:
>
> 1. **Sincronizar com a `main`:**
>    Faça `git fetch origin main` e integre a versão mais recente da `main` (`git merge origin/main` ou `git rebase origin/main`) caso ela tenha avançado desde a criação da sua branch.
> 2. **Resolver Conflitos com Prioridade à `main`:**
>    Em caso de conflitos de merge/rebase, **priorize sempre o código já estabelecido e aprovado na `main`** em detrimento de código recém-adicionado especulativo.
> 3. **Executar Testes Afetados e Compilação Global:**
>    Rode a suíte afetada e o build com o Moonrepo:
>    ```bash
>    moon run :test --affected
>    moon run :build
>    ```
>    Se sua tarefa implementou ou alterou regras de negócio de casos de uso do backend, valide obrigatoriamente a especificação viva:
>    ```bash
>    moon run backend:test-bdd
>    ```
> 4. **Auditar Contra Relaxamento de Regras e Testes:**
>    Verifique o diff final (`git diff origin/main`) e assegure que:
>    - Nenhuma regra de negócio foi relaxada ou desativada.
>    - Nenhum teste automatizado foi enfraquecido, burlado com `.skip` ou tornado tautológico (ex: mocks que apenas jogam exceção sem executar guards ou regras reais).
>    - Nenhuma tipagem estrita foi substituída por `any`.
> 5. **Conferir Cobertura da História de Usuário:**
>    Confira se as alterações cobrem **100% dos critérios de aceite (BDD)** e requisitos descritos na história de usuário atribuída. Se faltar algum cenário, implemente-o antes de enviar.

---

## 5. Padrão de Commits (Conventional Commits)

Formato obrigatório:  
`<tipo>(<escopo>): <descrição>`

### Tipos Permitidos:

- **`feat`**: Nova funcionalidade.
- **`fix`**: Correção de bug.
- **`test`**: Inclusão ou ajuste de testes.
- **`chore`**: Atualização de dependências, builds ou scripts.
- **`docs`**: Documentação (README, CONTRIBUTING, ADRs).
- **`refactor`**: Reestruturação de código sem alteração funcional.
- **`perf`**: Otimização de desempenho.
- **`style`**: Formatação de código sem impacto na lógica.

### Escopos Obrigatórios:

- **`backend`**: Código da API NestJS.
- **`frontend`**: Código da SPA React.
- **`shared`**: Tipos e contratos do `@farmaubs/shared`.
- **`infra`**: Docker, Docker Compose, Nginx e CI/CD.
- Ou o nome específico do módulo: `(acesso)`, `(administracao)`, `(medicamentos)`, `(estoque)`.

### Exemplos Válidos:

```text
feat(acesso): implementa renovação deslizante de sessão no LoginUseCase

Refs #61
```

```text
fix(shared): corrige cálculo dos dígitos verificadores no validador de CPF

Closes #78
```

---

## 6. Padrão de Pull Request (PR)

### 6.1 Requisitos para Aprovação

1. O título do PR deve seguir o mesmo padrão do commit: `<tipo>(<escopo>): <descrição>`.
2. A branch deve estar atualizada em relação à `main` com conflitos resolvidos com prioridade para a `main`.
3. Todos os testes automatizados relevantes devem estar passando via comandos oficiais do Moonrepo (`moon run ...` ou `moon ci`), com **prints anexados** na descrição do PR.
4. Validação manual (Swagger/Banco ou Interface Docker) relatada.

### 6.2 Prints e Evidências Obrigatórias por Escopo

| Mudança | Evidências Necessárias no PR |
| :--- | :--- |
| **Backend (Regras/Use Cases)** | Print do `moon run backend:test` (unitários) e `moon run backend:test-bdd` (Cucumber) passando. |
| **Backend (Schema/Migrations)** | Print do `moon run backend:test-schema` provando execução em banco limpo porta 5435. |
| **Frontend (Telas)** | Print do `moon run frontend:test` e screenshots das telas afetadas (desktop/mobile). |
| **Mobile (React Native/Expo)** | Print do `moon run mobile:typecheck` e screenshot do app rodando no Expo/emulador. |
| **Shared** | Print do `moon run shared:build` sem erros. |
| **Monorepo / Geral** | Print do `moon run :build` ou `moon ci` concluído com sucesso. |

### 6.3 Gestão de Débitos Técnicos (Escopo Atual vs Outros Escopos)

- **Débitos do Escopo da História Atual:**
  Devem ser **obrigatoriamente resolvidos** antes de abrir ou marcar o PR como pronto para revisão. Não transfira débitos da sua própria tarefa para o futuro.
- **Débitos de Outras Histórias ou Código Legado:**
  Se durante o desenvolvimento você identificar bugs, débitos técnicos ou inconsistências fora do escopo da sua história:
  - **NÃO** altere o código alheio nesta branch (evita inflar o PR e criar conflitos desnecessários).
  - **Registre** os pontos identificados na seção dedicada do PR (`### Débitos Técnicos Identificados (Fora de Escopo)`). Assim, o Gerente de Projetos poderá criar novas histórias e tarefas no backlog.

### 6.4 Template Canônico do Corpo do PR

```markdown
## O que mudou

<Breve resumo das alterações e motivação técnica>

## Como foi testado

### Testes Automatizados com Moonrepo
- [ ] Testes unitários do backend (`moon run backend:test`) — <anexar print>
- [ ] Especificação viva BDD (`moon run backend:test-bdd`) — <anexar print>
- [ ] Testes de schema e migrações (`moon run backend:test-schema`) — <anexar print>
- [ ] Testes unitários do frontend (`moon run frontend:test`) — <anexar print>
- [ ] Validação estática e telas mobile (`moon run mobile:typecheck`) — <anexar print>
- [ ] Build global do monorepo (`moon run :build` ou `moon ci`) — <anexar print>
- [ ] Evidências visuais de tela (frontend/mobile) — <anexar screenshots>

### Validação Manual Obrigatória
- [ ] **Backend**: Testado via Swagger (`http://localhost:3000/api/v1/docs`) e auditado diretamente no banco PostgreSQL.
- [ ] **Frontend**: Testado na aplicação servida pelo Docker Compose (`http://localhost:5173`).
- **Relato da validação manual**: <Descreva brevemente as operações testadas e os resultados obtidos>

## Débitos Técnicos Identificados (Fora de Escopo)

> Liste aqui inconsistências ou débitos de outros módulos/histórias encontrados durante o trabalho (se houver), para abertura de novas issues:
- [ ] <Descrição do débito técnico fora de escopo / sugestão de issue futura>

## Checklist

- [ ] Passo 0 a 7 do CONTRIBUTING.md seguidos rigorosamente
- [ ] Isolamento de escopo respeitado (Backend/Frontend não misturados)
- [ ] Validações pré-push executadas com Moonrepo (`moon run :test --affected` e `moon run :build`)
- [ ] Branch sincronizada com a `main` mais recente com conflitos resolvidos priorizando a `main`
- [ ] Nenhuma regra de negócio ou teste foi relaxado / enfraquecido
- [ ] 100% dos critérios de aceite da história de usuário foram cobertos
- [ ] Funções documentadas com cabeçalho Micro-TSDoc
- [ ] Commits seguindo o padrão Conventional Commits
- [ ] Issue vinculada (`Closes #<numero>` ou `Refs #<numero>`)
- [ ] Arquivos alocados nas pastas canônicas da Arquitetura Hexagonal
- [ ] Novas variáveis de ambiente (se houver) documentadas no `.env.example`
```

---

## 7. Troubleshooting (Resolução de Problemas Frequentes)

### 7.1 Como Instalar e Executar o Moonrepo CLI (`moon`)

- **Se o comando `moon` não for reconhecido no terminal:**
  Instale o CLI globalmente uma única vez:
  ```bash
  # Via NPM:
  npm install -g @moonrepo/cli

  # Ou no Windows PowerShell:
  irm https://moonrepo.dev/install.ps1 | iex

  # Ou no Linux/macOS:
  curl -fsSL https://moonrepo.dev/install.sh | bash
  ```
- **Execução pontual sem instalar globalmente:**
  Caso você não queira ou não possa instalar o binário global, utilize `npx` ou `pnpm dlx`:
  ```bash
  npx moon run :test --affected
  # ou
  pnpm dlx @moonrepo/cli run :test --affected
  ```

### 7.2 Invalidação e Limpeza do Cache do Moonrepo

- **Causa:** O Moon armazena hashes de inputs e outputs no diretório `.moon/cache/`. Em situações raras de cache corrompido ou mudanças ambientais externas:
- **Solução Rápida via Flag:** Execute a tarefa com a flag `--force` ou `--no-cache`:
  ```bash
  moon run :test --force
  ```
- **Solução Definitiva de Limpeza:**
  ```bash
  moon clean
  # ou remova manualmente a pasta de cache:
  rm -rf .moon/cache
  ```

### 7.3 Visualização do Grafo de Dependências e Ações do Moon

- Para inspecionar as conexões entre os pacotes e certificar-se de que não há ciclos ou caminhos quebrados:
  ```bash
  # Visualizar o grafo de projetos no console:
  moon project-graph

  # Visualizar o grafo de dependências de um projeto específico:
  moon project-graph backend

  # Inspecionar o pipeline de execução e concorrência de uma tarefa:
  moon action-graph :test
  ```

### 7.4 `fatal: .git/index: index file smaller than expected` (Windows / OneDrive)

- **Causa:** O OneDrive tenta sincronizar arquivos dentro de `.git/` durante uma operação de escrita do Git, truncando o arquivo de índice para 0 bytes.
- **Solução rápida (sem perda de dados):**
  ```powershell
  Remove-Item .git/index -Force
  git reset
  git add -A
  ```
- **Dica preventiva:** Pause a sincronização do OneDrive na pasta do repositório enquanto estiver codificando.

### 7.5 Erro de módulo `@farmaubs/shared` não encontrado

- **Causa:** O TypeScript ou o bundler não encontraram os arquivos compilados em `packages/shared/dist`.
- **Solução com Moonrepo:**
  ```bash
  moon run shared:build
  ```
- **Solução legada com PNPM:**
  ```bash
  pnpm --filter @farmaubs/shared build
  pnpm install
  ```

### 7.6 Conflito de Portas no PostgreSQL (`5432` / `5434` / `5435`)

- Se você já possui um PostgreSQL instalado na sua máquina host na porta `5432`, o FarmaUBS foi configurado para rodar o banco de desenvolvimento na porta **`5434`** e o banco efêmero de testes na porta **`5435`**.
- Verifique seu `.env` para garantir que `DB_PORT=5434`.

### 7.7 `Seed de desenvolvimento só pode rodar com NODE_ENV=development`

- **Causa:** O script `seed-dev.ts` possui uma trava de segurança para não rodar em produção ou staging.
- **Solução:** Certifique-se de que a variável `NODE_ENV=development` esteja definida no seu arquivo `.env`.

### 7.8 Containers Docker desatualizados ou instáveis

- Para forçar uma reconstrução limpa dos containers:
  ```bash
  docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml down -v
  docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up -d --build --force-recreate
  ```

### 7.9 Erro `Failed to resolve import "<pacote>"` ou módulo ausente no container

- **Causa:** Novas dependências foram adicionadas no `package.json` (no seu host ou via PR/merge), mas os volumes Docker (`node_modules_backend`, `node_modules_frontend`, etc.) mantiveram a versão antiga dos pacotes instalados.
- **Solução Rápida (com containers ativos):**
  Instale diretamente nos containers e reinicie o serviço:

  ```bash
  # Para o backend:
  docker exec -i farmaubs-api-1 pnpm install
  docker restart farmaubs-api-1

  # Para o frontend:
  docker exec -i farmaubs-frontend-1 pnpm install
  docker restart farmaubs-frontend-1
  ```

- **Solução via Rebuild do Compose:**
  ```bash
  docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up -d --build
  ```
- **Solução Definitiva (reset apenas dos volumes de dependências, mantendo o banco de dados intacto):**
  ```bash
  docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml stop api frontend
  docker volume rm farmaubs_node_modules_root farmaubs_node_modules_backend farmaubs_node_modules_frontend farmaubs_node_modules_shared
  docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up -d --build
  ```
