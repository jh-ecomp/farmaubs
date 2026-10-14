# ES-03 feat(estoque): API de Ajustes: Rota Atômica para Ajustes Rápidos (+/-) com Motivo, Justificativa e Auditoria

---

- **Épico**: Controle de Estoque (RF005, RF006, RF007, RF009, RF011, RF018, RF020, RF022, RF023, RF028, NF001, NF002, NF003, NF007, NF009, NF015)
- **Requisitos Funcionais**: RF009 (Registrar Ajuste de Estoque - Entrada), RF011 (Registrar Ajuste de Estoque - Saída), RF028 (Rastreabilidade e Log de Auditoria)
- **Requisitos Não-Funcionais**: NF009 (RBAC restrito a Farmacêuticos), NF015 (Isolamento Multi-tenant via RLS)
- **ADRs Vinculadas**: ADR-002 / ADR-016 (RLS por UBS), ADR-003 (Arquitetura Hexagonal), ADR-007 (Endpoints REST e DTOs), ADR-008 / ADR-015 (Transações Atômicas ACID com Lock Pessimista), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camadas A, B e C), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico responsável ou residente da UBS,  
> **quero** registrar ajustes manuais pontuais de entrada (+) ou saída (-) diretamente sobre um lote específico de medicamento, informando obrigatoriamente a quantidade, o motivo sanitário e a justificativa textual detalhada,  
> **para que** eu possa corrigir divergências operacionais de contagem, formalizar o descarte de frascos avariados ou vencidos e aceitar devoluções de pacientes com total transparência e rastreabilidade no estoque da unidade (RF009, RF011, RF028).

---

## 2. Regras de negócio e casos de borda

1. **Tipos de Operação**:
   - `ENTRADA` (+): Incrementa o saldo do lote físico (`saldo_atual = saldo_atual + quantidade`).
   - `SAIDA` (-): Decrementa o saldo do lote físico (`saldo_atual = saldo_atual - quantidade`).
2. **Catálogo de Motivos Obrigatórios**:
   - **Para Ajuste de Entrada (RF009)**:
     - `CORRECAO_INVENTARIO`: Ajuste positivo decorrente de recontagem física na prateleira;
     - `DEVOLUCAO_PACIENTE`: Medicamento devolvido por usuário/paciente em condições sanitárias íntegras;
     - `OUTRO`: Motivo excepcional, exigindo detalhamento obrigatório.
   - **Para Ajuste de Saída (RF011)**:
     - `VENCIMENTO`: Descarte regulamentar de lote com prazo de validade expirado;
     - `AVARIA_FISICA`: Quebra de frasco, violação de lacre ou perda de integridade na farmácia;
     - `EXTRAVIO`: Falta física identificada sem correlação de dispensação;
     - `RECOLHIMENTO_SANITARIO`: Interdição ou recall emitido pela Anvisa ou CAF Central;
     - `OUTRO`: Motivo excepcional, exigindo detalhamento obrigatório.
3. **Obrigatoriedade de Justificativa Textual**:
   - O campo `justificativa` é obrigatório para todos os ajustes (mínimo de 10 caracteres e máximo de 500).
   - Quando o motivo for `OUTRO`, o sistema exige justificativa explícita com no mínimo 20 caracteres.
4. **Consistência Transacional e Lock Pessimista (ADR-008)**:
   - A operação executa dentro de uma transação `DataSource.transaction()` do TypeORM com lock exclusivo (`SELECT FOR UPDATE`) no lote.
   - Em operações de `SAIDA`: valida se `saldo_atual >= quantidade`. Caso contrário, a transação sofre rollback e retorna status `422 (Unprocessable Entity)`.
   - Cria atomicamente o registro de movimentação de auditoria (`AJUSTE_ENTRADA` ou `AJUSTE_SAIDA`).

---

## 3. Contratos de dados e Protocolo HTTP (DTOs)

### Endpoints REST
- `POST /api/v1/estoque/lotes/:loteId/ajustes`: Registro atômico de ajuste avulso de lote.

### DTOs TypeScript (com class-validator)

```typescript
export class RegistrarAjusteEstoqueDto {
  @IsEnum(['ENTRADA', 'SAIDA'])
  tipoOperacao: 'ENTRADA' | 'SAIDA';

  @IsInt()
  @Min(1, { message: 'A quantidade deve ser um número inteiro estritamente positivo' })
  quantidade: number;

  @IsEnum([
    'CORRECAO_INVENTARIO',
    'DEVOLUCAO_PACIENTE',
    'VENCIMENTO',
    'AVARIA_FISICA',
    'EXTRAVIO',
    'RECOLHIMENTO_SANITARIO',
    'OUTRO'
  ])
  motivo: string;

  @IsString()
  @MinLength(10, { message: 'A justificativa deve conter no mínimo 10 caracteres' })
  @MaxLength(500)
  justificativa: string;
}

export interface AjusteEstoqueResponseDto {
  movimentacaoId: string;
  loteId: string;
  tipoOperacao: 'ENTRADA' | 'SAIDA';
  quantidadeAjustada: number;
  saldoAnterior: number;
  saldoAtualizado: number;
  motivo: string;
  justificativa: string;
  realizadoPor: {
    id: string;
    nome: string;
  };
  dataHora: string;
}
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

### 1. Pacote Compartilhado (`@farmaubs/shared`)
- **`src/contracts/estoque/ajustes.types.ts`**: `RegistrarAjusteLoteInputDto`, `AjusteEstoqueResultadoDto` e schema Zod `registrarAjusteSchema`.
- **`src/domain/estoque/ajustes-helpers.ts`**: Validações de tamanho de justificativa (mínimo de 10 caracteres; mínimo de 20 caracteres se o motivo for `OUTRO`) e checagem de suficiência de saldo físico.

### 2. Camada de Aplicação (`apps/backend/src/modules/estoque/application/`)
- **Use Cases**:
  - `registrar-ajuste-estoque.use-case.ts`: Orquestrador transacional de ajuste avulso via `UnitOfWorkPort` / `EstoqueAjustesRepositoryPort` com lock pessimista (`SELECT FOR UPDATE`), validação de saldo e gravação de auditoria.

### 3. Camada de Domínio (`apps/backend/src/modules/estoque/domain/`)
- **Entidades de Domínio**: `Lote` e `MovimentacaoEstoque`.
- **Portas (Interfaces)**:
  - `estoque-ajustes.repository.port.ts`: Métodos `bloquearLotePorId`, `atualizarSaldo` e `registrarMovimentacao`.
  - `unit-of-work.port.ts`: Abstração de transação atômica.
- **Erros de Domínio**: `SaldoInsuficienteException`, `JustificativaInvalidaException`, `LoteNaoEncontradoException`.

### 4. Camada de Infraestrutura (`apps/backend/src/modules/estoque/infrastructure/`)
- **Adaptadores de Banco (`adapters/`)**:
  - `typeorm-estoque-ajustes.repository.ts`: Execução atômica via `QueryRunner` do TypeORM garantindo `START TRANSACTION`, `SELECT ... FOR UPDATE` e `COMMIT`.
- **Adaptadores de Entrada HTTP (`controllers/`)**:
  - `estoque-ajustes.controller.ts`: Endpoint `POST /api/v1/estoque/lotes/:loteId/ajustes` com proteção de perfil `FARMACEUTICO`.

---

## 5. Cenários de teste em BDD (Gherkin — camada A, B e C)

```gherkin
# language: pt
Funcionalidade: Ajustes Pontuais de Estoque (Camadas A, B e C)

  Cenário: Ajuste positivo de entrada com motivo de devolução de paciente
    Dado que o farmacêutico está autenticado na sua UBS
    E o lote "LT-AMOX-2026" possui saldo atual de 50 unidades
    Quando ele enviar "POST /api/v1/estoque/lotes/uuid-lote-123/ajustes" com:
      | tipoOperacao  | ENTRADA |
      | quantidade    | 10 |
      | motivo        | DEVOLUCAO_PACIENTE |
      | justificativa | Paciente devolveu 10 comprimidos lacrados por suspensao medica |
    Então a API deve retornar status 201 (Created)
    E o saldo do lote "LT-AMOX-2026" deve passar para 60 unidades
    E deve ser registrado o evento de auditoria "AJUSTE_ENTRADA" com o usuário logado

  Cenário: Ajuste negativo de saída com motivo de avaria física
    Dado que o lote "LT-DIP-FRASCO" possui saldo atual de 15 unidades
    Quando o farmacêutico enviar "POST /api/v1/estoque/lotes/uuid-lote-456/ajustes" com:
      | tipoOperacao  | SAIDA |
      | quantidade    | 2 |
      | motivo        | AVARIA_FISICA |
      | justificativa | Queda acidental de 2 frascos da prateleira com quebra de vidro |
    Então a API deve retornar status 201 (Created)
    E o saldo do lote deve passar para 13 unidades
    E a movimentação "AJUSTE_SAIDA" deve ser registrada com motivo "AVARIA_FISICA"

  Cenário: Bloqueio de ajuste de saída com quantidade superior ao saldo disponível
    Dado que o lote possui saldo atual de 5 unidades
    Quando o usuário tentar realizar ajuste de saída com quantidade 10
    Então a API deve recusar a operação com status 422 (Unprocessable Entity)
    E detalhar: "Saldo insuficiente no lote para efetuar a baixa de estoque solicitada"
    E o saldo do lote deve permanecer inalterado (5 unidades)
```

---

## 6. Checklist de DoD e aceitação

- [ ] Caso de uso `RegistrarAjusteEstoqueUseCase` implementado com lock pessimista (`SELECT FOR UPDATE`).
- [ ] Validação rigorosa de motivo x tipo de operação (ex: impede motivo `VENCIMENTO` em operação de `ENTRADA`).
- [ ] Testes unitários (Camada A) cobrindo regras de saldo negativo, validação de caracteres e autorização RBAC.
- [ ] Testes de integração de concorrência (Camada B) simulando 2 ajustes simultâneos no mesmo lote para garantir consistência ACID.
- [ ] Testes E2E (Camada C) validando persistência do histórico e integridade do saldo atualizado.
