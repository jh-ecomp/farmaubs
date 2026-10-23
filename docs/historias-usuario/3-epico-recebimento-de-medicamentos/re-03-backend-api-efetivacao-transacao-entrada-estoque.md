# RE-03 feat(recebimento): API de Efetivação: Transação Atômica de Entrada de Estoque e Gestão de Lotes (RF008, RF024)

---

- **Épico**: Recebimento de Medicamentos (RF008, RF024, RF028, NF009, NF015)
- **Requisitos Funcionais**: RF008 (Registro de Recebimento e Incremento de Estoque), RF024 (Alerta de Validade Curta e Bloqueio de Vencidos), RF028 (Rastreabilidade e Log de Movimentação)
- **Requisitos Não-Funcionais**: NF009 (RBAC por Perfil), NF015 (Isolamento Multi-tenant por UBS via RLS)
- **ADRs Vinculadas**: ADR-002 / ADR-016 (Multi-tenancy e RLS), ADR-003 (Arquitetura Hexagonal), ADR-007 (Endpoints REST e Swagger), ADR-008 / ADR-015 (Consistência Transacional ACID com Lock Pessimista), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camadas A, B e C), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico ou operador de farmácia da UBS,  
> **quero** registrar a entrada de medicamentos e insumos de uma guia ou nota fiscal de forma atômica e consistente, incrementando lotes existentes ou criando novos lotes com validação rigorosa de validade,  
> **para que** o estoque físico e lógico da UBS permaneça sincronizado e auditável para o SUS, sem risco de inconsistências sob concorrência e impedindo o ingresso de medicamentos vencidos (RF008, RF024, RF028).

---

## 2. Regras de negócio e casos de borda

1. **Atomicidade da Carga**:
   - O registro do cabeçalho da nota/guia e de todas as suas linhas de medicamentos acontece dentro de um único bloco transacional ACID (`queryRunner.startTransaction()`). Se qualquer item falhar, toda a operação sofre rollback.
2. **Lock Pessimista e Upsert Seguro de Lotes**:
   - Ao atualizar um lote pré-existente na UBS (`ubs_id, produto_id, numero_lote, fabricante_id`), utiliza-se lock pessimista (`SELECT FOR UPDATE` / `setLock('pessimistic_write')`) para prevenir perda de atualização por concorrência. Se for inédito, cria novo registro com saldo inicial.
3. **Bloqueio de Validade Expirada**:
   - Não é permitido registrar itens com data de validade igual ou anterior à data atual. A API rejeita a requisição com `400 (Bad Request)` e mensagem: `"Não é permitido receber lotes já vencidos (validade informada: YYYY-MM-DD)"`.
4. **Alerta Preventivo de Validade Curta (< 180 dias)**:
   - Caso a data de validade esteja entre hoje e 180 dias corridos à frente, a API aceita a entrada, mas retorna na resposta a lista de avisos: `avisos: [{ tipo: 'VALIDADE_CURTA', mensagem: 'Lote vence em menos de 6 meses' }]`.
5. **Quantidade Inteira Positiva**:
   - Cada item deve possuir quantidade inteira maior que zero (`quantidadeRecebida >= 1`).
6. **Rastreabilidade de Movimentação**:
   - Para cada item da remessa recebida, gera automaticamente um registro na tabela de movimentações com tipo `ENTRADA_RECEBIMENTO`, vinculado ao documento de entrada e ao usuário recebedor.

---

## 3. Contratos de dados e Protocolo HTTP (DTOs)

### Endpoints REST
- `POST /api/v1/recebimento/entradas`: Efetivação transacional da entrada de estoque.

### DTOs TypeScript (com class-validator)

```typescript
export enum TipoDocumentoEntrada {
  GUIA_CAF = 'GUIA_CAF',
  NOTA_FISCAL = 'NOTA_FISCAL',
  REMESSA_DLOG = 'REMESSA_DLOG',
  COMPRA_PREGAO = 'COMPRA_PREGAO',
  DOACAO = 'DOACAO',
}

export class ItemRecebimentoEntradaDto {
  @IsUUID('4')
  produtoId: string;

  @IsUUID('4')
  fabricanteId: string;

  @IsString()
  @MinLength(2, { message: 'Número do lote deve ter ao menos 2 caracteres' })
  @MaxLength(60)
  numeroLote: string;

  @IsDateString({}, { message: 'Data de validade deve ser uma data ISO válida (YYYY-MM-DD)' })
  dataValidade: string;

  @IsInt({ message: 'Quantidade recebida deve ser um número inteiro' })
  @Min(1, { message: 'Quantidade recebida deve ser no mínimo 1' })
  quantidadeRecebida: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacoes?: string;
}

export class CriarEntradaEstoqueDto {
  @IsString()
  @MinLength(2, { message: 'Número da nota/guia é obrigatório' })
  @MaxLength(100)
  numeroDocumento: string;

  @IsEnum(TipoDocumentoEntrada, { message: 'Tipo de documento inválido' })
  tipoDocumento: TipoDocumentoEntrada;

  @IsString()
  @MinLength(3, { message: 'Origem ou fornecedor deve ter ao menos 3 caracteres' })
  @MaxLength(180)
  fornecedorOrigem: string;

  @IsOptional()
  @IsDateString()
  dataRecebimento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacoes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemRecebimentoEntradaDto)
  @ArrayMinSize(1, { message: 'A remessa deve conter pelo menos 1 medicamento' })
  itens: ItemRecebimentoEntradaDto[];
}
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

### 1. Pacote Compartilhado (`@farmaubs/shared`)
- **`src/contracts/recebimento/recebimento.types.ts`**: Tipos `EfetivarEntradaRequestDto`, `RecebimentoConfirmadoDto` e schema Zod `efetivarEntradaSchema`.
- **`src/domain/estoque/validade-helpers.ts`**: Função pura `validarValidadeRecebimento(dataValidade, dataAtual)` que avalia lote vencido e alerta de validade crítica (< 180 dias).

### 2. Camada de Aplicação (`apps/backend/src/modules/recebimento/application/`)
- **Use Cases**:
  - `efetivar-entrada-estoque.use-case.ts`: Orquestrador transacional desacoplado de ORM. Recebe o DTO validado, invoca as regras de validade de `@farmaubs/shared`, e orquestra a transação ACID via `UnitOfWorkPort` / `RecebimentoRepositoryPort` (lock pessimista `SELECT FOR UPDATE` para criação/incremento de lotes e movimentações de auditoria).

### 3. Camada de Domínio (`apps/backend/src/modules/recebimento/domain/`)
- **Entidades de Domínio**: `DocumentoEntrada`, `RecebimentoItem`, `Lote` e `MovimentacaoEstoque`.
- **Portas (Interfaces)**:
  - `recebimento.repository.port.ts`: Métodos de persistência de documento e itens.
  - `estoque-lotes.port.ts`: Obter ou criar lote na UBS com lock exclusivo.
  - `unit-of-work.port.ts`: Abstração de transação atômica.
- **Erros de Domínio**: `LoteValidadeVencidaException`, `DocumentoEntradaDuplicadoException`.

### 4. Camada de Infraestrutura (`apps/backend/src/modules/recebimento/infrastructure/`)
- **Adaptadores de Banco (`adapters/`)**:
  - `typeorm-recebimento.repository.ts` e `typeorm-estoque-lotes.adapter.ts`.
- **Adaptadores de Entrada HTTP (`controllers/`)**:
  - `recebimento.controller.ts`: Endpoint `POST /api/v1/recebimento/entradas` com extração de usuário da sessão JWT.

---

## 5. Cenários de teste em BDD (Gherkin — camada A, B e C)

```gherkin
# language: pt
Funcionalidade: Efetivação Transacional de Entrada de Estoque (Camadas A, B e C)

  Cenário: Efetivação de entrada com múltiplos itens e criação de lotes inéditos
    Dado que o farmacêutico está autenticado e vinculado à "UBS Central"
    Quando enviar uma requisição "POST /api/v1/recebimento/entradas" com:
      | numeroDocumento   | GUIA-CAF-2026/089          |
      | tipoDocumento     | GUIA_CAF                   |
      | fornecedorOrigem  | CAF Central - SMS Parnaíba |
      | itens:                                         |
        | produtoId: "prod-amox-500"     | fabricanteId: "fab-ems"    | numeroLote: "LT-2027M9" | dataValidade: "2027-09-30" | quantidadeRecebida: 300 |
        | produtoId: "prod-dipirona-500" | fabricanteId: "fab-medley" | numeroLote: "LT-DIP-88" | dataValidade: "2028-01-15" | quantidadeRecebida: 500 |
    Então a API deve retornar status 201 (Created)
    E um registro em "documentos_entrada" deve ser persistido para a "UBS Central"
    E os dois lotes devem ser criados na tabela "lotes" com saldo inicial correspondente (300 e 500 unidades)
    E duas movimentações de estoque com tipo "ENTRADA_RECEBIMENTO" devem ser registradas

  Cenário: Incremento de saldo em lote já existente na UBS
    Dado que a UBS já possui o lote "LT-2027M9" do produto "prod-amox-500" da "fab-ems" com saldo atual de 100 unidades
    Quando uma nova remessa for registrada para o mesmo lote com quantidade de 200 unidades
    Então a transação deve localizar o lote existente com lock pessimista
    E atualizar o saldo do lote para exatamente 300 unidades
    E registrar a respectiva movimentação "ENTRADA_RECEBIMENTO" vinculada ao novo documento de entrada

  Cenário: Bloqueio de recebimento de lote com data de validade expirada
    Dado que o farmacêutico tenta registrar um item cuja "dataValidade" é igual ou anterior à data atual
    Quando ele submeter a requisição de entrada
    Então a API deve retornar status 400 (Bad Request)
    E o erro deve informar: "Não é permitido receber lotes já vencidos (validade informada: YYYY-MM-DD)"
    E nenhum registro deve ser inserido no banco (rollback completo da transação)

  Cenário: Rejeição de quantidades inválidas
    Dado que um dos itens da remessa possui "quantidadeRecebida" igual a 0 ou negativa (-50)
    Quando a requisição for submetida
    Então a API deve responder com status 400 (Bad Request)
    E informar que a quantidade recebida de cada item deve ser um número inteiro positivo maior que zero
```

---

## 6. Checklist de DoD e aceitação

- [x] Caso de uso implementado com rollback automático em caso de exceção.
- [x] Testes unitários (Camada A) cobrindo regras de cálculo de saldo, validação de datas e integridade do payload.
- [x] Testes de concorrência transacional (Camada B) simulando recebimentos simultâneos para o mesmo lote.
- [x] Teste E2E (Camada C) validando o fluxo completo desde o endpoint HTTP até a verificação dos saldos no banco de dados.
