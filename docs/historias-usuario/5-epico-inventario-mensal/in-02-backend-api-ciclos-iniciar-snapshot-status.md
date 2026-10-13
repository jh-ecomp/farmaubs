# IN-02: API de Ciclos: Iniciar Ciclo, Congelamento de Saldo Teórico, Salvamento de Rascunho e Gestão de Status

---

- **Épico**: Inventário Mensal (RF009, RF011, RF013, RF014, RF021, RF028, NF001, NF002, NF003, NF005, NF007, NF008, NF009, NF015)
- **Requisitos Funcionais**: RF013 (Realizar Inventário Mensal), RF014 (Consultar Histórico de Inventários)
- **Requisitos Não-Funcionais**: NF005 (Persistência em Rascunho sem Perda de Dados), NF009 (RBAC Restrito), NF015 (Isolamento Multi-tenant via RLS)
- **ADRs Vinculadas**: ADR-002 / ADR-016 (Isolamento RLS por UBS), ADR-003 (Arquitetura Hexagonal), ADR-007 (Endpoints REST e Swagger), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camadas A e C), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de Usuário

> **Como** farmacêutico responsável da farmácia da UBS,  
> **quero** iniciar um novo ciclo de inventário mensal que capture uma fotografia (snapshot) dos saldos teóricos de todos os lotes de medicamentos da unidade, consultar o ciclo ativo com o progresso das contagens e poder cancelar um ciclo incorreto mediante justificativa,  
> **para que** o processo de conferência física das prateleiras seja executado sobre uma base de comparação estável e confiável, mantendo o histórico protegido e acessível a qualquer momento (RF013, RF014).

---

## 2. Regras de Negócio e Casos de Borda

1. **Abertura de Ciclo e Snapshot de Estoque Teórico (RF013)**:
   - Ao requisitar `POST /api/v1/inventario/ciclos`:
     - O sistema valida se já existe algum ciclo com status `EM_ANDAMENTO` na UBS do usuário autenticado. Caso exista, rejeita com `409 (Conflict)` e mensagem: `"Já existe um ciclo de inventário em andamento para esta UBS. Finalize ou cancele o ciclo atual antes de iniciar um novo"`.
     - Gera o número sequencial do ciclo (ex: `INV-2026/10`).
     - Realiza uma varredura em todos os lotes cadastrados com vínculo na UBS e insere registros em `inventario_itens` copiando o `saldo_atual` para `quantidade_teorica`.
     - Inicializa `quantidade_fisica` como `null` e status do ciclo como `EM_ANDAMENTO`.

2. **Consulta do Ciclo Ativo (`GET /api/v1/inventario/ciclos/ativo`)**:
   - Retorna os dados do ciclo em andamento na unidade, com totalizadores de progresso:
     - `totalItens`: total de lotes a conferir;
     - `itensConferidos`: quantidade de lotes cuja contagem física já foi preenchida;
     - `percentualConcluido`: progresso percentual (`itensConferidos / totalItens * 100`).
   - Se não houver ciclo ativo, retorna status `200` com payload `{ cicloAtivo: null }`.

3. **Cancelamento de Ciclo (`POST /api/v1/inventario/ciclos/:id/cancelar`)**:
   - Permitido apenas para ciclos com status `EM_ANDAMENTO`.
   - Exige campo `motivoCancelamento` obrigatório (mínimo de 10 caracteres).
   - Altera o status para `CANCELADO` e não modifica nenhum saldo de estoque no banco.

---

## 3. Escopo Técnico & Arquitetural (Clean Architecture — ADR-034)

### 1. Pacote Compartilhado (`@farmaubs/shared`)
- **`src/contracts/inventario/ciclos.types.ts`**: `InventarioCicloAtivoDTO`, `InventarioHistoricoItemDTO`, `IniciarCicloInputDTO`, `CancelarCicloInputDTO` e enum `StatusCicloInventario`.
- **`src/domain/inventario/progresso-helpers.ts`**: Função pura `calcularProgressoInventario(totalItens, itensContados)` compartilhada entre backend, frontend e mobile.

### 2. Camada de Aplicação (`apps/backend/src/modules/inventario/application/`)
- **Use Cases**:
  - `iniciar-ciclo-inventario.use-case.ts`: Verifica a inexistência de ciclo ativo na UBS, gera o identificador do ciclo e captura o snapshot de todos os lotes ativos via porta de repositório em transação única.
  - `consultar-ciclo-ativo.use-case.ts`: Recupera o ciclo `EM_ANDAMENTO`, calcula o percentual concluído e retorna o status operacional.
  - `listar-historico-ciclos.use-case.ts`: Consulta histórico paginado de ciclos da UBS.
  - `cancelar-ciclo-inventario.use-case.ts`: Atualiza o status para `CANCELADO` com registro de motivo sem alterar saldos físicos.

### 3. Camada de Domínio (`apps/backend/src/modules/inventario/domain/`)
- **Entidades de Domínio**: `CicloInventario` e `InventarioItem`.
- **Portas (Interfaces)**:
  - `inventario-ciclos.repository.port.ts`: Contratos `buscarAtivoPorUbs`, `salvarComSnapshot`, `listarPorUbsPaginado` e `atualizarStatus`.
- **Erros de Domínio**: `CicloAtivoJaExistenteException`, `CicloNaoEncontradoException`, `CicloJaFinalizadoException`.

### 4. Camada de Infraestrutura (`apps/backend/src/modules/inventario/infrastructure/`)
- **Adaptadores de Banco (`adapters/`)**:
  - `typeorm-inventario-ciclos.repository.ts`: Persistência TypeORM com RLS (`app.current_ubs_id`) e transação de snapshot.
- **Adaptadores de Entrada HTTP (`controllers/`)**:
  - `inventario-ciclos.controller.ts`: Endpoints `POST /`, `GET /ativo`, `GET /` e `POST /:id/cancelar`.

---

## 4. Critérios de Aceite (Gherkin BDD)

### Cenário 1: Início bem-sucedido de ciclo com cópia fiel de saldos teóricos
```gherkin
Dado que o farmacêutico está autenticado na sua UBS
E a UBS possui 120 lotes ativos cadastrados
E não há nenhum ciclo com status "EM_ANDAMENTO"
Quando ele enviar "POST /api/v1/inventario/ciclos" com:
  | observacoes | Inventario regular referente ao mes de outubro de 2026 |
Então a API deve retornar status 201 (Created)
E o ciclo deve ser criado com status "EM_ANDAMENTO"
E devem ser gerados exatamente 120 itens de contagem com quantidade_teorica congelada
```

### Cenário 2: Bloqueio de múltiplos ciclos ativos simultâneos na mesma UBS
```gherkin
Dado que já existe um ciclo "INV-2026/09" com status "EM_ANDAMENTO"
Quando o usuário tentar iniciar outro ciclo na mesma unidade
Então a API deve recusar com status 409 (Conflict)
E informar erro: "Já existe um ciclo de inventário em andamento para esta UBS"
```

---

## 5. Contratos de Dados (DTOs TypeScript)

```typescript
export class IniciarCicloInventarioDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacoesAbertura?: string;
}

export class CancelarCicloInventarioDto {
  @IsString()
  @MinLength(10, { message: 'O motivo do cancelamento deve conter no mínimo 10 caracteres' })
  @MaxLength(500)
  motivoCancelamento: string;
}

export interface CicloAtivoResponseDto {
  id: string;
  numeroCiclo: string;
  status: 'EM_ANDAMENTO';
  iniciadoEm: string;
  abertoPor: {
    id: string;
    nome: string;
  };
  totalItens: number;
  itensConferidos: number;
  percentualConcluido: number;
  totalDivergencias: number;
}
```

---

## 6. Definition of Done (DoD)

- [ ] Caso de uso `IniciarCicloInventarioUseCase` implementado com inserção em lote (`batch insert`) de snapshot para performance.
- [ ] Endpoints documentados com OpenAPI/Swagger.
- [ ] Testes unitários (Camada A) cobrindo travas de unicidade de ciclo ativo e cálculo de percentual de conclusão.
- [ ] Testes E2E (Camada C) validando fluxo de abertura, verificação de ativo e cancelamento.
