# ES-02: API de Saldos: Consulta Paginada com Busca Textual, Categorias, Agrupamento por Lote e Status

---

- **Épico**: Controle de Estoque (RF005, RF006, RF007, RF009, RF011, RF018, RF020, RF022, RF023, RF028, NF001, NF002, NF003, NF007, NF009, NF015)
- **Requisitos Funcionais**: RF005 (Catálogo e Apresentações), RF022 (Alerta de Medicamentos Próximos ao Vencimento com Destaque de Mês Corrente)
- **Requisitos Não-Funcionais**: NF001 (Usabilidade e Estrutura Semântica), NF007 (Consultas em até 2 segundos e Busca com Debounce < 200ms), NF015 (Isolamento Multi-tenant via RLS)
- **ADRs Vinculadas**: ADR-002 / ADR-016 (Multi-tenancy RLS), ADR-003 (Arquitetura Hexagonal), ADR-007 (Endpoints REST e Swagger), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camadas A e C), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de Usuário

> **Como** farmacêutico ou gerente da UBS,  
> **quero** consultar a listagem paginada dos saldos de estoque da unidade com busca textual inteligente, agrupamento por medicamento, detalhamento dos lotes individuais, filtros por categoria e filtros de validade (com destaque para lotes que vencem no mês corrente),  
> **para que** eu possa inspecionar fisicamente as prateleiras, planejar a dispensação priorizando lotes críticos e saber exatamente a quantidade disponível de cada apresentação na unidade (RF005, RF022).

---

## 2. Regras de Negócio e Casos de Borda

1. **Agrupamento por Medicamento e Expansão por Lote**:
   - Cada registro principal representa um medicamento do catálogo oficial (`produto_id`).
   - Apresenta o saldo consolidado da UBS (`saldoTotal = soma(lotes.saldo_atual)`).
   - Contém a lista de lotes físicos associados àquele produto na UBS, detalhando código do lote, fabricante, data de validade e saldo do lote.

2. **Classificação Semântica de Validade do Lote (`statusValidade`)**:
   - `VENCIDO`: Data de validade anterior à data corrente (`validade < hoje`).
   - `MES_CORRENTE`: Vencimento dentro do mês e ano civis correntes (exige badge **laranja** no frontend).
   - `CURTA_90D`: Vencimento nos próximos 90 dias corridos que não se enquadre no mês corrente (alerta âmbar/laranja).
   - `REGULAR`: Vencimento superior a 90 dias (badge verde).

3. **Filtro Avançado de Validade (`filtroValidade`)**:
   - `TODOS`: Exibe todos os itens;
   - `MES_CORRENTE`: Filtra medicamentos que possuam pelo menos um lote ativo com vencimento no mês corrente;
   - `VALIDADE_90D`: Filtra medicamentos com pelo menos um lote com vencimento em até 90 dias;
   - `VENCIDOS`: Filtra medicamentos com lotes vencidos que ainda possuam saldo a ser descartado.

4. **Busca Textual Inteligente (`termo`)**:
   - Suporte a busca parcial (case-insensitive e sem acentos) em:
     - Nome comercial do produto;
     - Princípio ativo (DCI/DCB);
     - Apresentação ou forma farmacêutica;
     - Código de lote específico.

5. **Paginação Eficiente**:
   - Retorno estruturado contendo dados paginados (`itens`, `total`, `pagina`, `itensPorPagina`, `totalPaginas`).

---

## 3. Escopo Técnico & Arquitetural (Clean Architecture — ADR-034)

### 1. Pacote Compartilhado (`@farmaubs/shared`)
- **`src/contracts/estoque/saldos.types.ts`**: `ConsultarSaldosQueryDto`, `MedicamentoSaldoItemDto`, `LoteEstoqueDto` e schema Zod `consultarSaldosQuerySchema`.
- **`src/domain/estoque/fefo-helpers.ts`**: Funções puras `calcularStatusValidade(validadeDate)` e `ordenarLotesPorFEFO(lotes)` reutilizadas no backend para padronização de classificação e no frontend/mobile para renderização de badges.

### 2. Camada de Aplicação (`apps/backend/src/modules/estoque/application/`)
- **Use Cases**:
  - `consultar-saldos-paginados.use-case.ts`: Executa query parametrizada de saldos via porta, agrupa os lotes sob seus respectivos medicamentos, aplica ordenação FEFO e enriquece com status de validade.

### 3. Camada de Domínio (`apps/backend/src/modules/estoque/domain/`)
- **Portas (Interfaces)**:
  - `estoque-saldos.repository.port.ts`: Contrato `consultarSaldosPaginados(ubsId: string, filtros: ConsultarSaldosQueryDto)`.

### 4. Camada de Infraestrutura (`apps/backend/src/modules/estoque/infrastructure/`)
- **Adaptadores de Banco (`adapters/`)**:
  - `typeorm-estoque-saldos.repository.ts`: Implementa `EstoqueSaldosRepositoryPort` com query builder, paginação e joins otimizados com a tabela de lotes e catálogo.
- **Adaptadores de Entrada HTTP (`controllers/`)**:
  - `estoque-saldos.controller.ts`: Endpoint `GET /api/v1/estoque/saldos` com validação de query parameters e RBAC.

---

## 4. Critérios de Aceite (Gherkin BDD)

### Cenário 1: Consulta paginada padrão com agrupamento de lotes
```gherkin
Dado que o farmacêutico está autenticado na sua UBS
Quando ele consultar "GET /api/v1/estoque/saldos?pagina=1&itensPorPagina=10"
Então a API deve retornar status 200 (OK)
E o payload deve listar os medicamentos da UBS com saldo total consolidado
E cada medicamento deve conter seu array de lotes individuais com fabricante, código do lote, data de validade, saldo e statusValidade
```

### Cenário 2: Filtro por lotes que vencem no mês corrente
```gherkin
Dado que existem 3 medicamentos com lotes com vencimento dentro do mês atual
Quando o usuário consultar "GET /api/v1/estoque/saldos?filtroValidade=MES_CORRENTE"
Então a API deve retornar apenas os medicamentos que contêm lotes com statusValidade "MES_CORRENTE"
E os metadados de paginação devem refletir o total de registros filtrados
```

---

## 5. Contratos de Dados (DTOs TypeScript)

```typescript
export class ConsultarSaldosQueryDto {
  @IsOptional()
  @IsString()
  termo?: string;

  @IsOptional()
  @IsString()
  categoria?: string;

  @IsOptional()
  @IsEnum(['TODOS', 'MES_CORRENTE', 'VALIDADE_90D', 'VENCIDOS'])
  filtroValidade?: 'TODOS' | 'MES_CORRENTE' | 'VALIDADE_90D' | 'VENCIDOS' = 'TODOS';

  @IsOptional()
  @IsEnum(['TODOS', 'EM_ESTOQUE', 'BAIXO_ESTOQUE', 'ZERADO'])
  statusEstoque?: 'TODOS' | 'EM_ESTOQUE' | 'BAIXO_ESTOQUE' | 'ZERADO' = 'TODOS';

  @IsOptional()
  @IsInt()
  @Min(1)
  pagina?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  itensPorPagina?: number = 15;
}

export interface LoteEstoqueDto {
  id: string;
  numeroLote: string;
  fabricanteId: string;
  fabricanteNome: string;
  dataValidade: string; // YYYY-MM-DD
  saldoAtual: number;
  statusValidade: 'REGULAR' | 'CURTA_90D' | 'MES_CORRENTE' | 'VENCIDO';
}

export interface MedicamentoSaldoItemDto {
  produtoId: string;
  nome: string;
  principioAtivo: string;
  formaFarmaceutica: string;
  concentracao: string;
  unidadeMedida: string;
  categoria: string;
  saldoTotal: number;
  statusEstoque: 'REGULAR' | 'BAIXO_ESTOQUE' | 'ZERADO';
  lotes: LoteEstoqueDto[];
}

export interface ConsultarSaldosPaginadosResponseDto {
  itens: MedicamentoSaldoItemDto[];
  total: number;
  pagina: number;
  itensPorPagina: number;
  totalPaginas: number;
}
```

---

## 6. Definition of Done (DoD)

- [ ] Query otimizada com índices compostos no PostgreSQL cobrindo `(ubs_id, produto_id)` e `(ubs_id, data_validade)`.
- [ ] Endpoint documentado no Swagger com exemplos de parâmetros de consulta.
- [ ] Testes unitários (Camada A) cobrindo ordenação por data de validade (FEFO) e cálculo de status semântico.
- [ ] Testes E2E (Camada C) validando paginação, filtros de mês corrente e isolamento por tenant.
