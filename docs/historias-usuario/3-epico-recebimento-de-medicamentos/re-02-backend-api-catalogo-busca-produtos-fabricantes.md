# RE-02: API de Catálogo: Busca Textual de Medicamentos, Apresentações e Fabricantes (RF008)

---

- **Épico**: Recebimento de Medicamentos (RF008, RF024, RF028, NF007, NF009)
- **Requisitos Funcionais**: RF008 (Registro de Entrada e Catálogo de Medicamentos/Fabricantes)
- **Requisitos Não-Funcionais**: NF007 (Performance de Busca < 200ms com Debounce), NF009 (RBAC por Perfil)
- **ADRs Vinculadas**: ADR-003 (Arquitetura Hexagonal), ADR-007 (Endpoints REST e DTOs), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camadas A e C), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## Contexto & Problema

Durante a conferência física de uma carga recebida na UBS, o farmacêutico precisa localizar com rapidez e precisão o medicamento constante na nota ou guia. Como definido nos requisitos do MVP 1, **não haverá leitor de código de barras neste momento**, sendo fundamental uma busca textual de alta performance com suporte a termos parciais de nome comercial, princípio ativo ou forma farmacêutica.

Além disso, para atender às solicitações clínicas da equipe e da Anvisa, cada medicamento recebido deve estar estritamente vinculado ao seu **Fabricante / Laboratório** (ex: EMS, Prati-Donaduzzi, Medley, Fiocruz). A API deve fornecer endpoints para consulta rápida de fabricantes cadastrados e inclusão facilitada de novos fabricantes.

---

## Escopo Técnico & Arquitetural (Clean Architecture — ADR-034)

### 1. Pacote Compartilhado (`@farmaubs/shared`)
- **`src/contracts/recebimento/catalogo.types.ts`**: Tipos `ProdutoCatalogoItemDto`, `FabricanteDto`, `CadastrarFabricanteRequest` e schemas Zod.

### 2. Camada de Aplicação (`apps/backend/src/modules/catalogo/application/`)
- **Use Cases**:
  - `buscar-produtos-catalogo.use-case.ts`: Busca textual em nome comercial, princípio ativo e apresentação.
  - `listar-fabricantes.use-case.ts`: Retorna lista ordenada de laboratórios ativos.
  - `cadastrar-fabricante.use-case.ts`: Valida unicidade e persiste novo fabricante.

### 3. Camada de Domínio (`apps/backend/src/modules/catalogo/domain/`)
- **Entidades de Domínio**: `Produto` e `Fabricante`.
- **Portas (Interfaces)**:
  - `produto-catalogo.repository.port.ts`: Consulta de produtos com paginação/busca.
  - `fabricante.repository.port.ts`: Listagem e criação de fabricantes.

### 4. Camada de Infraestrutura (`apps/backend/src/modules/catalogo/infrastructure/`)
- **Adaptadores de Banco (`adapters/`)**:
  - `typeorm-produto-catalogo.repository.ts` e `typeorm-fabricante.repository.ts`.
- **Adaptadores de Entrada HTTP (`controllers/`)**:
  - `catalogo.controller.ts`: Endpoints `GET /produtos/busca`, `GET /fabricantes` e `POST /fabricantes`.

---

## Critérios de Aceite (Gherkin BDD)

### Cenário 1: Busca textual de medicamentos com termo válido
```gherkin
Dado que o usuário está autenticado com perfil "FARMACEUTICO" ou "TECNICO"
Quando ele enviar uma requisição "GET /api/v1/catalogo/produtos/busca?termo=amox"
Então a API deve retornar status 200 (OK)
E o corpo da resposta deve conter uma lista de medicamentos contendo "amox" no nome comercial ou princípio ativo
E cada item deve apresentar "id", "nomeComercial", "principioAtivo", "dosagem", "formaFarmaceutica" e "unidadeMedida"
```

### Cenário 2: Rejeição de busca com termo vazio ou insuficiente
```gherkin
Dado que o usuário tenta pesquisar medicamentos
Quando ele enviar a requisição "GET /api/v1/catalogo/produtos/busca?termo=a"
Então a API deve responder com status 400 (Bad Request)
E o erro deve informar que o termo de busca deve possuir no mínimo 2 caracteres
```

### Cenário 3: Consulta e cadastro rápido de fabricante
```gherkin
Dado que o farmacêutico está recebendo um lote de um novo laboratório "Laboratório Teuto"
Quando ele enviar uma requisição "POST /api/v1/catalogo/fabricantes" com:
  | razaoSocial | Laboratório Teuto Brasileiro S/A |
  | nomeFantasia | Teuto |
  | cnpj | 17159045000109 |
Então a API deve retornar status 201 (Created) com o fabricante persistido e "ativo: true"
E em seguida, requisições "GET /api/v1/catalogo/fabricantes" devem listar o "Teuto" entre as opções disponíveis
```

### Cenário 4: Prevenção de duplicidade de CNPJ de fabricante
```gherkin
Dado que já existe um fabricante cadastrado com o CNPJ "17159045000109"
Quando for enviado um novo cadastro com o mesmo CNPJ
Então a API deve responder com status 409 (Conflict)
E detalhar que o CNPJ já está vinculado ao fabricante existente
```

---

## Contratos de Dados (DTOs e Interfaces TypeScript)

```typescript
// DTO de Consulta de Medicamentos
export class BuscaProdutoCatalogoQueryDto {
  @IsString()
  @MinLength(2, { message: 'O termo de busca deve conter pelo menos 2 caracteres' })
  @MaxLength(100)
  termo: string;
}

// Resposta do Catálogo de Medicamentos
export interface ProdutoCatalogoResponseDto {
  id: string;
  nomeComercial: string;
  principioAtivo: string;
  dosagem: string;
  formaFarmaceutica: string;
  unidadeMedida: string;
  ativo: boolean;
}

// DTO de Criação de Fabricante
export class CriarFabricanteDto {
  @IsString()
  @MinLength(3, { message: 'Razão social deve ter no mínimo 3 caracteres' })
  @MaxLength(180)
  razaoSocial: string;

  @IsString()
  @MinLength(2, { message: 'Nome fantasia deve ter no mínimo 2 caracteres' })
  @MaxLength(120)
  nomeFantasia: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{14}$/, { message: 'CNPJ deve conter exatamente 14 dígitos numéricos' })
  cnpj?: string;
}

export interface FabricanteResponseDto {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj?: string;
  ativo: boolean;
}
```

---

## Regras de Negócio e Casos de Borda

1. **Ausência de Código de Barras no MVP 1**: A busca funciona puramente via texto (`ILIKE` com índice `pg_trgm` ou `to_tsvector`), garantindo respostas com latência inferior a 200ms.
2. **Normalização de Nomes de Fabricantes**: O sistema deve aplicar `trim()` nos campos de razão social e nome fantasia para evitar duplicidades geradas por espaços em branco no início ou fim.
3. **Inativação Lógica**: Fabricantes não devem ser deletados fisicamente do banco de dados para manter a integridade dos lotes históricos já recebidos (`ativo: false`).

---

## Definition of Done (DoD)

- [ ] Endpoints implementados no NestJS com validação de payload via `ValidationPipe` global.
- [ ] Testes unitários (Camada A) cobrindo busca de catálogo, sanitização de filtros e validação de CNPJ.
- [ ] Testes E2E (Camada C) validando fluxos de sucesso e tratamento de erros (400, 404, 409).
- [ ] Documentação Swagger / OpenAPI gerada sob o prefixo `/api/v1/catalogo`.
