# AC-12 Endpoints REST /api/v1/usuarios/* com DTOs e Swagger (ADR-007, RF025)

- **Épico**: Acesso e Autenticação do Sistema (RF001–RF004, NF009–NF012)
- **Requisitos Funcionais**: RF001 (Vínculo de UBSs), RF025 (Gestão de Usuários e RBAC), RF026 (Topologia de UBSs)
- **Requisitos Não-Funcionais**: NF009 (Menor Privilégio / RBAC), NF010 (Performance: resposta < 500ms), NF017 (LGPD e Segurança de Credenciais — nunca expor hash de senha)
- **ADRs Vinculadas**: ADR-002 (Escopos Globais e Multi-tenancy), ADR-003 (Arquitetura Hexagonal), ADR-006 (RBAC), ADR-007 (Endpoints REST, DTOs e Swagger), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes BDD), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de Usuário

> **Como** Administrador do FarmaUBS (visão global/sistêmica),  
> **quero** listar usuários de forma paginada com filtros combinados (município, perfil, status, busca textual) e consultar o detalhe completo de um usuário por ID com suas UBSs vinculadas,  
> **para que** eu possa localizar profissionais rapidamente em qualquer município do sistema, auditar seus papéis e verificar suas unidades de lotação com segurança e agilidade (RF025, NF009, NF010).

---

## 2. Regras de Negócio e Casos de Borda

1. **Autorização Exclusiva de Administrador (RF025, NF009)**:
   - Ambos os endpoints (`GET /api/v1/usuarios` e `GET /api/v1/usuarios/:id`) são de acesso restrito ao perfil `ADMINISTRADOR`.
   - Requisições sem token válido retornam `401 Unauthorized`. Requisições de usuários autenticados com outros perfis (`FARMACEUTICO_RESPONSAVEL`, `FARMACEUTICO_RESIDENTE`, `GERENTE`) retornam `403 Forbidden`.

2. **Escopo Global com Filtro Opcional por Município (ADR-002)**:
   - Como o Administrador possui escopo global, se o parâmetro `municipioId` for omitido na listagem, o sistema retorna usuários de **todos os municípios cadastrados**.
   - Se `municipioId` for fornecido, a listagem restringe-se estritamente aos usuários pertencentes àquele município.

3. **Filtros Combinados e Busca Textual**:
   - `termoBusca` (opcional): busca insensível a maiúsculas/minúsculas e acentos (`ilike %termo%`) aplicada concorrentemente sobre `users.nome_completo` e `users.email`.
   - `municipioId` (opcional, UUID): filtra pelo município de lotação.
   - `perfilCodigo` (opcional, Enum): filtra pelo código do perfil (`ADMINISTRADOR`, `FARMACEUTICO_RESPONSAVEL`, `FARMACEUTICO_RESIDENTE`, `GERENTE`).
   - `ativo` (opcional, booleano): se `true`, lista apenas ativos; se `false`, lista apenas inativos; se omitido, lista ambos.

4. **Paginação Canônica e Ordenação (NF010)**:
   - `pagina` (opcional, inteiro): índice da página atual (iniciando em 1, default `1`).
   - `limite` (opcional, inteiro): quantidade de registros por página (default `10`, máximo permitido `100`).
   - Ordenação padrão: `nome_completo ASC`.
   - O payload de retorno é envelopado no formato canônico paginado (`itens`, `totalItens`, `pagina`, `limite`, `totalPaginas`).

5. **Consulta Detalhada por ID (`GET /api/v1/usuarios/:id`)**:
   - Retorna os dados completos do usuário, incluindo:
     - Dados cadastrais (`id`, `nomeCompleto`, `email`, `ativo`, `deveTrocarSenha`).
     - Município (`municipioId`, `municipioNome`, `uf`).
     - Perfil (`perfilId`, `perfilCodigo`, `perfilNome`).
     - Lista de UBSs associadas (`ubsList`: array de `{ id, cnes, nome, ativo }`).
     - Metadados de auditoria e acesso (`ultimoLoginEm`, `criadoEm`, `atualizadoEm`).
   - Se o ID informado não existir no banco, retorna `404 Not Found` com mensagem descritiva (`UsuarioNaoEncontradoException`).
   - Se o ID não for um UUID válido, retorna `400 Bad Request`.

6. **Segurança de Credenciais e LGPD (NF017)**:
   - **Proibição Absoluta**: O campo `password_hash`, tokens de sessão ou contadores de tentativa de login falhas jamais devem ser expostos em nenhum DTO de resposta (seja na listagem resumida ou no detalhe por ID).

---

## 3. Contratos de API e Compartilhamento (`@farmaubs/shared` e App Mobile)

Conforme a [ADR-034](file:///c:/Users/jaohe/projetos/farmaubs/docs/adrs/adr-034-clean-architecture-fullstack.md), todos os contratos de tipos, interfaces de paginação e validações de filtros são centralizados no pacote compartilhado, permitindo consumo idêntico tanto pelo `apps/frontend` quanto pelo aplicativo `apps/mobile` (`AC-MOB-01`, `AC-MOB-03`).

### 3.1 Endpoints REST (`apps/backend/src/modules/acesso/infrastructure/controllers/user.controller.ts`)

| Método | Rota | Descrição | Query Params / Path |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/usuarios` | Listagem paginada de usuários com filtros | `pagina`, `limite`, `termoBusca`, `municipioId`, `perfilCodigo`, `ativo` |
| `GET` | `/api/v1/usuarios/:id` | Detalhe completo de um usuário | `id` (UUID no path) |

### 3.2 Tipos e DTOs no `@farmaubs/shared`

Local: [`packages/shared/src/administracao/usuario.types.ts`](file:///c:/Users/jaohe/projetos/farmaubs/packages/shared/src/administracao/usuario.types.ts)

```typescript
import type { PerfilCodigo } from "../acesso/perfil.types";

// 1. Filtros e Paginação de Entrada
export interface ListarUsuariosQuery {
  pagina?: number;
  limite?: number;
  termoBusca?: string;
  municipioId?: string;
  perfilCodigo?: PerfilCodigo;
  ativo?: boolean;
}

// 2. Resumo para Linha da Listagem Paginada
export interface UsuarioItemListaDto {
  id: string;
  nomeCompleto: string;
  email: string;
  perfilCodigo: PerfilCodigo;
  perfilNome: string;
  municipioId: string;
  municipioNome: string;
  ativo: boolean;
  deveTrocarSenha: boolean;
  totalUbsAssociadas: number;
  criadoEm: Date | string;
}

// 3. Envelope Paginado
export interface UsuariosPaginadosResultado {
  itens: UsuarioItemListaDto[];
  totalItens: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
}

// 4. Detalhe Completo do Usuário por ID
export interface UsuarioDetalheUbsDto {
  id: string;
  cnes: string;
  nome: string;
  ativo: boolean;
}

export interface UsuarioDetalheDto {
  id: string;
  nomeCompleto: string;
  email: string;
  ativo: boolean;
  deveTrocarSenha: boolean;
  municipio: {
    id: string;
    nome: string;
    uf: string;
  };
  perfil: {
    id: string;
    codigo: PerfilCodigo;
    nome: string;
  };
  unidadesSaude: UsuarioDetalheUbsDto[];
  ultimoLoginEm?: Date | string | null;
  criadoEm: Date | string;
  atualizadoEm: Date | string;
}
```

---

## 4. Arquitetura no Backend (`apps/backend/`) — Clean Architecture

Conforme a [ADR-034](file:///c:/Users/jaohe/projetos/farmaubs/docs/adrs/adr-034-clean-architecture-fullstack.md) e [CONTRIBUTING.md](file:///c:/Users/jaohe/projetos/farmaubs/CONTRIBUTING.md), o módulo de acesso organiza-se estritamente nas camadas desacopladas:

```text
apps/backend/src/modules/acesso/
├── domain/
│   ├── entities/
│   │   └── user.entity.ts                # Entidade de domínio pura
│   ├── errors/
│   │   └── user-not-found.error.ts       # UsuarioNaoEncontradoException (404)
│   └── ports/
│       └── user-query.repository.port.ts # Interface da porta (IUserQueryRepository)
├── application/
│   └── use-cases/
│       ├── list-users.use-case.ts        # Caso de uso: orquestração de filtros dinâmicos e paginação
│       └── get-user-by-id.use-case.ts    # Caso de uso: busca detalhada com joins otimizados
└── infrastructure/
    ├── controllers/
    │   └── user.controller.ts            # Adaptador de entrada REST com OpenAPI/Swagger e Guards
    ├── dto/
    │   ├── list-users-query.dto.ts       # DTO de entrada com class-validator e sanitização
    │   └── user-detail-response.dto.ts   # Documentação OpenAPI/Swagger dos dados de detalhe
    └── adapters/
        └── typeorm-user-query.repository.ts # Adaptador concreto de persistência com QueryBuilder indexado
```

---

## 5. Critérios de Aceite Detalhados

- [ ] **Proteção RBAC dos Endpoints**:
  - `GET /api/v1/usuarios` e `GET /api/v1/usuarios/:id` exigem sessão ativa com perfil `ADMINISTRADOR`.
  - Tentativa sem token retorna `401 Unauthorized`.
  - Tentativa com perfil não-administrador retorna `403 Forbidden`.
- [ ] **Listagem Paginada sem Filtros (Visão Global)**:
  - Quando nenhum filtro é passado, lista usuários de todos os municípios ordenados por `nome_completo ASC`.
  - Respeita `pagina = 1` e `limite = 10` como padrão.
  - Retorna `totalItens` e `totalPaginas` calculados corretamente.
- [ ] **Filtro Combinado de Busca Textual**:
  - `termoBusca` localiza tanto por partes do nome quanto do e-mail de forma insensível a maiúsculas/minúsculas.
- [ ] **Filtro por Município e Perfil**:
  - Filtrar por `municipioId` isola os usuários daquela comarca.
  - Filtrar por `perfilCodigo` traz apenas usuários com aquele papel no sistema.
- [ ] **Filtro por Status**:
  - `ativo=true` traz apenas contas ativas; `ativo=false` traz apenas inativadas.
- [ ] **Consulta por ID Válido**:
  - Retorna todos os dados de `UsuarioDetalheDto`, incluindo os dados do município, perfil e todas as UBSs associadas em `unidadesSaude`.
- [ ] **Consulta por ID Inexistente ou Inválido**:
  - Se o UUID não existir na tabela `users`, retorna `404 Not Found`.
  - Se o parâmetro `:id` não for um UUID válido, retorna `400 Bad Request`.
- [ ] **Segurança de Dados**:
  - Nenhuma das respostas inclui `password_hash`, tokens ou segredos internos.
- [ ] **Documentação Swagger**:
  - Os endpoints `GET /api/v1/usuarios` e `GET /api/v1/usuarios/{id}` estão documentados no Swagger com exemplos de schemas para `200`, `400`, `401`, `403` e `404`.

---

## 6. Cenários de Teste em BDD (Gherkin — ADR-030)

### Camada A — Teste Unitário de Casos de Uso (`list-users.steps.ts` e `get-user-by-id.steps.ts`)

```gherkin
# language: pt
Funcionalidade: Consulta e Listagem de Usuários (Camada A)
  Cenário: Listagem paginada padrão com contagem correta
    Dado que existem 25 usuários cadastrados no repositório
    Quando o caso de uso ListUsersUseCase for executado com página 1 e limite 10
    Então o resultado deve conter 10 itens
    E o total de itens deve ser 25
    E o total de páginas deve ser 3

  Cenário: Filtro combinado de busca textual e município
    Dado que existem usuários em "Santos" e em "São Paulo"
    E o usuário "Carlos Eduardo" pertence a "Santos" com e-mail "carlos@santos.gov.br"
    Quando o Administrador buscar pelo termo "carlos" filtrando pelo ID de "Santos"
    Então apenas o usuário "Carlos Eduardo" de Santos deve ser retornado

  Cenário: Detalhe de usuário existente com suas UBSs
    Dado que o usuário "Ana Farmacêutica" possui vínculo com 2 UBSs ativas
    Quando o caso de uso GetUserByIdUseCase for executado com o ID de Ana
    Então deve retornar os dados cadastrais completos
    E o perfil "FARMACEUTICO_RESPONSAVEL"
    E a lista contendo as 2 UBSs vinculadas
    E o campo password_hash não deve estar presente no resultado

  Cenário: Detalhe de usuário com ID inexistente
    Dado que o ID "uuid-inexistente" não pertence a nenhum usuário
    Quando o caso de uso GetUserByIdUseCase for executado com esse ID
    Então deve lançar a exceção "UsuarioNaoEncontradoException"
```

### Camada B — Integração com Banco PostgreSQL Real (`user-query.integration.ts`)

```gherkin
  Cenário: Performance e integridade dos joins na consulta detalhada
    Dado um usuário cadastrado no banco associado a 3 UBSs através da tabela user_units
    Quando o repositório TypeORM executar buscarPorIdComRelacoes
    Então deve retornar a entidade completa sem queries n+1
    E todas as 3 UBSs devem vir preenchidas com seus respectivos CNES e nomes
```

### Camada C — Teste de Endpoints e Controle de Acesso HTTP (`user.controller.spec.ts`)

```gherkin
  Cenário: Usuário sem perfil de Administrador tenta listar usuários
    Dado que uma requisição GET é enviada para "/api/v1/usuarios"
    E o token JWT pertence ao perfil "FARMACEUTICO_RESIDENTE"
    Então o status de resposta HTTP deve ser 403 Forbidden

  Cenário: Consulta por ID não UUID retorna Bad Request
    Dado que o Administrador envia GET para "/api/v1/usuarios/id-invalido-123"
    Então o status de resposta HTTP deve ser 400 Bad Request
```

---

## 7. Definition of Done (DoD)

1. **Backend**:
   - Casos de uso `ListUsersUseCase` e `GetUserByIdUseCase` implementados com injeção de dependência limpa.
   - Endpoints `GET /` e `GET /:id` adicionados ao `UserController` com decoradores do `@nestjs/swagger` e `@UseGuards(JwtAuthGuard, RolesGuard)`.
   - Consulta TypeORM com paginação eficiente (`skip`/`take`) e joins indexados sem queries N+1.
2. **Segurança**:
   - `password_hash` omitido do select ou explicitamente sanitizado.
   - RolesGuard validado e impedindo acesso de outros perfis.
3. **Qualidade e Testes**:
   - Cenários BDD da Camada A (`*.steps.ts`) e Camada C (`*.spec.ts`) implementados e passando com 100% de sucesso.
   - DTOs integrados em `packages/shared/src/administracao/usuario.types.ts`.
   - `moon run backend:test` e `moon run backend:lint` executados com sucesso.
   - `moon run :build` executado e aprovado em todo o monorepo sem advertências de tipagem.