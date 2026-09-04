# CONTRIBUTING — Fluxo de Trabalho do Desenvolvedor (FarmaUBS)

> Define o ciclo completo de desenvolvimento no monorepo (ADR-022): pull na main →
> branch → testes → commit → pull request. Aplica-se a backend, frontend, shared e infra.

## 1. Fluxo de trabalho

### 1.1 Atualizar a main

```bash
git checkout main
git pull origin main
```

### 1.2 Criar a branch

Padrão: `<tipo>/<numero-da-issue>-<descricao-curta>`
Alternativamente você pode usar a ferramenta criar branch present nas Issues do GitHub.

```bash
git checkout -b feat/25-testes-integracao-schema
```

- `<tipo>`: mesmo vocabulário do commit (feat, fix, chore, test, docs, refactor, perf, style, ci)
- `<numero-da-issue>`: número da tarefa no GitHub Projects (ex.: 25)
- `<descricao-curta>`: kebab-case, sem acento, no máximo 5 palavras

Sem issue vinculada: `git checkout -b fix/corrige-validacao-email`

### 1.3 Desenvolver

- Commits atômicos: um commit por mudança lógica (seção 3)
- Rodar os testes da seção 2 antes de cada commit e novamente antes do push

## 2. Testes antes do commit

**Onde rodar:** localmente, na máquina do desenvolvedor (ADR-030 — não há gate de CI nesta fase; a evidência é levada ao PR). Docker Compose é obrigatório para os testes de integração.

Ordem recomendada (da mais barata à mais cara):

| #   | Comando            | Onde                                         | O que valida                                                          |
| --- | ------------------ | -------------------------------------------- | --------------------------------------------------------------------- |
| 1   | `pnpm lint`        | apps/backend, apps/frontend, packages/shared | Padrões de código (ESLint)                                            |
| 2   | `pnpm test`        | apps/backend                                 | Testes unitários de domínio — camada A (Jest, sem banco)              |
| 3   | `pnpm test:schema` | apps/backend                                 | Testes de integração de schema — camada B (banco efêmero, porta 5435) |
| 4   | `pnpm test`        | apps/frontend                                | Testes de componente — camada D (Testing Library)                     |
| 5   | `pnpm build`       | raiz do monorepo                             | Compilação de todos os packages (TypeScript)                          |

Detalhes:

- `test:schema` sobe o Postgres efêmero via `docker-compose.test.yml`, aplica as migrations do zero em banco limpo e executa os TCs (TC-01 a TC-13). Exige Docker rodando. Ao final, derrube o container com `pnpm test:schema:down`.
- Mudanças em política de RLS ou em lógica de concorrência de estoque (ADR-008) exigem teste de integração correspondente **antes do merge**, sem exceção (ADR-030).
- Rerode a suíte completa após a última alteração, antes do push.

## 3. Padrão de commits

Formato: `<tipo>(<package>): <descrição>`

Tipos (Conventional Commits):

| Tipo     | Uso                                               |
| -------- | ------------------------------------------------- |
| feat     | Nova funcionalidade                               |
| fix      | Correção de bug                                   |
| test     | Testes (novos ou ajustes)                         |
| chore    | Manutenção, dependências, build tooling           |
| docs     | Documentação (ADRs, README, CONTRIBUTING)         |
| refactor | Mudança sem alterar comportamento                 |
| perf     | Otimização de performance                         |
| style    | Formatação, sem mudança lógica                    |
| ci       | Pipeline/CI (quando o ADR-024 entrar em operação) |

Escopos (packages do monorepo — ADR-022):

| Escopo   | Diretório                                 |
| -------- | ----------------------------------------- |
| backend  | apps/backend (NestJS, migrations, schema) |
| frontend | apps/frontend (React + Vite)              |
| shared   | packages/shared (tipos e DTOs)            |
| infra    | infra/ (docker-compose, deploy)           |

Regras:

- Descrição no imperativo, minúscula, sem ponto final, até 72 caracteres
- Corpo explica o **porquê**, não o quê
- Referencie a issue no corpo: `Refs #25` ou `Closes #25`

Exemplos:

```
feat(backend): adiciona testes de integração de schema (TC-01 a TC-13)

Cria o harness de banco efêmero (docker-compose.test.yml) e os 13 testes
de schema da camada B do ADR-030, provando que as migrations aplicam
do zero em banco limpo e que o down() é idempotente.

Closes #25
```

```
fix(frontend): corrige validação de quantidade dispensada

A validação aceitava quantidade zero; passa a exigir valor positivo
conforme RF010.

Refs #32
```

## 4. Pull Request

### 4.1 Abertura

- Título: `<tipo>(<package>): <descrição>` (mesmo padrão do commit)
- Corpo: template da seção 4.3
- Vincular a issue: `Closes #<numero>` no corpo

### 4.2 Prints esperados no corpo do PR

A evidência de teste substitui o gate de CI nesta fase (ADR-030) — **sem os prints, o PR não é aprovado pelo revisor**.

| Tipo de mudança             | Prints obrigatórios                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| Backend (código)            | Saída do `pnpm test` (unit) com todos passando; saída do `pnpm build` sem erros                |
| Backend (schema/migrations) | Saída do `pnpm test:schema` com os 13 TCs passando (prova de aplicação do zero em banco limpo) |
| Frontend                    | Prints das telas afetadas (antes/depois quando aplicável); saída do `pnpm test` (componentes)  |
| Shared                      | Saída do build do package                                                                      |
| Infra                       | Saída do comando validado (ex.: `docker compose up`, `docker compose config`)                  |

### 4.3 Template do corpo do PR (utilize somente o que convém para o PR em questão)

```markdown
## O que mudou

<resumo do que foi feito e por quê>

## Como foi testado

- [ ] `pnpm test` (backend) — <print>
- [ ] `pnpm test:schema` (backend) — <print>
- [ ] `pnpm build` — <print>
- [ ] `pnpm test` (frontend) — <print>
- [ ] Prints das telas afetadas — <prints>

## Checklist

- [ ] Branch criada a partir da main atualizada
- [ ] Testes da seção 2 executados e passando
- [ ] Commits no padrão `<tipo>(<package>)`
- [ ] Issue vinculada (Closes #<numero>)
- [ ] Prints anexados conforme a tabela da seção 4.2
```

## 5. Execução de SQL no banco dev

### 5. Com credenciais da API (backend)

```PowerShell
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml exec postgres psql -U farmaubs_admin -d farmaubs -c "SUA-QUERY-AQUI';"
```
