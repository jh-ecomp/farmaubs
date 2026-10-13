# AC-27 feat(administracao): Catálogo de administração (municípios e UBSs)

- **Épico**: Acesso e Autenticação do Sistema (RF001–RF004, NF009–NF012)
- **Requisitos Funcionais**: RF001 (Gerenciamento de Usuários), RF026 (Topologia de UBS)
- **Requisitos Não-Funcionais**: NF003 (pt-BR), NF009 (Menor Privilégio), NF012 (Sessão Segura), NF015 (Performance de Consulta)
- **ADRs Vinculadas**: ADR-002 (Multi-tenancy e Escopos Globais), ADR-016 (Isolamento RLS e Tabelas Globais), ADR-022 (`@farmaubs/shared`), ADR-029 (Arquitetura Hexagonal no NestJS), ADR-030 (Pirâmide de Testes)

---

## 1. Contexto & Problema
No painel administrativo, o modal de criação e edição de usuários (`<UsuarioModalForm />`) realiza chamadas para preencher dinamicamente:
1. O seletor de municípios (`GET /api/v1/administracao/municipios`).
2. O seletor de Unidades Básicas de Saúde em cascata baseado no município escolhido (`GET /api/v1/administracao/unidades-saude?municipioId=<uuid>`).

Com a remoção dos fallbacks locais do frontend, o backend responde com **404 Not Found**, pois as tabelas (`municipios`, `unidades_saude`) e entidades TypeORM existem no banco de dados, mas ainda não há um módulo com casos de uso e controllers HTTP para expor essas consultas.

---

## 2. História de Usuário

> **Como** Usuário Autenticado do FarmaUBS (com privilégios administrativos ou de cadastro),  
> **quero** consultar a listagem de municípios ativos via `GET /api/v1/administracao/municipios` e a listagem de Unidades Básicas de Saúde (UBSs) filtradas por município via `GET /api/v1/administracao/unidades-saude?municipioId=<uuid>`,  
> **para que** os formulários do sistema (como cadastro de usuários e lotação) possam exibir seletores dinâmicos e atualizados de acordo com a topologia municipal cadastrada.

---

## 3. Critérios de Aceite (BDD / Gherkin)

### Cenário 1: Listagem de Municípios Ativos
```gherkin
Funcionalidade: Catálogo de Municípios
  Como usuário autenticado
  Quero listar os municípios ativos cadastrados no sistema
  Para popular seletores de lotação municipal

  Cenário: Consulta de municípios com sessão válida
    Dado que o usuário está autenticado com sessão válida
    E existem municípios ativos cadastrados no banco de dados
    Quando uma requisição "GET /api/v1/administracao/municipios" for executada
    Então o sistema deve responder com HTTP 200 OK
    E o corpo da resposta deve ser um array contendo os municípios ordenados alfabeticamente por nome
    E cada item deve conter "id", "nome", "uf" e "ibgeCode"
```

### Cenário 2: Listagem de Unidades de Saúde (UBS) por Município
```gherkin
Funcionalidade: Catálogo de Unidades Básicas de Saúde (UBS)
  Como usuário autenticado
  Quero listar as unidades de saúde vinculadas a um município
  Para popular o seletor em cascata de UBSs

  Cenário: Consulta de UBSs informando municípioId válido
    Dado que o usuário está autenticado com sessão válida
    E existem UBSs cadastradas para o município "01a06db9-c4af-7944-8ec5-c9b9443b054e"
    Quando uma requisição "GET /api/v1/administracao/unidades-saude?municipioId=01a06db9-c4af-7944-8ec5-c9b9443b054e" for executada
    Então o sistema deve responder com HTTP 200 OK
    E o corpo da resposta deve ser um array com as unidades pertencentes àquele município ordenadas por nome
    E cada item deve conter "id", "municipioId", "nome", "endereco", "responsavelTecnico" e "cafLeadTimeDays"

  Cenário: Consulta de UBSs sem informar municípioId
    Dado que o usuário está autenticado com sessão válida
    Quando uma requisição "GET /api/v1/administracao/unidades-saude" for executada sem o parâmetro "municipioId"
    Então o sistema deve responder com HTTP 400 Bad Request
    E a mensagem deve indicar "O parâmetro 'municipioId' é obrigatório para consulta de unidades de saúde."
```

### Cenário 3: Proteção de Sessão e Não Autenticado
```gherkin
  Cenário: Tentativa de consulta de catálogo sem autenticação
    Dado que a requisição não possui cabeçalho "Authorization" com Bearer token válido
    Quando uma requisição "GET /api/v1/administracao/municipios" for executada
    Então o sistema deve responder com HTTP 401 Unauthorized
```

---

## 4. Escopo Técnico & Arquitetura

1. **Módulo NestJS**:
   - Criar `apps/backend/src/modules/administracao/administracao.module.ts`.
   - Registrar no `AppModule`.
2. **Ports e Casos de Uso**:
   - `ListMunicipiosUseCase` e porta `RepositorioMunicipioPort`.
   - `ListUnidadesSaudeUseCase` e porta `RepositorioUnidadeSaudePort`.
3. **Adapters TypeORM**:
   - Implementar `TypeOrmMunicipioRepository` consultando `MunicipioEntity` (`ativo = true`).
   - Implementar busca por município em `TypeOrmHealthUnitRepository` consultando `UnidadeSaudeEntity` (`municipio_id = :municipioId`).
   - *Nota de Isolamento (ADR-016)*: Ambas as tabelas são marcadas como `scope:global` no banco (dados de catálogo/topologia), portanto não aplicam restrição RLS por tenant.
4. **Controllers & Rotas**:
   - `AdministracaoController` com prefixo `@Controller('administracao')`:
     - `@Get('municipios')`
     - `@Get('unidades-saude')`
   - Protegidos por padrão pelo `SessionAuthGuard`.
5. **Tipagem e Contratos**:
   - Reutilizar `MunicipioDto` e `UnidadeSaudeDto` de `@farmaubs/shared`.
6. **Testes (ADR-030)**:
   - Testes unitários para os use cases e controller.
   - Testes BDD / integração.