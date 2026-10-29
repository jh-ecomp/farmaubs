# Contributing: guia do desenvolvedor e padrões de engenharia (FarmaUBS)

> Regra mandatória de execução: todos os builds e testes devem ser executados através do Moonrepo (`moon run <projeto>:<tarefa>`, `moon run :<tarefa>` ou `pnpm moon run ...`), nunca via comandos diretos isolados nos pacotes. O Moonrepo gerencia a ordem de compilação do grafo de dependências e o cache de tarefas.

---

## Sumário

1. [Visão geral e arquitetura dos projetos](#1-visão-geral-e-arquitetura-dos-projetos)
   - [1.1 Backend: Clean Architecture e NestJS](#11-backend-clean-architecture-e-nestjs-adr-003-adr-033)
   - [1.2 Frontend: React e Vite](#12-frontend-react-e-vite-adr-011-adr-012)
   - [1.3 Mobile: React Native e Expo](#13-mobile-react-native-e-expo-adr-034)
   - [1.4 Pacote compartilhado: @farmaubs/shared](#14-pacote-compartilhado-farmaubsshared)
   - [1.5 Orquestração com Moonrepo](#15-orquestração-com-moonrepo-adr-035)
   - [1.6 Infraestrutura](#16-infraestrutura)
2. [Estrutura de pastas e fronteira de escopo](#2-estrutura-de-pastas-e-fronteira-de-escopo)
   - [2.1 Isolamento de escopo (backend vs frontend)](#21-isolamento-de-escopo-backend-vs-frontend)
   - [2.2 Padrão de comentários de funções (Micro-TSDoc)](#22-padrão-de-comentários-de-funções-micro-tsdoc)
3. [Política de retenção de dados (soft delete)](#3-política-de-retenção-de-dados-soft-delete)
4. [Fluxo sequencial de trabalho](#4-fluxo-sequencial-de-trabalho)
   - [Passo 0: Leitura de atualizações](#passo-0-leitura-de-atualizações)
   - [Passo 1: Atualizar a branch main](#passo-1-atualizar-a-branch-main)
   - [Passo 2: Sincronizar variáveis de ambiente (.env)](#passo-2-sincronizar-variáveis-de-ambiente-env)
   - [Passo 3: Criar a branch de trabalho](#passo-3-criar-a-branch-de-trabalho)
   - [Passo 4: Desenvolvimento e Docker Compose](#passo-4-desenvolvimento-e-docker-compose)
   - [Passo 5: Execução de tarefas e testes com Moonrepo](#passo-5-execução-de-tarefas-e-testes-com-moonrepo)
   - [Passo 6: Validação manual obrigatória](#passo-6-validação-manual-obrigatória)
   - [Passo 7: Checklist pré-push obrigatório](#passo-7-checklist-pré-push-obrigatório)
5. [Padrão de commits (Conventional Commits)](#5-padrão-de-commits-conventional-commits)
6. [Padrão de pull request (PR)](#6-padrão-de-pull-request-pr)
   - [6.1 Requisitos para aprovação](#61-requisitos-para-aprovação)
   - [6.2 Gestão de débitos técnicos](#62-gestão-de-débitos-técnicos)
   - [6.3 Template canônico do corpo do PR](#63-template-canônico-do-corpo-do-pr)
7. [Troubleshooting (resolução de problemas frequentes)](#7-troubleshooting-resolução-de-problemas-frequentes)

---

## 1. Visão geral e arquitetura dos projetos

O FarmaUBS é organizado como um monorepo governado pelo Moonrepo sobre a infraestrutura de pacotes do PNPM (ADR-022, ADR-035):

```text
farmaubs/
├── .moon/              # Configuração global e toolchain do Moonrepo
├── apps/
│   ├── backend/        # API REST NestJS (Clean Architecture + Ports & Adapters + RLS)
│   ├── frontend/       # SPA Web (React 19 + Vite + Tailwind CSS + TanStack Query)
│   └── mobile/         # App Nativo (React Native + Expo SDK 52 + SecureStore)
├── packages/
│   └── shared/         # Contratos DTO, enums de domínio e utilitários agnósticos
├── infra/              # Docker Compose (dev, test, prod) e Nginx
└── package.json        # Raiz do monorepo
```

### 1.1 Backend: Clean Architecture e NestJS (ADR-003, ADR-033)

O backend adota Clean Architecture combinada com Vertical Slicing por módulos de negócio:

- **Regra de pureza:** A camada de domínio e os casos de uso (`application/use-cases/`) são agnósticos de framework. Não utilize decorators do NestJS (`@Injectable()`, `@Inject()`) ou do TypeORM dentro dos casos de uso.
- **NestJS como infraestrutura:** O NestJS atua apenas na borda (controllers, guards, interceptors) e instancia os casos de uso via `useFactory` no módulo NestJS.
- **Multi-tenancy com RLS:** Tabelas com isolamento municipal ou por unidade de saúde utilizam Row-Level Security no PostgreSQL via `TenantInterceptor` e `SET LOCAL farmaubs.current_tenant_id` (ADR-016).

Estrutura padrão de um módulo do backend:

```text
apps/backend/src/modules/<modulo>/
├── <modulo>.module.ts          # Módulo NestJS com useFactory para os casos de uso
├── api/                        # Inbound: controllers NestJS e DTOs de validação
├── application/                # Casos de uso puros e seus testes unitários (.spec.ts)
├── domain/                     # Entidades ricas, erros de domínio e portas (interfaces)
└── infrastructure/             # Outbound: repositórios TypeORM e migrações SQL
```

### 1.2 Frontend: React e Vite (ADR-011, ADR-012)

SPA construída com React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query e React Router DOM:

- Consome estritamente os contratos e tipos expostos por `@farmaubs/shared`.
- Gerenciamento de estado de servidor e cache HTTP via TanStack Query em `src/hooks/` e `src/services/`.

### 1.3 Mobile: React Native e Expo (ADR-034)

Aplicativo móvel desenvolvido com React Native, Expo SDK 52 e TypeScript:

- Utiliza componentes nativos da plataforma (`<View>`, `<Text>`, `<TextInput>`).
- Compartilha tipos, DTOs e enums a partir de `@farmaubs/shared`.
- Armazena tokens de autenticação criptografados via Keystore no Android e Keychain no iOS (`expo-secure-store`).

### 1.4 Pacote compartilhado: @farmaubs/shared

Fonte única de verdade para contratos entre backend, frontend e mobile:

- **O que deve estar no shared:** DTOs de request e response, enums de domínio (papéis, status), rotas centralizadas, utilitários puros (validação de CPF, cálculos agnósticos).
- **O que não deve estar no shared:** Código dependente de frameworks (NestJS, React, TypeORM) ou operações com banco de dados.
- **Estrutura de pastas:** Os arquivos devem residir em `packages/shared/src/<modulo>/<recurso>.types.ts`. Não crie pastas genéricas como `dto/` ou `interfaces/`, nem arquivos avulsos na raiz de `src/`.

### 1.5 Orquestração com Moonrepo (ADR-035)

O Moonrepo gerencia o build, execução de tarefas e cache inteligente:

- **Instalação do CLI:** Instale globalmente com `npm install -g @moonrepo/cli`, ou execute via script do projeto com `pnpm moon <comando>`.
- **Toolchain unificado:** Padroniza as versões do Node.js 20 LTS e PNPM 11 (`.moon/toolchain.yml`).
- **Resolução de dependências:** Ao disparar tarefas do backend ou frontend, o Moonrepo compila `@farmaubs/shared` automaticamente se houver alterações pendentes.
- **Cache de tarefas:** Hashes de inputs evitam reexecuções desnecessárias quando arquivos não foram alterados.

### 1.6 Infraestrutura

- `infra/docker-compose.yml` e `infra/docker-compose.dev.yml`: ambiente de desenvolvimento com PostgreSQL (porta **5434**) e API.
- `infra/docker-compose.test.yml`: banco PostgreSQL efêmero na porta **5435** para testes automatizados de migrações e schema.

---

## 2. Estrutura de pastas e fronteira de escopo

### 2.1 Isolamento de escopo (backend vs frontend)

Não misture escopos de backend e frontend em uma mesma branch ou Pull Request:

- **Tarefa de backend:** Altere apenas arquivos em `apps/backend/` e `packages/shared/`. É proibido alterar arquivos em `apps/frontend/`.
- **Tarefa de frontend:** Altere apenas arquivos em `apps/frontend/` e `packages/shared/`. É proibido alterar arquivos em `apps/backend/`.
- **Alterações em `@farmaubs/shared`:** Devem ser aditivas ou compatíveis com as duas aplicações para não quebrar a compilação do monorepo.

Diretrizes de alocação de arquivos:

- Controllers HTTP: `apps/backend/src/modules/<modulo>/api/controllers/`
- DTOs com validação: `apps/backend/src/modules/<modulo>/api/dto/`
- Casos de uso: `apps/backend/src/modules/<modulo>/application/use-cases/`
- Entidades de domínio puras: `apps/backend/src/modules/<modulo>/domain/entities/`
- Portas de repositório (interfaces): `apps/backend/src/modules/<modulo>/domain/ports/`
- Repositórios TypeORM: `apps/backend/src/modules/<modulo>/infrastructure/adapters/`
- Entidades de banco TypeORM: `apps/backend/src/modules/<modulo>/infrastructure/persistence/entities/`
- Migrações SQL: `apps/backend/src/modules/<modulo>/infrastructure/persistence/migrations/`
- Páginas web: `apps/frontend/src/pages/<NomeDaPagina>/`

### 2.2 Padrão de comentários de funções (Micro-TSDoc)

Adicione um comentário conciso de 3 a 6 linhas ao topo de funções, use cases e repositórios:

```typescript
/**
 * [Regra de Negócio / RF]: Descreve o propósito da operação.
 * @param paramNome - Papel do parâmetro recebido.
 * @returns Resultado da função em caso de sucesso.
 * @throws {TipoDeErro} Cenário em que a regra é violada.
 */
```

---

## 3. Política de retenção de dados (soft delete)

Não utilize `DELETE` em tabelas com dados operacionais ou de rastreabilidade (sessões, movimentações de estoque, dispensações e logs de auditoria). Utilize soft delete semântico:

- **Sessões de usuário:** Chamar `auth_revogar_sessao($1)` para registrar status revogada e data de revogação.
- **Usuários:** Atualizar para `ativo = false`.
- **Dispensações:** Atualizar status para cancelada com data de cancelamento.
- **Movimentações com erro:** Registrar movimentação de estorno referenciando o identificador original.
- **Direito ao esquecimento (LGPD):** Anonimizar dados pessoais identificáveis no registro em vez de deletar a linha.

Consultas operacionais filtram registros inativos por padrão, preservando os dados para auditoria.

---

## 4. Fluxo sequencial de trabalho

Siga rigorosamente as etapas abaixo ao desenvolver:

### Passo 0: Leitura de atualizações
Verifique se houve alterações recentes nas diretrizes do `CONTRIBUTING.md` na branch **main**.

### Passo 1: Atualizar a branch main
Sincronize o repositório local antes de iniciar qualquer atividade:

```bash
git checkout main
git pull origin main
```

### Passo 2: Sincronizar variáveis de ambiente (.env)
Compare seu `.env` local com `.env.example`. Ao introduzir novas variáveis, inclua uma chave de exemplo no `.env.example` e informe na descrição do PR.

### Passo 3: Criar a branch de trabalho
Nomeie a branch no formato `<tipo>/<numero-da-issue>-<descricao-curta>`:

```bash
git checkout -b feat/42-cadastro-medicamentos
git checkout -b fix/58-ajuste-validacao-cpf
```

### Passo 4: Desenvolvimento e Docker Compose
Suba os serviços locais via Docker Compose:

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up -d
```

Containers ativos: **farmaubs-postgres-1**, **farmaubs-api-1** e **farmaubs-frontend-1**.

Comandos de desenvolvimento via Moonrepo:

```bash
# Iniciar backend NestJS (compila shared automaticamente):
moon run backend:dev

# Iniciar frontend React / Vite:
moon run frontend:dev

# Iniciar app mobile Expo:
moon run mobile:start
```

Caso dependências sejam atualizadas com containers em execução:

```bash
docker exec -i farmaubs-api-1 pnpm install && docker restart farmaubs-api-1
docker exec -i farmaubs-frontend-1 pnpm install && docker restart farmaubs-frontend-1
```

### Passo 5: Execução de tarefas e testes com Moonrepo

Execute validações através do Moonrepo:

```bash
# Executa testes apenas nos projetos afetados pela branch:
moon run :test --affected

# Checagem estática de tipos e lint nos arquivos modificados:
moon check --affected

# Validação completa do monorepo:
moon run :test
moon run :build
moon ci
```

Tarefas atômicas por escopo:

- **Regras de negócio BDD (Camadas A e C):** `moon run backend:test-bdd` (Cucumber.js + Chai em português em `apps/backend/test/features/`).
- **Testes unitários do backend (Camada A):** `moon run backend:test`.
- **Execução de novas migrações no banco dev:** `moon run backend:migration-run` (e `moon run backend:migration-revert` para reversão).
- **Testes de schema e migrações (Camada B):** `moon run backend:test-schema` (executa em banco efêmero porta **5435**). Para derrubar o banco de teste: `moon run backend:test-schema-down`.
- **Testes de integração do backend (Camada C):** `moon run backend:test-integration`.
- **Testes de componentes web (Camada D):** `moon run frontend:test`.
- **Checagem de tipos mobile:** `moon run mobile:typecheck`.
- **Povoamento de banco local:** `moon run backend:db-seed`.

### Passo 6: Validação manual obrigatória

A validação manual é obrigatória antes de submeter o PR:

- **Backend:** Dispare requisições via Swagger em `http://localhost:3000/api/v1/docs` (cenários de sucesso e erros 400, 401, 403) e audite os registros no PostgreSQL porta **5434**.
- **Frontend:** Valide as telas na aplicação servida pelo Docker Compose em `http://localhost:5173` no container **farmaubs-frontend-1**, verificando interações, formulários, feedbacks de erro e acessibilidade.
- **Relato:** Descreva o resultado da validação manual na descrição do PR.

### Passo 7: Checklist pré-push obrigatório

Execute estas etapas nesta ordem antes de enviar alterações:

1. **Sincronizar com a main:** Execute `git fetch origin main` e integre a versão atualizada da **main** com merge ou rebase.
2. **Resolver conflitos:** Priorize o código já estabelecido e aprovado na **main**.
3. **Executar testes afetados e build:**
   ```bash
   moon run :test --affected
   moon run :build
   ```
   Se alterou regras de negócio de casos de uso do backend, rode também:
   ```bash
   moon run backend:test-bdd
   ```
4. **Auditar o diff:** Verifique `git diff origin/main` para garantir que nenhuma regra foi relaxada, nenhum teste foi desativado com `.skip` e não há uso indevido de `any`.
5. **Conferir critérios de aceite:** Certifique-se de cobrir todos os cenários da história de usuário.
6. **Atualizar o progresso das histórias de usuário:**
   - Marque os critérios concluídos com `[x]` no arquivo markdown da história (`docs/historias-usuario/.../<historia>.md`).
   - Atualize o status para `✅ Concluída` no arquivo `PROGRESSO.md` do épico.
   - Atualize a linha correspondente no mapa consolidado geral (`docs/historias-usuario/MAPA_HISTORIAS.md`).

---

## 5. Padrão de commits (Conventional Commits)

Formato: `<tipo>(<escopo>): <descrição>`

Tipos permitidos: `feat`, `fix`, `test`, `chore`, `docs`, `refactor`, `perf`, `style`.

Escopos permitidos: `backend`, `frontend`, `shared`, `infra` ou o nome do módulo específico (`acesso`, `recebimento`, `administracao`).

Exemplos:

```text
feat(acesso): implementa renovacao deslizante de sessao no LoginUseCase

Refs #61
```

```text
fix(shared): corrige calculo dos digitos verificadores no validador de CPF

Closes #78
```

---

## 6. Padrão de pull request (PR)

### 6.1 Requisitos para aprovação

1. Título do PR no formato Conventional Commits.
2. Branch sincronizada com a **main** e conflitos resolvidos.
3. Testes automatizados passando no Moonrepo com prints anexados na descrição.
4. Validação manual relatada.
5. Progresso das histórias de usuário atualizado nos arquivos correspondentes.

### 6.2 Gestão de débitos técnicos

- **Débitos da história atual:** Devem ser corrigidos antes da submissão do PR.
- **Débitos fora de escopo:** Não altere arquivos fora da sua tarefa. Registre os pontos encontrados na seção de débitos técnicos do PR para criação de issues futuras.

### 6.3 Template canônico do corpo do PR

```markdown
## O que mudou

<Breve resumo das alterações e motivação técnica>

## Como foi testado

### Testes automatizados com Moonrepo
- [ ] Testes unitários do backend (`moon run backend:test`) - anexar print
- [ ] Especificação viva BDD (`moon run backend:test-bdd`) - anexar print
- [ ] Testes de schema e migrações (`moon run backend:test-schema`) - anexar print
- [ ] Testes unitários do frontend (`moon run frontend:test`) - anexar print
- [ ] Validação estática e telas mobile (`moon run mobile:typecheck`) - anexar print
- [ ] Build global do monorepo (`moon run :build` ou `moon ci`) - anexar print
- [ ] Evidências visuais de tela (frontend/mobile) - anexar screenshots

### Validação manual obrigatória
- [ ] Backend testado via Swagger (http://localhost:3000/api/v1/docs) e auditado no banco PostgreSQL.
- [ ] Frontend testado na aplicação servida pelo Docker Compose (http://localhost:5173).
- **Relato da validação manual**: <Descreva as operações testadas e os resultados obtidos>

## Débitos técnicos identificados (fora de escopo)

- [ ] <Descrição do débito técnico fora de escopo para abertura de issue futura>

## Checklist

- [ ] Passo 0 a 7 do CONTRIBUTING.md seguidos rigorosamente
- [ ] Isolamento de escopo respeitado (backend e frontend não misturados)
- [ ] Validações pré-push executadas com Moonrepo (`moon run :test --affected` e `moon run :build`)
- [ ] Branch sincronizada com a main mais recente
- [ ] Nenhuma regra de negócio ou teste foi relaxado ou enfraquecido
- [ ] Todos os critérios de aceite da história de usuário foram cobertos
- [ ] Progresso das histórias de usuário atualizado (arquivos individuais, PROGRESSO.md e MAPA_HISTORIAS.md)
- [ ] Funções documentadas com cabeçalho Micro-TSDoc
- [ ] Commits no padrão Conventional Commits
- [ ] Issue vinculada (`Closes #<numero>` ou `Refs #<numero>`)
- [ ] Arquivos alocados nas pastas canônicas da arquitetura
- [ ] Novas variáveis de ambiente documentadas no `.env.example`
```

---

## 7. Troubleshooting (resolução de problemas frequentes)

### 7.1 Como instalar e executar o Moonrepo CLI

Instalação global recomendada:

```bash
# Via NPM:
npm install -g @moonrepo/cli

# No Windows PowerShell:
irm https://moonrepo.dev/install.ps1 | iex

# No Linux/macOS:
curl -fsSL https://moonrepo.dev/install.sh | bash
```

Execução pontual via script raiz sem instalação global: `pnpm moon <comando>`.

### 7.2 Invalidação e limpeza do cache do Moonrepo

Para ignorar o cache em uma execução:

```bash
moon run :test --force
```

Para limpar completamente o cache local:

```bash
moon clean
```

### 7.3 Conflito de portas no PostgreSQL

- Porta **5432**: padrão de instalações locais no sistema operacional host.
- Porta **5434**: banco de desenvolvimento do FarmaUBS via Docker (`DB_PORT=5434` no `.env`).
- Porta **5435**: banco efêmero de testes de schema (`docker-compose.test.yml`).

### 7.4 Índice corrompido do Git no Windows / OneDrive

Se ocorrer o erro `fatal: .git/index: index file smaller than expected`:

```powershell
Remove-Item .git/index -Force
git reset
git add -A
```

### 7.5 Erro de módulo @farmaubs/shared não encontrado

Execute a compilação do pacote compartilhado:

```bash
moon run shared:build
```

### 7.6 Seed de desenvolvimento bloqueado

O script `seed-dev.ts` exige ambiente de desenvolvimento. Verifique se a variável `NODE_ENV=development` está definida no arquivo `.env`.

### 7.7 Dependências desatualizadas nos containers Docker

Se novas dependências foram adicionadas e o container apresentar erro de módulo não encontrado:

```bash
docker exec -i farmaubs-api-1 pnpm install && docker restart farmaubs-api-1
docker exec -i farmaubs-frontend-1 pnpm install && docker restart farmaubs-frontend-1
```
