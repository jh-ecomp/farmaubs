# Playbook de desenvolvimento: como criar uma funcionalidade do zero (FarmaUBS)

Este guia prático descreve o passo a passo sequencial para implementar uma nova funcionalidade no FarmaUBS, respeitando a Clean Architecture pura, o pacote compartilhado e a pirâmide de testes BDD.

---

## 1. Visão geral da jornada de implementação

```text
[1. Contratos no Shared] ──> [2. Domínio e Use Case] ──> [3. Persistência e Portas]
                                                                  │
[6. Interface Web/Mobile] <── [5. Controller e Swagger] <─────────┘
            │
[7. Cenários BDD Gherkin] ──> [8. Checklist Pré-Push]
```

---

## 2. Passo a passo sequencial

### Passo 1: Definir os contratos em `@farmaubs/shared`

Toda funcionalidade que trafega dados entre clientes e servidor começa no pacote compartilhado:

1. Crie ou edite o arquivo em `packages/shared/src/<modulo>/<recurso>.types.ts`.
2. Declare os tipos de entrada (`RequestDto` ou `Comando`), saída (`ResponseDto` ou `Resultado`) e enums.
3. Exporte o arquivo no `index.ts` do módulo e no `packages/shared/src/index.ts`.
4. Compile para gerar os tipos em `dist/`:
   ```bash
   moon run shared:build
   ```

### Passo 2: Implementar o caso de uso puro (`application/use-cases/`)

A regra de negócio vive desacoplada de frameworks:

1. Crie o arquivo `apps/backend/src/modules/<modulo>/application/use-cases/<acao>.use-case.ts`.
2. Escreva uma classe TypeScript pura recebendo as portas (interfaces) no construtor.
3. Não utilize decorators do NestJS (`@Injectable()`) nem do TypeORM.
4. Escreva o teste unitário isolado em `<acao>.use-case.spec.ts` com mocks simples em Jest.
5. Valide a execução unitária:
   ```bash
   moon run backend:test
   ```

### Passo 3: Criar portas e adaptadores de banco (`domain/ports/` e `infrastructure/`)

1. **Porta (Interface):** Crie a interface em `apps/backend/src/modules/<modulo>/domain/ports/<recurso>.repository.port.ts`.
2. **Entidade TypeORM:** Crie o mapeamento físico em `infrastructure/persistence/entities/<tabela>.entity.ts`.
3. **Migração SQL:** Crie a migração TypeORM em `infrastructure/persistence/migrations/`.
4. **Repositório Concreto:** Implemente a porta em `infrastructure/adapters/<recurso>-typeorm.repository.ts`.
5. **Teste de Schema:** Valide a migração no banco de teste efêmero:
   ```bash
   moon run backend:test-schema
   moon run backend:test-schema-down
   ```

### Passo 4: Expor os endpoints REST (`api/controllers/`)

1. Crie ou atualize o controller em `apps/backend/src/modules/<modulo>/api/controllers/<nome>.controller.ts`.
2. Utilize decorators do NestJS (`@Controller`, `@Get`, `@Post`, `@UseGuards`).
3. Adicione documentação OpenAPI/Swagger (`@ApiTags`, `@ApiOperation`, `@ApiResponse`).
4. Amarre as dependências no `<modulo>.module.ts` via `useFactory`:
   ```typescript
   {
     provide: ExecutarOperacaoUseCase,
     useFactory: (repo: MeuRepositorioPort) => new ExecutarOperacaoUseCase(repo),
     inject: [MEU_REPOSITORIO_TOKEN],
   }
   ```

### Passo 5: Escrever a especificação viva BDD (Cucumber.js + Chai)

1. **Arquivo de cenários (.feature):** Crie `apps/backend/test/features/<modulo>.feature` com cenários em português (`# language: pt`, `Funcionalidade`, `Cenário`, `Dado`, `Quando`, `Então`).
2. **Definição de passos (.steps.ts):** Implemente os passos em `apps/backend/test/features/step_definitions/<modulo>.steps.ts` utilizando asserções com `chai`.
3. Execute os testes BDD com o Moonrepo:
   ```bash
   moon run backend:test-bdd
   ```

### Passo 6: Conectar a camada de apresentação (Web ou Mobile)

Respeitando o isolamento de escopo (faça em branch dedicada ou tarefa específica de frontend):

1. Importe os tipos e contratos exclusivamente de `@farmaubs/shared`.
2. Crie a função de chamada à API em `apps/frontend/src/services/` com Axios/Fetch.
3. Crie hooks com TanStack Query em `apps/frontend/src/hooks/` para queries e mutations.
4. Monte a tela em `apps/frontend/src/pages/<NomeDaPagina>/`.
5. Valide a interface no container Docker em `http://localhost:5173`.

### Passo 7: Checklist final e atualização de progresso

1. Execute todos os testes afetados:
   ```bash
   moon run :test --affected
   moon run :build
   ```
2. Abra a história de usuário atribuída em `docs/historias-usuario/...` e marque os critérios de aceite concluídos (`[x]`).
3. Atualize o `PROGRESSO.md` do épico e o `docs/historias-usuario/MAPA_HISTORIAS.md` para `✅ Concluída`.
