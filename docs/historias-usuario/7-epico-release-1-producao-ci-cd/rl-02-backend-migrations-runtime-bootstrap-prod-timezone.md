# RL-02 feat(database): Migrations de Runtime em `dist/`, Bootstrap de Produção e Fuso Horário Padrão

---

- **Épico**: Release 1 — Prontidão para Produção, CI/CD e Infraestrutura
- **Requisitos Não-Funcionais**: NF003 (Português/Brasil e datas locais), NF004 (Deploy seguro), NF015 (Multi-tenancy inicial), ADR-025 (Separação entre dados sintéticos e produção)
- **ADRs Vinculadas**: ADR-015 (PostgreSQL), ADR-016 (RLS e roles `farmaubs_admin`/`farmaubs_app`), ADR-023 (Containerização), ADR-025 (Ambientes)

---

## 1. História de usuário

> **Como** desenvolvedor responsável pelo deploy do FarmaUBS,  
> **quero** executar as migrations TypeORM diretamente a partir do código compilado (`dist/`) dentro do container de produção, inicializar um ambiente novo com um script idempotente de bootstrap (sem massa fictícia de desenvolvimento) e garantir fuso horário consistente (`America/Sao_Paulo`) nos filtros diários,  
> **para que** o pipeline de CD aplique alterações de schema sem depender de `ts-node` ou da pasta `src/`, o ambiente de produção nasça apenas com o primeiro administrador seguro e os filtros de "Ontem/Hoje" não virem o dia incorretamente às 21h.

---

## 2. Regras de negócio e requisitos técnicos

1. **`data-source.ts` compatível com `src/` (dev) e `dist/` (prod)**:
   - Em `apps/backend/src/database/data-source.ts`, substituir os globs fixos `'src/modules/...'` por caminhos relativos a `__dirname` (`path.join(__dirname, '../modules/**/infrastructure/persistence/entities/*.entity{.ts,.js}')` e equivalente para `migrations`).
   - Só invocar `dotenv.config(...)` quando `NODE_ENV !== 'production'` (ou quando `MIGRATION_DB_PASSWORD` / `POSTGRES_PASSWORD` não estiverem presentes em `process.env`).
   - Adicionar script `"migration:run:prod": "node ./node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js"` em `apps/backend/package.json`.
2. **Script Idempotente de Bootstrap de Produção (`db:bootstrap-prod`)**:
   - Criar `apps/backend/src/database/bootstrap-prod.ts` (compilado em `dist/database/bootstrap-prod.js`) que:
     - Garante a existência dos perfis RBAC canônicos (`ADMINISTRADOR`, `FARMACEUTICO_RESPONSAVEL`, `FARMACEUTICO_RESIDENTE`, `GERENTE`);
     - Cria (se ainda não existir) o município inicial e a primeira UBS a partir de variáveis opcionais (`BOOTSTRAP_MUNICIPIO_NOME`, `BOOTSTRAP_MUNICIPIO_UF`, `BOOTSTRAP_UBS_NOME`);
     - Cria (se ainda não existir) o primeiro usuário `ADMINISTRADOR` usando `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD` (hash bcrypt custo >= 12), marcando obrigatoriamente `deve_trocar_senha = true`;
     - **Nunca** insere pacientes fictícios, lotes fictícios ou senhas fracas de desenvolvimento (`seed-dev.ts` permanece restrito a dev/HML).
     - Pode ser executado múltiplas vezes sem duplicar registros nem sobrescrever senhas existentes (idempotência total).
3. **Padronização de Fuso Horário (`America/Sao_Paulo`)**:
   - Definir `TZ=America/Sao_Paulo` nos containers de runtime e validar/ajustar consultas de "Ontem/Hoje" (Dispensação e Recebimento) e cálculo de dias para vencimento para usar o dia civil brasileiro (`America/Sao_Paulo`), evitando divergência entre 21h00 e 23h59 BRT (00h00–02h59 UTC).

---

## 3. Escopo de arquivos impactados

- `apps/backend/src/database/data-source.ts`
- `apps/backend/src/database/bootstrap-prod.ts` (novo)
- `apps/backend/package.json` (`migration:run:prod`, `db:bootstrap-prod`)
- `apps/backend/tsconfig.build.json` (garantir inclusão de `data-source.ts` e `bootstrap-prod.ts` no build `dist/`)
- Consultas de data "ontem/hoje" em `dispensacao` e `recebimento` (auditoria e ajuste de fuso, se aplicável)

---

## 4. Cenários de teste em BDD (Gherkin — camada B)

```gherkin
# language: pt
Funcionalidade: Migrations de Runtime e Bootstrap Idempotente de Produção

  Cenário: Executar migrations a partir do artefato compilado em dist/
    Dado que o backend foi compilado com "pnpm build" gerando a pasta "dist/"
    Quando o comando "pnpm migration:run:prod" for executado contra um banco PostgreSQL limpo
    Então todas as migrations devem ser aplicadas com sucesso sem depender da pasta "src/" nem de "ts-node"

  Cenário: Bootstrap de produção cria administrador inicial com troca obrigatória de senha e é idempotente
    Dado que o banco de produção possui apenas as migrations aplicadas
    E as variáveis "BOOTSTRAP_ADMIN_EMAIL" e "BOOTSTRAP_ADMIN_PASSWORD" estão definidas
    Quando o script "db:bootstrap-prod" for executado duas vezes seguidas
    Então deve existir exatamente 1 usuário administrador com "deve_trocar_senha" igual a true
    E nenhum dado fictício de pacientes ou medicamentos deve ser inserido
```

---

## 5. Checklist de DoD e aceitação

- [ ] `pnpm --filter @farmaubs/backend build && pnpm --filter @farmaubs/backend migration:run:prod` validado contra PostgreSQL limpo.
- [ ] `db:bootstrap-prod` implementado, testado com execução dupla (idempotência) e sem dados fictícios.
- [ ] `TZ=America/Sao_Paulo` verificado nos filtros de data "Ontem/Hoje" e vencimento de lotes.
