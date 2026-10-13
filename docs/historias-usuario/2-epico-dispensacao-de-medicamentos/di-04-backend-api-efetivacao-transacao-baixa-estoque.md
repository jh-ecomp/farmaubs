# DI-04 feat(dispensacao): API de Efetivação: Transação atômica de dispensa, validação de antimicrobianos e baixa de estoque

---

- **Épico**: Dispensação de Medicamentos (RF010, RF028, NF009, NF010, NF015)
- **Requisitos Funcionais**: RF010 (Registro de Dispensa e Baixa em Estoque), RF028 (Rastreabilidade e Log de Auditoria)
- **Requisitos Não-Funcionais**: NF009 (RBAC Restrito a Farmacêuticos), NF010 (Processamento Rápido em Transação < 500ms), NF015 (Isolamento por UBS via RLS)
- **ADRs Vinculadas**: ADR-002 (Escopo Multi-tenant), ADR-003 (Arquitetura Hexagonal), ADR-007 (Endpoints REST e Swagger), ADR-015 (PostgreSQL & Transações Atômicas ACID), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camadas A, B e C), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico responsável ou residente atendendo na UBS,  
> **quero** submeter a receita de medicamentos conferindo a identificação do paciente, a validade da receita médica (especialmente antimicrobianos com prazo máximo de 10 dias) e efetivar a baixa de estoque em uma transação atômica única,  
> **para que** os saldos físicos dos lotes sejam decrementados em tempo real, sem risco de concorrência ou inconsistência de saldo (ADR-015, RF010).

---

## 2. Regras de negócio e casos de borda

1. **Validação Obrigatória dos 4 Campos do Paciente no Atendimento**:
   - Toda solicitação de dispensação deve conter ou referenciar um paciente com:
     - `cns` (15 dígitos numéricos);
     - `cpf` (11 dígitos válidos);
     - `nomeCompleto`;
     - `dataNascimento`.
   - Se o paciente for enviado inline e ainda não existir no município, o sistema cria o cadastro do paciente na mesma transação. Se já existir, reutiliza o registro existente.

2. **Validação de Receitas de Antimicrobianos (Prazo de 10 Dias)**:
   - Se qualquer um dos itens dispensados for classificado como antimicrobiano:
     - O campo `receitaEmissaoEm` (data de emissão da receita médica) torna-se **estritamente obrigatório**.
     - A data não pode ser futura.
     - A data de emissão não pode ser anterior a 10 dias corridos em relação à data atual do atendimento (`hoje - receitaEmissaoEm <= 10 dias`).
     - Caso o prazo de 10 dias seja extrapolado, a transação é abortada com `ReceitaAntimicrobianoVencidaException` (`400 Bad Request`).

3. **Garantia Transacional ACID e Baixa de Saldo (ADR-015)**:
   - Toda a operação é executada sob uma transação de banco de dados única (`BEGIN ... COMMIT`):
     1. Bloqueio pessimista de leitura (`SELECT ... FOR UPDATE`) nos registros de lotes envolvidos para evitar condições de corrida (*race conditions*).
     2. Verificação de saldo disponível no lote (`saldo_atual >= quantidade_dispensada`). Se insuficiente, aborta com `SaldoInsuficienteLoteException`.
     3. Decremento do saldo do lote (`saldo_atual = saldo_atual - quantidade`).
     4. Gravação do cabeçalho da dispensação na tabela `dispensacoes`.
     5. Gravação de cada item na tabela `dispensacao_itens`.
     6. Registro do log de movimentação de saída em `movimentacoes_estoque` com tipo `SAIDA_DISPENSACAO`.
   - Em caso de qualquer falha, toda a transação sofre `ROLLBACK` completo sem deixar saldos parciais.

4. **Identificação do Dispensador**:
   - O campo `dispensador_id` é preenchido automaticamente a partir da sessão ativa do usuário autenticado (`req.user.id`).
   - A unidade de saúde é extraída do escopo ativo da sessão (`req.user.unidadeId`).

---

## 3. Contratos de dados e protocolo HTTP

### Endpoint REST (`DispensacaoController`)

| Método | Rota | Descrição | Roles Permitidos |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/dispensacoes` | Efetiva a dispensação e baixa de estoque transacional | `FARMACEUTICO_RESPONSAVEL`, `FARMACEUTICO_RESIDENTE`, `ADMINISTRADOR` |

### Contratos no `@farmaubs/shared` (`packages/shared/src/dispensacao/dispensacao.types.ts`)

```typescript
export interface ItemDispensacaoRequest {
  medicamentoId: string;
  loteId: string;
  quantidadeDispensada: number;
  posologia?: string;
}

export interface PacienteDispensacaoRequest {
  id?: string;
  cns: string;
  cpf: string;
  nomeCompleto: string;
  dataNascimento: string; // YYYY-MM-DD
}

export interface EfetivarDispensacaoRequest {
  paciente: PacienteDispensacaoRequest;
  receitaEmissaoEm?: string; // Obrigatório se houver antimicrobiano
  itens: ItemDispensacaoRequest[];
}

export interface ItemDispensadoResultadoDto {
  itemId: string;
  medicamentoId: string;
  medicamentoNome: string;
  loteId: string;
  numeroLote: string;
  quantidadeDispensada: number;
  saldoRestanteLote: number;
}

export interface DispensacaoEfetivadaResultado {
  id: string;
  numeroAtendimento: string;
  dataAtendimento: string | Date;
  status: "concluida" | "estornada";
  paciente: {
    id: string;
    nomeCompleto: string;
    cpf: string;
    cns: string;
  };
  dispensador: {
    id: string;
    nomeCompleto: string;
  };
  itens: ItemDispensadoResultadoDto[];
}
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

### 1. Pacote Compartilhado (`@farmaubs/shared`)
- **`src/contracts/dispensacao/dispensacao.types.ts`**: Contratos de Request e Response DTOs de efetivação e schema Zod `efetivarDispensacaoSchema`.
- **`src/domain/dispensacao/antimicrobianos-helpers.ts`**: Função pura `validarReceitaAntimicrobiano(emissaoEm, itens, dataAtual)` que avalia o limite de 10 dias corridos para antimicrobianos, compartilhada com frontend e mobile.

### 2. Camada de Aplicação (`apps/backend/src/modules/dispensacao/application/`)
- **Use Cases**:
  - `efetivar-dispensacao.use-case.ts`: Orquestrador transacional desacoplado de ORM. Recebe o DTO validado, invoca a regra de antimicrobianos de `@farmaubs/shared`, e comanda a transação ACID através de `UnitOfWorkPort` / `DispensacaoRepositoryPort`.

### 3. Camada de Domínio (`apps/backend/src/modules/dispensacao/domain/`)
- **Entidades de Domínio**: `Dispensacao`, `DispensacaoItem` e `MovimentacaoEstoque` (com invariantes de saldo).
- **Portas (Interfaces)**:
  - `dispensacao.repository.port.ts`: Métodos para bloqueio com lock pessimista (`bloquearLoteParaUpdate`) e persistência atômica.
  - `unit-of-work.port.ts`: Abstração de transação atômica (`runInTransaction<T>(work: () => Promise<T>): Promise<T>`).
- **Erros de Domínio**:
  - `ReceitaAntimicrobianoVencidaException`, `SaldoInsuficienteLoteException`, `LoteNaoPertenceAUbsException`.

### 4. Camada de Infraestrutura (`apps/backend/src/modules/dispensacao/infrastructure/`)
- **Adaptadores de Banco (`adapters/`)**:
  - `typeorm-dispensacao.repository.ts`: Execução via `QueryRunner` do TypeORM garantindo `START TRANSACTION`, `SELECT ... FOR UPDATE` e `COMMIT`.
- **Adaptadores de Entrada HTTP (`controllers/`)**:
  - `dispensacao.controller.ts`: Endpoint `POST /api/v1/dispensacoes` com extração de `user.id` e `user.unidadeId` do JWT injetando no comando do use case.

---

## 5. Cenários de teste em BDD (Gherkin — camada A)

```gherkin
# language: pt
Funcionalidade: Efetivação Transacional de Dispensação e Baixa de Estoque (Camada A)

  Cenário: Dispensação de medicamentos comuns com baixa atômica bem-sucedida
    Dado que a UBS possui o lote "LOT-01" de "Paracetamol 500mg" com saldo 50
    E o paciente possui CNS "123456789012345", CPF "12345678909", nome "Carlos Silva" e nascimento "1990-01-01"
    Quando o farmacêutico efetivar a dispensação de 20 comprimidos do lote "LOT-01"
    Então a dispensação deve ser concluída com status "concluida"
    E o saldo restante do lote "LOT-01" deve ser atualizado para 30

  Cenário: Rejeição por receita de antimicrobiano emitida há mais de 10 dias
    Dado que a dispensação contém o medicamento antimicrobiano "Amoxicilina 500mg"
    E a data de emissão da receita médica é de 12 dias atrás
    Quando o farmacêutico tentar efetivar a dispensação
    Então uma exceção ReceitaAntimicrobianoVencidaException deve ser lançada
    E nenhum saldo de estoque deve ser decrementado

  Cenário: Rejeição por saldo insuficiente no lote selecionado
    Dado que o lote selecionado possui saldo atual de 10 unidades
    Quando o farmacêutico submeter uma dispensação de 15 unidades para esse lote
    Então uma exceção SaldoInsuficienteLoteException deve ser lançada
    E a transação deve sofrer rollback imediato
```

---

## 6. Checklist de DoD e aceitação

- [ ] Transação gerenciada atomicamente via `QueryRunner` ou `TransactionInterceptor` (ADR-015).
- [ ] Validação estrita de receita médica para antimicrobianos (bloqueio com > 10 dias).
- [ ] Bloqueio de linhas para prevenir condições de corrida em saldos concorrentes.
- [ ] Micro-TSDoc documentando todos os use cases e adaptadores.
- [ ] Testes automatizados unitários (Camada A) e de integração transacional com banco real (Camada C).
- [ ] Resposta da API formatada conforme os DTOs do `@farmaubs/shared`.
