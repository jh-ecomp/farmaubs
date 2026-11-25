# RL-02 feat(database): Migrations de Runtime em `dist/`, Bootstrap de Produção, Seed Sintético de QA e Fuso Horário Padrão

---

- **Épico**: Release 1 — Prontidão para Produção, CI/CD e Infraestrutura
- **Requisitos Não-Funcionais**: NF003 (Português/Brasil e datas locais), NF004 (Deploy seguro), NF015 (Multi-tenancy inicial), ADR-025 (Separação entre dados sintéticos e produção)
- **ADRs Vinculadas**: ADR-015 (PostgreSQL), ADR-016 (RLS e roles `farmaubs_admin`/`farmaubs_app`), ADR-023 (Containerização), ADR-025 (Ambientes)

---

## 1. História de usuário

> **Como** desenvolvedor responsável pelo deploy do FarmaUBS,  
> **quero** executar as migrations TypeORM diretamente a partir do código compilado (`dist/`) via `node` puro no container de produção, dispor de um script compilado e idempotente de bootstrap de produção (sem massa fictícia) e de um script compilado de seed sintético exclusivo para QA/HML (`seed-qa.js`), além de garantir fuso horário consistente (`America/Sao_Paulo`),  
> **para que** o pipeline de CD aplique migrations e inicialize tanto `farmaubs-hml` quanto `farmaubs-prod` sem depender de `ts-node`, `pnpm` ou `src/` no container de runtime, e os filtros de "Ontem/Hoje" não virem o dia incorretamente às 21h.

---

## 2. Regras de negócio e requisitos técnicos

1. **`data-source.ts` compatível com `src/` (dev) e `dist/` (prod)**:
   - Em `apps/backend/src/database/data-source.ts`, substituir os globs fixos `'src/modules/...'` por caminhos relativos a `__dirname` (`path.join(__dirname, '../modules/**/infrastructure/persistence/entities/*.entity{.ts,.js}')` e equivalente para `migrations`).
   - Só invocar `dotenv.config(...)` quando `NODE_ENV !== 'production'` (ou quando `MIGRATION_DB_PASSWORD` / `POSTGRES_PASSWORD` não estiverem presentes em `process.env`).
   - Adicionar script `"migration:run:prod": "node ./node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js"` em `apps/backend/package.json` — e permitir invocação direta com `node ./node_modules/typeorm/cli.js ...` no container (evitando depender do Corepack/`pnpm` em runtime).
2. **Script Idempotente de Bootstrap de Produção (`dist/database/bootstrap-prod.js`)**:
   - Criar `apps/backend/src/database/bootstrap-prod.ts` (compilado em `dist/database/bootstrap-prod.js`, executável via `node dist/database/bootstrap-prod.js`) que:
     - Garante a existência dos perfis RBAC canônicos (`ADMINISTRADOR`, `FARMACEUTICO_RESPONSAVEL`, `FARMACEUTICO_RESIDENTE`, `GERENTE`);
     - Cria (se ainda não existir) o município inicial e a primeira UBS a partir de variáveis (`BOOTSTRAP_MUNICIPIO_NOME`, `BOOTSTRAP_MUNICIPIO_UF`, `BOOTSTRAP_MUNICIPIO_IBGE`, `BOOTSTRAP_UBS_NOME`);
     - Cria (se ainda não existir) o primeiro usuário `ADMINISTRADOR` usando `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD` (hash bcrypt custo >= 12), marcando obrigatoriamente `deve_trocar_senha = true` e vinculando-o à UBS inicial em `user_units`;
     - **Nunca** insere pacientes fictícios, lotes fictícios ou senhas fracas de desenvolvimento;
     - Pode ser executado múltiplas vezes sem duplicar registros nem sobrescrever senhas existentes (idempotência total).
3. **Script Compilado de Seed Sintético para Homologação/QA (`dist/database/seed-qa.js`)**:
   - Como `seed-dev.ts` bloqueia execução fora de `NODE_ENV=development` e depende de `ts-node`, criar `apps/backend/src/database/seed-qa.ts` (compilado em `dist/database/seed-qa.js`, executável via `node dist/database/seed-qa.js`):
     - **Trava rígida de segurança (`ADR-025`):** exige explicitamente `ALLOW_QA_SEED=true` e `APP_ENV=hml` (abortando imediatamente caso `APP_ENV=production`);
     - Popula de forma idempotente dados sintéticos realistas (catálogo RENAME/REMUME, fabricantes, lotes com validade normal e curta para FEFO, e conta sintética dedicada configurada via `QA_SMOKE_EMAIL` e `QA_SMOKE_PASSWORD` com `deve_trocar_senha = false` para viabilizar os testes automatizados de Smoke, Carga e Estresse do `RL-08`).
4. **Padronização de Fuso Horário (`America/Sao_Paulo`)**:
   - Definir `TZ=America/Sao_Paulo` nos containers de runtime e validar/ajustar consultas de "Ontem/Hoje" (Dispensação e Recebimento) e cálculo de dias para vencimento para usar o dia civil brasileiro (`America/Sao_Paulo`), evitando divergência entre 21h00 e 23h59 BRT (00h00–02h59 UTC).

---

## 3. Escopo de arquivos impactados

- `apps/backend/src/database/data-source.ts`
- `apps/backend/src/database/bootstrap-prod.ts` (novo)
- `apps/backend/src/database/seed-qa.ts` (novo)
- `apps/backend/package.json` (`migration:run:prod`, `db:bootstrap-prod`, `db:seed-qa`)
- `apps/backend/tsconfig.build.json` (garantir inclusão de `data-source.ts`, `bootstrap-prod.ts` e `seed-qa.ts` no build `dist/`)
- Consultas de data "ontem/hoje" em `dispensacao` e `recebimento` (auditoria e ajuste de fuso, se aplicável)

---

## 4. Cenários de teste em BDD (Gherkin — camada B)

```gherkin
# language: pt
Funcionalidade: Migrations de Runtime, Bootstrap de Produção e Seed Sintético de QA

  Cenário: Executar migrations a partir do artefato compilado em dist/
    Dado que o backend foi compilado gerando a pasta "dist/"
    Quando o comando "node ./node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js" for executado contra um banco PostgreSQL limpo
    Então todas as migrations devem ser aplicadas com sucesso sem depender da pasta "src/" nem de "ts-node"

  Cenário: Bootstrap de produção cria administrador inicial com troca obrigatória de senha e é idempotente
    Dado que o banco de produção possui apenas as migrations aplicadas
    E as variáveis "BOOTSTRAP_ADMIN_EMAIL" e "BOOTSTRAP_ADMIN_PASSWORD" estão definidas
    Quando o script "node dist/database/bootstrap-prod.js" for executado duas vezes seguidas
    Então deve existir exatamente 1 usuário administrador com "deve_trocar_senha" igual a true
    E nenhum dado fictício de pacientes ou medicamentos deve ser inserido

  Cenário: Seed sintético de QA recusa execução quando APP_ENV for production
    Dado que "APP_ENV" está definido como "production"
    Quando o script "node dist/database/seed-qa.js" for invocado mesmo com "ALLOW_QA_SEED=true"
    Então o processo deve abortar imediatamente com erro sem alterar o banco de dados
```

---

## 5. Checklist de DoD e aceitação

- [ ] `node ./node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js` validado contra PostgreSQL limpo apenas com `dist/`.
- [ ] `bootstrap-prod.js` implementado, testado com execução dupla (idempotência) e sem dados fictícios.
- [ ] `seed-qa.js` implementado, bloqueado contra `APP_ENV=production` e populando massa sintética + conta `QA_SMOKE_EMAIL` em HML.
- [ ] `TZ=America/Sao_Paulo` verificado nos filtros de data "Ontem/Hoje" e vencimento de lotes.
