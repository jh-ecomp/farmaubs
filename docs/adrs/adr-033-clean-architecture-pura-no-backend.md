## ADR-033 - Evolução para Clean Architecture Pura no Backend e Desacoplamento de Framework

### Status
🟢 Decidido e documentado — 03/10/2026

### Contexto

O ADR-003 estabeleceu a Arquitetura Hexagonal (Ports & Adapters) para os módulos internos do backend, e o ADR-005 definiu o NestJS como framework do backend. Com a evolução do projeto e a expansão do monorepo (ADR-022) para contemplar múltiplos clientes (Web no ADR-011 e Mobile no ADR-034), surgiu a questão de onde devem residir os Casos de Uso e o quão puros eles devem ser.

Na implementação inicial, embora as entidades e interfaces de repositório estivessem no domínio, os Casos de Uso (`application/use-cases/`) continham decorators de injeção de dependência específicos do NestJS, tais como `@Injectable()` e `@Inject('TOKEN')`.

Foram avaliadas duas abordagens para refinamento da Clean Architecture:
1. **Mover Use Cases para `packages/shared`**:
   - Hipótese: Uma vez que use cases representam a lógica de negócio orquestrada, poderiam ser compartilhados com o frontend e mobile.
   - Inviabilidade: Clientes Web e Mobile nunca executam os Casos de Uso diretamente contra bancos de dados ou serviços de mensageria; executam chamadas HTTP via API REST (ADR-007). Mover use cases de servidor para o `shared` poluiria o bundle cliente com contratos de repositórios, bibliotecas de hash (bcrypt) e rotinas internas de servidor, além de violar o princípio de privilégio mínimo ao expor orquestrações de backend.
2. **Casos de Uso Puros e Agnósticos no Backend (Clean Architecture Pura à la `royib/clean-architecture-nestJS`)**:
   - Manter os Casos de Uso na camada de aplicação do backend (`apps/backend/src/modules/*/application/use-cases`), porém eliminando qualquer dependência ou decorator do NestJS de dentro de suas classes.
   - O NestJS passa a ser tratado puramente como **adaptador de infraestrutura**, provendo os use cases aos controllers através de *Custom Providers* (`useFactory`).

### Decisão

Adotar o desacoplamento formal de framework na camada de aplicação do backend, alinhando com a Clean Architecture clássica:

1. **Casos de Uso 100% Puros em TypeScript**:
   - Classes de Caso de Uso não utilizam `@Injectable()` nem `@Inject()` do NestJS.
   - O construtor recebe interfaces de portas puras (`IUserRepository`, `IPasswordHasher`, etc.) injetadas de forma pura via TypeScript.
   - Nenhum decorator de framework é permitido dentro de `domain/` ou `application/use-cases/`.
2. **NestJS como Adaptador de Inversão de Controle**:
   - A amarração (binding) de dependências é feita nos módulos do NestJS (`*.module.ts`) usando `{ provide: MeuUseCase, useFactory: (repo) => new MeuUseCase(repo), inject: ['IRepository'] }`.
3. **Escopo do `packages/shared`**:
   - Permanece restrito a:
     - DTOs e Contratos de requisição/resposta da API.
     - Schemas de validação agnósticos (Zod).
     - Enums e Constantes de domínio.
     - Regras matemáticas e utilitários puros de domínio (ex: cálculo de consumo médio, validação de dígitos verificadores de CNS/CPF).
   - Casos de uso de orquestração de banco e serviços de infraestrutura residem exclusivamente no backend.

### Consequências

**Positivas:**
- Testabilidade unitária máxima dos Casos de Uso sem necessidade de instanciar o `Test.createTestingModule` do NestJS (testes instantâneos instanciando a classe diretamente com mocks simples).
- Total portabilidade: o núcleo de aplicação pode rodar em qualquer runner, lambda serverless, script CLI ou outro framework sem alteração de código.
- Limite claro de responsabilidades: o framework atua apenas na borda externa (HTTP, roteamento, Swagger e serialização).

**Negativas / Trade-offs:**
- Exige configuração explícita de `useFactory` nos módulos do NestJS em vez do auto-wiring mágico com decorators.
- Leve aumento no código de infraestrutura dos módulos do NestJS.

### Decisões relacionadas
- [[ADR-003|adr-003-arquitetura-interna-do-backend-hexagonal-ports-adapters.md]] - Arquitetura interna do backend
- [[ADR-005|adr-005-linguagem-e-framework-do-backend.md]] - Linguagem e framework do backend
- [[ADR-022|adr-022-organizacao-de-repositorios.md]] - Organização de repositórios (Monorepo)
- [[ADR-034|adr-034-workspace-mobile-react-native-expo.md]] - Workspace Mobile com React Native (Expo)
