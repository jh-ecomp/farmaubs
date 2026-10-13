# AC-26 feat(acesso): Listagem paginada de usuários com filtros e escopo global (Backend)

- **Épico**: Acesso e Autenticação do Sistema (RF001–RF004, NF009–NF012)
- **Requisitos Funcionais**: RF001 (Gerenciamento de Usuários), RF025 (Controle de Acesso RBAC), RF026 (Topologia de UBS)
- **Requisitos Não-Funcionais**: NF003 (Idioma pt-BR), NF008 (Auditoria), NF009 (Menor Privilégio), NF012 (Sessão Segura), NF015 (Performance de Consulta / Paginação)
- **ADRs Vinculadas**: ADR-002 (Multi-tenancy e Escopos Globais), ADR-006 (RBAC), ADR-022 (`@farmaubs/shared`), ADR-029 (Arquitetura Hexagonal no NestJS), ADR-030 (Pirâmide de Testes - Camadas A e C)

---

## 1. História de Usuário

> **Como** Administrador do FarmaUBS (visão global),  
> **quero** consultar a listagem de usuários do sistema de forma paginada e filtrável por município, status, perfil e termo de busca (nome/e-mail) via endpoint `GET /api/v1/usuarios`,  
> **para que** o painel administrativo frontend possa exibir, paginar e localizar os profissionais de saúde cadastrados em qualquer município com alta performance e integridade de dados.

---

## 2. Regras de Negócio e Casos de Borda

1. **Controle de Acesso RBAC e Menor Privilégio (ADR-006, RF025, NF009)**:
   - O endpoint exige autenticação com token Bearer válido (`NF012`).
   - O acesso é restrito **exclusivamente** ao perfil `ADMINISTRADOR`.
   - Requisições sem token retornam `401 Unauthorized`.
   - Requisições feitas por usuários com outros perfis (`FARMACEUTICO_RESPONSAVEL`, `FARMACEUTICO_RESIDENTE`, `GERENTE`) são rejeitadas com `403 Forbidden`.

2. **Escopo Global do Administrador (ADR-002)**:
   - A listagem não é restrita ao município do token do administrador (`skipTenantFilter` ou visão sistêmica global).
   - O administrador pode consultar usuários de todos os municípios simultaneamente ou restringir através do query param `municipioId`.

3. **Paginação e Limites de Consulta (NF015)**:
   - Parâmetros aceitos na query string: `page` (padrão: `1`) e `limit` (padrão: `10`, máximo permitido: `100`).
   - Se `page < 1`, assume `1`. Se `limit > 100`, trunca para `100`.
   - O retorno deve calcular com precisão: `total`, `page`, `limit` e `totalPages = Math.ceil(total / limit)`.

4. **Filtros Combinados**:
   - `busca`: Busca textual aplicada em `nome_completo` OU `email` (case-insensitive e busca parcial / `ILIKE %termo%`).
   - `municipioId`: Filtro exato pelo UUID do município.
   - `perfilId`: Filtro pelo UUID ou código do perfil RBAC.
   - `status`: Filtro booleano correspondente (`ATIVO` -> `ativo = true`, `INATIVO` -> `ativo = false`, vazio/`ALL` -> todos).

5. **Dados Agregados e Unidades Vinculadas (Topologia RF026)**:
   - Cada item da lista deve conter: dados cadastrais (`id`, `nomeCompleto`, `email`, `ativo`, `createdAt`, `ultimoLoginEm`), os dados do município (`municipioId`, `municipioNome`), do perfil (`perfilCodigo`, `perfilNome`) e o array de unidades de saúde vinculadas (`unidades: Array<{ id, nome, cnes }>`) obtidas a partir de `user_units` / `unidades_saude`.
   - A senha (`senha_hash`) **nunca deve ser exposta** no DTO de resposta.

6. **Ordenação Padrão**:
   - Registros ordenados decrescentemente por data de criação (`u.created_at DESC`), garantindo determinismo na paginação.

---

## 3. Contratos de Dados e Tipagens (`@farmaubs/shared`)

### 3.1 Rota
- **Método**: `GET`
- **Caminho**: `/api/v1/usuarios`
- **Headers**: `Authorization: Bearer <token>`

### 3.2 Query Parameters (`ListagemUsuariosFiltros`)
```typescript
export interface ListagemUsuariosFiltros {
  page?: number;        // Default: 1
  limit?: number;       // Default: 10, Max: 100
  busca?: string;       // Busca parcial por nome ou email (case-insensitive)
  perfilId?: string;    // UUID ou código do perfil
  municipioId?: string; // UUID do município
  status?: string;      // 'ATIVO' | 'INATIVO' | 'ALL'
}
```

### 3.3 Response Body (`ListagemUsuariosResultado`)
```typescript
export interface ListagemUsuariosResultado {
  data: UsuarioItemTabela[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UsuarioItemTabela {
  id: string;
  municipioId: string;
  municipioNome: string;
  nomeCompleto: string;
  email: string;
  perfilCodigo: PerfilCodigo | string;
  perfilNome: string;
  unidades: Array<{
    id: string;
    nome: string;
    cnes?: string;
  }>;
  ativo: boolean;
  ultimoLoginEm?: Date | string | null;
  createdAt: Date | string;
}
```

---

## 4. Arquitetura no Backend (`apps/backend/`)

Conforme a Arquitetura Hexagonal adotada (ADR-029):

```text
apps/backend/src/modules/acesso/
├── api/
│   ├── controllers/
│   │   └── user.controller.ts             # Adiciona método @Get() com Swagger e @Roles('ADMINISTRADOR')
│   └── dto/
│       └── list-users-query.dto.ts        # DTO de validação com class-validator (@IsOptional, @Type, @Min, @Max)
├── application/
│   └── use-cases/
│       ├── list-users.use-case.ts         # Caso de uso com regras de negócio e paginação
│       └── list-users.steps.ts            # Testes BDD unitários (Camada A)
├── domain/
│   └── ports/
│       └── user.repository.port.ts        # Adiciona método listar(filtros): Promise<ListagemUsuariosResultado>
└── infrastructure/
    └── adapters/
        ├── typeorm-user.repository.ts     # QueryBuilder com joins (municipios, perfis, user_units, unidades_saude)
        └── typeorm-user.repository.steps.ts # Testes de integração (Camada B)
```

---

## 5. Critérios de Aceite Detalhados

- [x] **RBAC Estrito (RF025 / NF009)**: Endpoint protegido por guarda de autenticação e RBAC. Retorna `401` sem token e `403` para perfis diferentes de `ADMINISTRADOR`.
- [x] **Paginação Padrão**: Se `page` e `limit` forem omitidos, assume `page = 1` e `limit = 10`. Retorna `total`, `totalPages`, `page` e `limit` consistentes.
- [x] **Filtro por Município**: Quando `municipioId` é fornecido, a query restringe apenas aos usuários daquele município.
- [x] **Filtro por Status**: `status=ATIVO` retorna apenas usuários com `ativo = true`. `status=INATIVO` retorna apenas `ativo = false`.
- [x] **Filtro por Perfil**: `perfilId` filtra os usuários pelo perfil correspondente.
- [x] **Busca Textual**: `busca` filtra parcialmente por nome completo ou e-mail sem distinção entre maiúsculas e minúsculas.
- [x] **Composição de Unidades (RF026)**: As UBSs vinculadas a cada usuário em `user_units` são agregadas na propriedade `unidades` com `id`, `nome` e `cnes`.
- [x] **Segurança de Dados**: O campo `senha_hash` não é selecionado nem retornado na resposta em nenhuma hipótese.
- [x] **Documentação OpenAPI / Swagger**: Rota documentada em `/api/v1/docs` com query params e schemas de resposta `200`, `401`, `403`.

---

## 6. Cenários de Teste em BDD (Gherkin — Camadas A e C)

### Cenário 1: Listagem padrão paginada para Administrador
```gherkin
# language: pt
Funcionalidade: Listagem Paginada de Usuários (RF001 / RF025)

  Cenário: Administrador solicita primeira página de usuários sem filtros adicionais
    Dado que existem 25 usuários cadastrados no banco de dados
    E o usuário requisitante é um "ADMINISTRADOR" autenticado
    Quando enviar uma requisição GET para "/api/v1/usuarios"
    Então o status da resposta deve ser 200 OK
    E o corpo da resposta deve conter:
      | total      | 25 |
      | page       | 1  |
      | limit      | 10 |
      | totalPages | 3  |
    E a lista "data" deve conter 10 usuários ordenados por data de criação decrescente
    E nenhum usuário deve conter o campo "senha_hash"
```

### Cenário 2: Filtro combinado por município e status
```gherkin
  Cenário: Filtragem por município e status ativo
    Dado que existem usuários ativos e inativos em "Parnaíba" e "Teresina"
    Quando o Administrador enviar GET para "/api/v1/usuarios?municipioId=<ID_PARNAIBA>&status=ATIVO"
    Então a lista retornada deve conter apenas usuários com "municipioId" igual a "<ID_PARNAIBA>"
    E todos os usuários retornados devem ter "ativo" igual a true
```

### Cenário 3: Busca textual por nome ou e-mail
```gherkin
  Cenário: Busca parcial case-insensitive por nome
    Dado que existe o usuário "Dra. Mariana Vasconcelos" com e-mail "mariana.vasconcelos@farmaubs.gov.br"
    Quando o Administrador enviar GET para "/api/v1/usuarios?busca=mariana"
    Então o usuário "Dra. Mariana Vasconcelos" deve estar presente na lista "data"
```

### Cenário 4: Rejeição de acesso para perfil não-administrador
```gherkin
  Cenário: Farmacêutico tenta listar usuários
    Dado que o usuário está autenticado com o perfil "FARMACEUTICO_RESPONSAVEL"
    Quando enviar uma requisição GET para "/api/v1/usuarios"
    Então o status da resposta deve ser 403 Forbidden
    E a consulta ao repositório não deve ser executada
```

---

## 7. Definition of Done (DoD)

1. **Código e Padrões**:
   - Caso de uso `ListUsersUseCase` implementado e registrado no módulo de acesso.
   - QueryBuilder otimizado com joins no `TypeOrmUserRepository`.
   - Endpoint `GET /api/v1/usuarios` registrado no `UserController` com `ListUsersQueryDto`.
2. **Qualidade e Testes**:
   - Testes unitários do caso de uso (Camada A) com 100% de aprovação.
   - Testes e2e/integração do endpoint (Camada C) cobrindo paginação, filtros e RBAC 401/403.
   - `pnpm -r test` e `pnpm -r build` passando com zero erros em todo o monorepo.