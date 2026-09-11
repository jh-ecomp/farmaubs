# CONTRIBUTING — Guia do Desenvolvedor e Padrões de Engenharia (FarmaUBS)

> **Documento Vivo de Engenharia de Software.**  
> Este guia orienta desenvolvedores (de iniciantes a seniores) e **agentes de Inteligência Artificial** sobre a arquitetura do FarmaUBS, padrões de código, organização de diretórios, execução de testes e ciclo de vida de contribuição no monorepo.

---

## Sumário

1. [Visão Geral e Arquitetura dos Projetos](#1-visão-geral-e-arquitetura-dos-projetos)
   - [1.1 Backend (`@farmaubs/backend`)](#11-backend-farmaubsbackend---nestjs--arquitetura-hexagonal)
   - [1.2 Frontend (`@farmaubs/frontend`)](#12-frontend-farmaubsfrontend---react--vite)
   - [1.3 Pacote Compartilhado (`@farmaubs/shared`)](#13-pacote-compartilhado-farmaubsshared)
   - [1.4 Infraestrutura (`infra/`)](#14-infraestrutura-infra)
2. [Regras Rígidas de Estrutura de Pastas (Guia para Humanos e IA)](#2-regras-rígidas-de-estrutura-de-pastas-guia-para-humanos-e-ia)
3. [Fluxo de Trabalho do Desenvolvedor](#3-fluxo-de-trabalho-do-desenvolvedor)
   - [3.1 Atualizar a main](#31-atualizar-a-branch-main)
   - [3.2 Sincronizar Variáveis de Ambiente](#32-sincronizar-variáveis-de-ambiente-env)
   - [3.3 Criar a Branch de Trabalho](#33-criar-a-branch-de-trabalho)
   - [3.4 Ciclo de Desenvolvimento](#34-ciclo-de-desenvolvimento)
   - [3.5 Como Rodar os Testes (Camadas A, B, C, D)](#35-como-rodar-os-testes-camadas-a-b-c-d)
4. [Padrão de Commits](#4-padrão-de-commits-conventional-commits)
5. [Padrão de Pull Request](#5-padrão-de-pull-request-pr)
6. [Troubleshooting (Resolução de Problemas Frequentes)](#6-troubleshooting-resolução-de-problemas-frequentes)

---

## 1. Visão Geral e Arquitetura dos Projetos

O **FarmaUBS** é organizado como um **Monorepo PNPM** com tipagem estrita em TypeScript:

```text
farmaubs/
├── apps/
│   ├── backend/        # API REST NestJS (Arquitetura Hexagonal + PostgreSQL TypeORM + RLS)
│   └── frontend/       # SPA React 19 + Vite + Tailwind CSS + TanStack Query
├── packages/
│   └── shared/         # Tipos, contratos DTO, enums de domínio e utilitários agnósticos
├── infra/              # Docker Compose (dev, test, prod) e configurações Nginx
├── pnpm-workspace.yaml # Definição dos pacotes do monorepo
└── package.json        # Scripts unificados da raiz
```

### 1.1 Backend (`@farmaubs/backend`) — NestJS + Arquitetura Hexagonal

O backend adota a **Arquitetura Hexagonal (Ports & Adapters)** combinada com **Vertical Slicing** (fatiamento por módulos de domínio).

- **Objetivo da arquitetura:** Isolar a regra de negócio do mundo externo. Banco de dados, frameworks HTTP e bibliotecas são tratados como meros detalhes de implementação (adaptadores plugáveis).
- **Multi-tenancy com Row-Level Security (RLS):** As tabelas com dados municipais/unidades utilizam RLS nativo do PostgreSQL. Cada requisição recebe o escopo do tenant via `TenantInterceptor` e aplica `SET LOCAL farmaubs.current_tenant_id` via `TransactionInterceptor`.

#### Anatomia Canônica de um Módulo do Backend:

```text
apps/backend/src/modules/<modulo>/
├── <modulo>.module.ts          # Módulo NestJS: declara providers, vincula Portas aos Adaptadores e expõe controllers
│
├── api/                        # Adaptadores de Entrada (Driving / Inbound)
│   ├── controllers/            # Controllers NestJS (@Controller, @Get, @Post)
│   │   ├── <modulo>.controller.ts
│   │   └── <modulo>.e2e.spec.ts # Testes de integração de endpoints
│   └── dto/                    # Validação de payload (class-validator) e Swagger (@ApiProperty)
│       └── <recurso>.dto.ts    # DEVE implementar interfaces do @farmaubs/shared
│
├── application/                # Camada de Aplicação
│   └── use-cases/              # Casos de uso orquestradores da regra de negócio
│       ├── <acao>.use-case.ts
│       └── <acao>.use-case.spec.ts # Testes unitários puros (sem banco de dados)
│
├── domain/                     # O Coração do Negócio (TypeScript Puro, sem TypeORM nem NestJS)
│   ├── entities/               # Entidades de Domínio puras e objetos de valor
│   ├── ports/                  # Interfaces que ditam contratos de persistência e serviços
│   │   └── <recurso>.repository.port.ts
│   └── errors/                 # Erros de domínio customizados
│
└── infrastructure/             # Adaptadores de Saída (Driven / Outbound)
    ├── adapters/               # Implementações concretas das portas
    │   ├── <recurso>-pg.repository.ts # Repositório oficial TypeORM/Postgres
    │   └── <recurso>-pg.repository.spec.ts
    └── persistence/
        ├── entities/           # Entidades físicas do TypeORM (@Entity, @Column)
        │   └── <tabela>.entity.ts
        └── migrations/         # Migrações versionadas do schema PostgreSQL
            └── <timestamp><nome>.ts
```

---

### 1.2 Frontend (`@farmaubs/frontend`) — React + Vite

O frontend é uma SPA moderna focada em alta responsividade, feedback instantâneo ao farmacêutico e suporte a conexões instáveis.

- **Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query (React Query) e React Router DOM.
- **Comunicação com Backend:** As chamadas HTTP consomem `/api/v1` via Axios, tipadas com os contratos de `@farmaubs/shared`.
- **Gerenciamento de Estado de Servidor:** Utiliza TanStack Query com cache inteligente para inventários, listas de medicamentos e dispensações.

#### Estrutura de Pastas do Frontend:

```text
apps/frontend/src/
├── assets/                     # Imagens, SVGs e ícones estáticos
├── components/                 # Componentes reutilizáveis
│   ├── ui/                     # Botões, inputs, modais (componentes visuais puros)
│   └── common/                 # Header, Sidebar, layouts e guardas de rota
├── contexts/                   # React Contexts (AuthContext, TenantContext)
├── hooks/                      # Custom hooks reutilizáveis (useAuth, useDebounce)
├── lib/                        # Instâncias de bibliotecas (axios instance, queryClient)
├── pages/                      # Views correspondentes às rotas da aplicação
├── services/                   # Funções de requisição HTTP da API
├── styles/                     # Temas e Tailwind CSS global
├── App.tsx                     # Roteador principal e provedores
└── main.tsx                    # Ponto de entrada React
```

---

### 1.3 Pacote Compartilhado (`@farmaubs/shared`)

O `@farmaubs/shared` é o elo que garante que Frontend e Backend compartilhem a **mesma fonte da verdade** sem duplicação de contratos.

- **O que DEVE estar no shared:**
  1. **Interfaces de Contrato de API:** Request e Response DTOs (ex: `LoginRequest`, `LoginResponse`, `MedicamentoDto`).
  2. **Enums de Domínio:** Papéis de acesso (`PerfilCodigo`), status de sessão (`SessionStatus`), status de lote e movimentação.
  3. **Constantes de Sistema e Rotas:** Mapa centralizado de rotas da API (`API_ROUTES`), limites de paginação.
  4. **Utilitários Puros:** Validação e formatação de CPF (`validarCPF`, `formatarCPF`), normalização de e-mail, funções agnósticas de formatação de datas.
- **O que NUNCA deve estar no shared:**
  - Dependências de frameworks como NestJS (`@Injectable`, `@Controller`), TypeORM (`@Entity`, `@Column`) ou React (`useState`, JSX).

---

### 1.4 Infraestrutura (`infra/`)

- **`docker-compose.yml` + `docker-compose.dev.yml`:** Ambiente de desenvolvimento com PostgreSQL e API.
- **`docker-compose.test.yml`:** Instância efêmera de PostgreSQL (porta `5435`) para testes automatizados de migrações e schema.
- **`infra/nginx/`:** Servidor web para distribuição estática e proxy reverso em produção.

---

## 2. Regras Rígidas de Estrutura de Pastas (Guia para Humanos e IA)

> [!CAUTION]
> **Instrução Crítica para Desenvolvedores e Agentes de IA:**
> NUNCA crie pastas arbitrárias no projeto. Ao adicionar novas funcionalidades, consulte a tabela de correspondência abaixo:

| Se você precisa criar...                       | Onde DEVE ficar                                                                                | O que NÃO fazer                                                                        |
| :--------------------------------------------- | :--------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------- |
| **Endpoint REST / Rota HTTP**                  | `apps/backend/src/modules/<modulo>/api/controllers/<nome>.controller.ts`                       | ❌ Não crie pastas como `infrastructure/http` ou `controllers` na raiz do módulo.      |
| **Validação de Request / DTO HTTP**            | `apps/backend/src/modules/<modulo>/api/dto/<recurso>.dto.ts`                                   | ❌ Não crie DTOs em pastas isoladas sem implementar a interface de `@farmaubs/shared`. |
| **Caso de Uso / Regra de Negócio**             | `apps/backend/src/modules/<modulo>/application/use-cases/<acao>.use-case.ts`                   | ❌ Não coloque casos de uso dentro de `domain/` ou no controller.                      |
| **Interface / Contrato de Repositório**        | `apps/backend/src/modules/<modulo>/domain/ports/<recurso>.repository.port.ts`                  | ❌ Não importe TypeORM dentro da pasta `domain/`. Domínio é TypeScript puro.           |
| **Entidade Física TypeORM (Banco de Dados)**   | `apps/backend/src/modules/<modulo>/infrastructure/persistence/entities/<tabela>.entity.ts`     | ❌ Não crie entidades fora de `infrastructure/persistence/entities`.                   |
| **Implementação de Repositório (SQL/TypeORM)** | `apps/backend/src/modules/<modulo>/infrastructure/adapters/<recurso>-pg.repository.ts`         | ❌ Não faça queries de banco diretamente dentro do use case ou controller.             |
| **Script de Migração SQL**                     | `apps/backend/src/modules/<modulo>/infrastructure/persistence/migrations/<timestamp><Nome>.ts` | ❌ Não utilize `synchronize: true` do TypeORM em hipótese alguma.                      |
| **Tipagem ou Enum compartilhado (Front/Back)** | `packages/shared/src/<modulo>/<recurso>.types.ts`                                              | ❌ Não duplique enums e interfaces separadamente no frontend e backend.                |
| **Componente de Tela React**                   | `apps/frontend/src/pages/<NomeDaPagina>/index.tsx`                                             | ❌ Não misture views inteiras na pasta `components/ui`.                                |

---

## 3. Fluxo de Trabalho do Desenvolvedor

### 3.1 Atualizar a branch `main`

Sempre comece seu dia de trabalho ou uma nova tarefa sincronizando com a `main` remota:

```bash
git checkout main
git pull origin main
```

### 3.2 Sincronizar Variáveis de Ambiente (`.env`)

Se novas variáveis forem introduzidas, elas estarão listadas no `.env.example`:

1. Compare o seu `.env` local com o `.env.example`.
2. Para novos segredos criptográficos, utilize:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. Cole as chaves geradas em `SESSION_SECRET` e `ENCRYPTION_KEY` se aplicável.

### 3.3 Criar a Branch de Trabalho

Padrão obrigatório de nomenclatura de branches:  
`<tipo>/<numero-da-issue>-<descricao-curta>`

Exemplos:

- Com issue no GitHub Projects:
  ```bash
  git checkout -b feat/42-cadastro-medicamentos
  git checkout -b fix/58-ajuste-validacao-cpf
  ```
- Sem issue vinculada (apenas correções pequenas):
  ```bash
  git checkout -b fix/corrige-padding-tabela
  ```

### 3.4 Ciclo de Desenvolvimento

1. **Subir a stack de desenvolvimento com Docker:**
   ```bash
   docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up -d
   ```
2. **Acompanhar os logs da API:**
   ```bash
   docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml logs -f api
   ```
3. **Atualização de dependências com Docker em execução:**
   Os containers de desenvolvimento utilizam volumes nomeados para isolar os diretórios `node_modules` (`node_modules_backend`, `node_modules_frontend`, etc. definidos no `infra/docker-compose.dev.yml`).  
   Quando novas dependências forem adicionadas ao monorepo (após um `git pull`, `git merge` ou `pnpm add`), elas **não entram automaticamente nos containers apenas rodando `pnpm install` no host**. Para sincronizá-las:

   ```bash
   # Opção rápida (com os containers em execução):
   docker exec -i farmaubs-api-1 pnpm install && docker restart farmaubs-api-1
   docker exec -i farmaubs-frontend-1 pnpm install && docker restart farmaubs-frontend-1
   ```

4. **Rodar localmente (sem container para debug rápido):**

   ```bash
   # Terminal 1: compilação contínua do shared
   pnpm --filter @farmaubs/shared dev

   # Terminal 2: API backend com live-reload
   pnpm dev:backend

   # Terminal 3: Frontend Vite
   pnpm dev:frontend
   ```

---

### 3.5 Como Rodar os Testes (Camadas A, B, C, D)

O projeto adota uma pirâmide de testes estrita com 4 camadas de validação (ADR-030):

| Camada       | Nome                           | Onde executa    | Comando                                      | Objetivo                                                             |
| :----------- | :----------------------------- | :-------------- | :------------------------------------------- | :------------------------------------------------------------------- |
| **Camada A** | Testes Unitários de Domínio    | `apps/backend`  | `pnpm test` ou `pnpm test <arquivo.spec.ts>` | Valida Use Cases e regras puras sem necessidade de banco de dados.   |
| **Camada B** | Testes de Integração de Schema | `apps/backend`  | `pnpm test:schema`                           | Sobe banco efêmero na porta 5435 e testa todas as migrações do zero. |
| **Camada C** | Testes de Integração / E2E     | `apps/backend`  | `pnpm test:integration`                      | Valida repositórios e endpoints com banco de dados real.             |
| **Camada D** | Testes de Componentes          | `apps/frontend` | `pnpm test`                                  | Valida componentes e interações de tela no React.                    |
| **Build**    | Verificação de Compilação      | Raiz            | `pnpm build`                                 | Compila `@farmaubs/shared`, backend e frontend simultaneamente.      |

> [!NOTE]
> Ao finalizar testes na porta 5435 (Camada B), derrube o banco de teste efêmero com:
>
> ```bash
> pnpm --filter @farmaubs/backend test:schema:down
> ```

---

## 4. Padrão de Commits (Conventional Commits)

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
- Ou o nome específico do módulo: `(acesso)`, `(medicamentos)`, `(estoque)`.

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

## 5. Padrão de Pull Request (PR)

### 5.1 Requisitos para Aprovação

1. O título do PR deve seguir o mesmo padrão do commit: `<tipo>(<escopo>): <descrição>`.
2. A branch deve estar atualizada em relação à `main`.
3. Todos os testes relevantes devem estar passando com **prints anexados** na descrição do PR.

### 5.2 Prints Obrigatórios por Escopo

| Mudança                         | Evidências Necessárias no PR                                        |
| :------------------------------ | :------------------------------------------------------------------ |
| **Backend (Regras/Use Cases)**  | Print do `pnpm test` (testes unitários passando) e do `pnpm build`. |
| **Backend (Schema/Migrations)** | Print do `pnpm test:schema` provando execução em banco limpo.       |
| **Frontend (Telas)**            | Screenshots das telas afetadas (desktop/mobile) e do build.         |
| **Shared**                      | Print do `pnpm --filter @farmaubs/shared build` sem erros.          |

### 5.3 Template do Corpo do PR

```markdown
## O que mudou

<Breve resumo das alterações e motivação técnica>

## Como foi testado

- [ ] Testes unitários (`pnpm test`) — <anexar print>
- [ ] Testes de schema (`pnpm test:schema`) — <anexar print>
- [ ] Build global do monorepo (`pnpm build`) — <anexar print>
- [ ] Evidências visuais de tela (frontend) — <anexar screenshots>

## Checklist

- [ ] Branch criada a partir da `main` atualizada
- [ ] Commits seguindo o padrão Conventional Commits
- [ ] Issue vinculada (`Closes #<numero>` ou `Refs #<numero>`)
- [ ] Arquivos alocados nas pastas canônicas da Arquitetura Hexagonal
```

---

## 6. Troubleshooting (Resolução de Problemas Frequentes)

### 6.1 `fatal: .git/index: index file smaller than expected` (Windows / OneDrive)

- **Causa:** O OneDrive tenta sincronizar arquivos dentro de `.git/` durante uma operação de escrita do Git, truncando o arquivo de índice para 0 bytes.
- **Solução rápida (sem perda de dados):**
  ```powershell
  Remove-Item .git/index -Force
  git reset
  git add -A
  ```
- **Dica preventiva:** Pause a sincronização do OneDrive na pasta do repositório enquanto estiver codificando.

### 6.2 Erro de módulo `@farmaubs/shared` não encontrado

- **Causa:** O TypeScript ou o Vite não encontraram os arquivos compilados em `packages/shared/dist`.
- **Solução:**
  ```bash
  pnpm --filter @farmaubs/shared build
  pnpm install
  ```

### 6.3 Conflito de Portas no PostgreSQL (`5432` / `5434` / `5435`)

- Se você já possui um PostgreSQL instalado na sua máquina host na porta `5432`, o FarmaUBS foi configurado para rodar o banco de desenvolvimento na porta **`5434`** e o banco efêmero de testes na porta **`5435`**.
- Verifique seu `.env` para garantir que `DB_PORT=5434`.

### 6.4 `Seed de desenvolvimento só pode rodar com NODE_ENV=development`

- **Causa:** O script `seed-dev.ts` possui uma trava de segurança para não rodar em produção ou staging.
- **Solução:** Certifique-se de que a variável `NODE_ENV=development` esteja definida no seu arquivo `.env`.

### 6.5 Containers Docker desatualizados ou instáveis

- Para forçar uma reconstrução limpa dos containers:
  ```bash
  docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml down -v
  docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up -d --build --force-recreate
  ```

### 6.6 Erro `Failed to resolve import "<pacote>"` ou módulo ausente no container

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
